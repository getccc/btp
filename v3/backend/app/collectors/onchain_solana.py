import httpx
from datetime import datetime, timezone

from sqlalchemy import select

from app.collectors.base import BaseCollector
from app.infra.api_key_pool import KeyInfo, api_key_pool
from app.models.base import async_session_factory
from app.models.config import WalletConfig
from app.models.signal import OnchainEvent
from app.utils.logger import get_logger

log = get_logger(__name__)

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class OnchainSolanaCollector(BaseCollector):
    name = "onchain_solana"
    default_interval = 2

    async def collect(self):
        async with async_session_factory() as session:
            result = await session.execute(
                select(WalletConfig).where(
                    WalletConfig.chain == "solana",
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
        key = await api_key_pool.get_key("solana")
        if key is None:
            log.warning("no_solana_key_available", wallet=wallet.address)
            return

        try:
            signatures = await self._fetch_signatures(client, key, wallet.address)
        except httpx.TimeoutException:
            log.warning("solana_timeout", wallet=wallet.address, provider=key.provider)
            return
        except Exception as e:
            log.error("solana_fetch_error", wallet=wallet.address, error=str(e))
            return

        if not signatures:
            return

        await self._save_events(wallet, signatures)

    # ------------------------------------------------------------------
    # RPC fetch (all Solana providers share JSON-RPC interface)
    # ------------------------------------------------------------------

    async def _fetch_signatures(
        self, client: httpx.AsyncClient, key: KeyInfo, address: str,
    ) -> list[dict]:
        """Fetch recent transaction signatures via Solana JSON-RPC."""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getSignaturesForAddress",
            "params": [
                address,
                {"limit": 10, "commitment": "confirmed"},
            ],
        }
        resp = await client.post(key.base_url, json=payload)

        # HTTP-level rate limiting (429)
        if resp.status_code == 429:
            await api_key_pool.report_rate_limited("solana", key.id)
            log.warning("solana_rate_limited", key_id=key.id)
            return []

        resp.raise_for_status()
        data = resp.json()

        # JSON-RPC-level error (some providers signal limits here)
        if data.get("error"):
            error = data["error"]
            err_msg = str(error.get("message", "")).lower()
            if "rate" in err_msg or "limit" in err_msg or "too many" in err_msg:
                await api_key_pool.report_rate_limited("solana", key.id)
                log.warning("solana_rate_limited", key_id=key.id)
                return []
            log.warning("solana_rpc_error", error=error)
            return []

        return data.get("result", [])

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _save_events(
        self, wallet: WalletConfig, signatures: list[dict],
    ) -> None:
        sig_list = [s["signature"] for s in signatures if s.get("signature")]
        if not sig_list:
            return

        async with async_session_factory() as session:
            existing = await session.execute(
                select(OnchainEvent.tx_hash).where(
                    OnchainEvent.tx_hash.in_(sig_list),
                )
            )
            existing_hashes: set[str] = set(existing.scalars().all())

            new_events: list[OnchainEvent] = []
            for sig_info in signatures:
                signature = sig_info.get("signature", "")
                if not signature or signature in existing_hashes:
                    continue

                block_time = sig_info.get("blockTime")
                event_time = (
                    datetime.fromtimestamp(block_time, tz=timezone.utc)
                    if block_time
                    else datetime.now(timezone.utc)
                )

                has_error = sig_info.get("err") is not None
                event_type = "failed_tx" if has_error else "transaction"

                new_events.append(
                    OnchainEvent(
                        chain="solana",
                        event_type=event_type,
                        wallet_config_id=wallet.id,
                        wallet_address=wallet.address,
                        tx_hash=signature,
                        block_number=sig_info.get("slot"),
                        event_time=event_time,
                    )
                )

            if new_events:
                session.add_all(new_events)
                await session.commit()
                log.info(
                    "solana_events_saved",
                    wallet=wallet.address,
                    count=len(new_events),
                )
