import httpx
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.collectors.base import BaseCollector
from app.infra.api_key_pool import KeyInfo, api_key_pool
from app.models.base import async_session_factory
from app.models.config import WalletConfig
from app.models.signal import OnchainEvent
from app.utils.logger import get_logger

log = get_logger(__name__)

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_WEI = Decimal(10**18)

# Well-known DEX router addresses on BSC (lowercased)
_KNOWN_DEX_ROUTERS: set[str] = {
    "0x10ed43c718714eb63d5aa57b78b54704e256024e",  # PancakeSwap V2
    "0x13f4ea83d0bd40e75c8222255bc855a974568dd4",  # PancakeSwap V3
    "0x1b81d678ffb9c0263b24a97847620c99d213eb14",  # PancakeSwap Smart Router
    "0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8",  # BiSwap
}


class OnchainBscCollector(BaseCollector):
    name = "onchain_bsc"
    default_interval = 2

    async def collect(self):
        async with async_session_factory() as session:
            result = await session.execute(
                select(WalletConfig).where(
                    WalletConfig.chain == "bsc",
                    WalletConfig.is_active.is_(True),
                )
            )
            wallets = result.scalars().all()

        if not wallets:
            return

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            for wallet in wallets:
                await self._collect_wallet(client, wallet)

    # ------------------------------------------------------------------
    # Per-wallet pipeline
    # ------------------------------------------------------------------

    async def _collect_wallet(
        self, client: httpx.AsyncClient, wallet: WalletConfig,
    ) -> None:
        key = await api_key_pool.get_key("bsc")
        if key is None:
            log.warning("no_bsc_key_available", wallet=wallet.address)
            return

        try:
            raw_txs = await self._fetch_txs(client, key, wallet.address)
        except httpx.TimeoutException:
            log.warning("bsc_timeout", wallet=wallet.address, provider=key.provider)
            return
        except Exception as e:
            log.error("bsc_fetch_error", wallet=wallet.address, error=str(e))
            return

        if not raw_txs:
            return

        await self._save_events(wallet, raw_txs)

    # ------------------------------------------------------------------
    # Provider-specific fetchers (all normalise to BscScan-like dicts)
    # ------------------------------------------------------------------

    async def _fetch_txs(
        self, client: httpx.AsyncClient, key: KeyInfo, address: str,
    ) -> list[dict]:
        if key.provider == "bscscan":
            return await self._fetch_bscscan(client, key, address)
        if key.provider == "moralis":
            return await self._fetch_moralis(client, key, address)
        if key.provider == "nodereal":
            return await self._fetch_nodereal(client, key, address)
        log.warning("unsupported_bsc_provider", provider=key.provider)
        return []

    async def _fetch_bscscan(
        self, client: httpx.AsyncClient, key: KeyInfo, address: str,
    ) -> list[dict]:
        resp = await client.get(
            key.base_url,
            params={
                "module": "account",
                "action": "txlist",
                "address": address,
                "startblock": 0,
                "endblock": 99999999,
                "page": 1,
                "offset": 10,
                "sort": "desc",
                "apikey": key.key,
            },
        )
        resp.raise_for_status()
        data = resp.json()

        # Rate-limit detection
        if data.get("status") == "0" and "rate limit" in data.get("message", "").lower():
            await api_key_pool.report_rate_limited("bsc", key.id)
            log.warning("bsc_rate_limited", key_id=key.id)
            return []

        if data.get("status") != "1":
            log.warning(
                "bscscan_api_error",
                message=data.get("message"),
                result=str(data.get("result", ""))[:200],
            )
            return []

        return data.get("result", [])

    async def _fetch_moralis(
        self, client: httpx.AsyncClient, key: KeyInfo, address: str,
    ) -> list[dict]:
        resp = await client.get(
            f"{key.base_url}/{address}",
            headers={"X-API-Key": key.key},
            params={"chain": "bsc", "limit": 10, "order": "DESC"},
        )
        if resp.status_code == 429:
            await api_key_pool.report_rate_limited("bsc", key.id)
            log.warning("bsc_rate_limited", key_id=key.id, provider="moralis")
            return []
        resp.raise_for_status()
        data = resp.json()

        # Normalise Moralis fields to BscScan-like dict
        normalized: list[dict] = []
        for tx in data.get("result", []):
            ts = "0"
            if tx.get("block_timestamp"):
                try:
                    dt = datetime.fromisoformat(
                        tx["block_timestamp"].replace("Z", "+00:00"),
                    )
                    ts = str(int(dt.timestamp()))
                except (ValueError, TypeError):
                    pass
            normalized.append({
                "hash": tx.get("hash", ""),
                "blockNumber": tx.get("block_number", "0"),
                "timeStamp": ts,
                "value": tx.get("value", "0"),
                "to": tx.get("to_address", ""),
                "from": tx.get("from_address", ""),
                "functionName": tx.get("method_label", ""),
            })
        return normalized

    async def _fetch_nodereal(
        self, client: httpx.AsyncClient, key: KeyInfo, address: str,
    ) -> list[dict]:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "nr_getTransactionsByAddress",
            "params": [address, "latest", {"pageSize": 10}],
        }
        resp = await client.post(key.base_url, json=payload)
        if resp.status_code == 429:
            await api_key_pool.report_rate_limited("bsc", key.id)
            log.warning("bsc_rate_limited", key_id=key.id, provider="nodereal")
            return []
        resp.raise_for_status()
        data = resp.json()

        if data.get("error"):
            log.warning("nodereal_rpc_error", error=data["error"])
            return []

        raw = (data.get("result") or {}).get("transactions", [])
        normalized: list[dict] = []
        for tx in raw:
            try:
                normalized.append({
                    "hash": tx.get("hash", ""),
                    "blockNumber": str(int(tx.get("blockNumber", "0x0"), 16)),
                    "timeStamp": str(int(tx.get("timestamp", "0x0"), 16)),
                    "value": str(int(tx.get("value", "0x0"), 16)),
                    "to": tx.get("to", ""),
                    "from": tx.get("from", ""),
                    "functionName": "",
                })
            except (ValueError, TypeError):
                continue
        return normalized

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _save_events(
        self, wallet: WalletConfig, txs: list[dict],
    ) -> None:
        tx_hashes = [tx["hash"] for tx in txs if tx.get("hash")]
        if not tx_hashes:
            return

        async with async_session_factory() as session:
            existing = await session.execute(
                select(OnchainEvent.tx_hash).where(
                    OnchainEvent.tx_hash.in_(tx_hashes),
                )
            )
            existing_hashes: set[str] = set(existing.scalars().all())

            new_events: list[OnchainEvent] = []
            for tx in txs:
                tx_hash = tx.get("hash", "")
                if not tx_hash or tx_hash in existing_hashes:
                    continue

                ts = int(tx.get("timeStamp", 0) or 0)
                event_time = (
                    datetime.fromtimestamp(ts, tz=timezone.utc)
                    if ts
                    else datetime.now(timezone.utc)
                )

                value_wei = int(tx.get("value", 0) or 0)
                value_bnb = Decimal(value_wei) / _WEI if value_wei else None

                to_addr = (tx.get("to") or "").lower()
                func_name = (tx.get("functionName") or "").lower()
                is_dex = to_addr in _KNOWN_DEX_ROUTERS or "swap" in func_name

                new_events.append(
                    OnchainEvent(
                        chain="bsc",
                        event_type="transfer",
                        wallet_config_id=wallet.id,
                        wallet_address=wallet.address,
                        tx_hash=tx_hash,
                        block_number=int(tx.get("blockNumber", 0) or 0),
                        from_token="BNB",
                        from_amount=value_bnb,
                        is_dex_trade=is_dex,
                        event_time=event_time,
                    )
                )

            if new_events:
                session.add_all(new_events)
                await session.commit()
                log.info(
                    "bsc_events_saved",
                    wallet=wallet.address,
                    count=len(new_events),
                )
