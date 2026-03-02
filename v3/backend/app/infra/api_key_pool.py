import json
from typing import Any

from pydantic import BaseModel

from app.config import settings
from app.infra.redis_client import get_redis
from app.utils.logger import get_logger

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------

_BSC_PROVIDERS: dict[str, dict[str, Any]] = {
    "bscscan": {
        "base_url": "https://api.bscscan.com/api",
        "rate_limit": 5,
    },
    "nodereal": {
        "base_url": "https://bsc-mainnet.nodereal.io/v1/{key}",
        "rate_limit": 10,
    },
    "moralis": {
        "base_url": "https://deep-index.moralis.io/api/v2.2",
        "rate_limit": 5,
    },
}

_SOLANA_PROVIDERS: dict[str, dict[str, Any]] = {
    "helius": {
        "base_url": "https://mainnet.helius-rpc.com/?api-key={key}",
        "rate_limit": 30,
    },
    "alchemy": {
        "base_url": "https://solana-mainnet.g.alchemy.com/v2/{key}",
        "rate_limit": 10,
    },
    "public_rpc": {
        "base_url": "https://api.mainnet-beta.solana.com",
        "rate_limit": 4,
    },
}

_CHAIN_PROVIDERS: dict[str, dict[str, dict[str, Any]]] = {
    "bsc": _BSC_PROVIDERS,
    "solana": _SOLANA_PROVIDERS,
}

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class KeyInfo(BaseModel):
    id: str
    provider: str
    key: str
    base_url: str
    rate_limit: int


# ---------------------------------------------------------------------------
# Pool
# ---------------------------------------------------------------------------


class ApiKeyPool:
    """Round-robin API-key pool with Redis-backed rate-limit cooldowns."""

    def __init__(self) -> None:
        self.pools: dict[str, list[KeyInfo]] = {"bsc": [], "solana": []}
        self.indices: dict[str, int] = {"bsc": 0, "solana": 0}
        self._load_keys()

    # -- bootstrap --------------------------------------------------------

    def _load_keys(self) -> None:
        """Parse ``BSC_API_KEYS`` / ``SOLANA_API_KEYS`` from settings."""
        chain_settings: dict[str, str] = {
            "bsc": settings.BSC_API_KEYS,
            "solana": settings.SOLANA_API_KEYS,
        }

        for chain, raw_json in chain_settings.items():
            try:
                entries: list[dict[str, Any]] = json.loads(raw_json)
            except json.JSONDecodeError:
                log.warning("invalid_json_for_api_keys", chain=chain)
                continue

            providers = _CHAIN_PROVIDERS.get(chain, {})
            for entry in entries:
                provider = entry.get("provider", "")
                key_value = entry.get("key", "")
                key_id = entry.get("id", f"{chain}_{provider}_{len(self.pools[chain])}")

                provider_cfg = providers.get(provider)
                if provider_cfg is None:
                    log.warning(
                        "unknown_provider",
                        chain=chain,
                        provider=provider,
                    )
                    continue

                base_url: str = provider_cfg["base_url"].format(key=key_value)
                rate_limit: int = provider_cfg["rate_limit"]

                self.pools[chain].append(
                    KeyInfo(
                        id=key_id,
                        provider=provider,
                        key=key_value,
                        base_url=base_url,
                        rate_limit=rate_limit,
                    )
                )

            log.info(
                "api_keys_loaded",
                chain=chain,
                count=len(self.pools[chain]),
            )

    # -- public API -------------------------------------------------------

    async def get_key(self, chain: str) -> KeyInfo | None:
        """Return the next available key for *chain* using round-robin.

        Keys that are currently in a rate-limit cooldown (tracked in Redis)
        are skipped.  Returns ``None`` when every key is on cooldown.
        """
        pool = self.pools.get(chain, [])
        if not pool:
            log.warning("no_keys_configured", chain=chain)
            return None

        redis = await get_redis()
        pool_size = len(pool)
        start_idx = self.indices[chain] % pool_size

        for offset in range(pool_size):
            idx = (start_idx + offset) % pool_size
            key_info = pool[idx]
            cooldown_key = f"api_pool:{chain}:cooldown:{key_info.id}"

            if await redis.exists(cooldown_key):
                continue

            # Advance index past the one we just handed out.
            self.indices[chain] = (idx + 1) % pool_size
            return key_info

        log.warning("all_keys_on_cooldown", chain=chain)
        return None

    async def report_rate_limited(
        self,
        chain: str,
        key_id: str,
        cooldown_seconds: int = 60,
    ) -> None:
        """Put *key_id* on cooldown for *cooldown_seconds*."""
        redis = await get_redis()
        cooldown_key = f"api_pool:{chain}:cooldown:{key_id}"
        await redis.set(cooldown_key, "1", ex=cooldown_seconds)
        log.info(
            "key_rate_limited",
            chain=chain,
            key_id=key_id,
            cooldown=cooldown_seconds,
        )


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

api_key_pool = ApiKeyPool()
