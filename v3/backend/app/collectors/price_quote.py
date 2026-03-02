import httpx
from app.collectors.base import BaseCollector
from app.models.base import async_session_factory
from app.models.signal import PriceSnapshot
from app.utils.logger import get_logger

log = get_logger(__name__)

class PriceQuoteCollector(BaseCollector):
    name = "price_quote"
    default_interval = 30

    async def collect(self):
        # For Phase 1/2, we'll just fetch a few hardcoded tokens to prove it works
        # In Phase 3, this will read active tokens from Redis
        tokens = ["solana", "bitcoin"]
        
        async with httpx.AsyncClient() as client:
            for token in tokens:
                try:
                    # Use CoinGecko or DexScreener free API
                    # Example: DexScreener search API
                    resp = await client.get(f"https://api.dexscreener.com/latest/dex/search?q={token}")
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("pairs") and len(data["pairs"]) > 0:
                            pair = data["pairs"][0]
                            
                            async with async_session_factory() as session:
                                snapshot = PriceSnapshot(
                                    token_symbol=pair.get("baseToken", {}).get("symbol", token),
                                    token_address=pair.get("baseToken", {}).get("address", ""),
                                    chain=pair.get("chainId", ""),
                                    price_usd=float(pair.get("priceUsd", 0)),
                                    volume_24h=float(pair.get("volume", {}).get("h24", 0)),
                                    volume_5m=float(pair.get("volume", {}).get("m5", 0)),
                                    liquidity_usd=float(pair.get("liquidity", {}).get("usd", 0)),
                                    price_change_24h=float(pair.get("priceChange", {}).get("h24", 0)),
                                    source="dexscreener"
                                )
                                session.add(snapshot)
                                await session.commit()
                                log.info(f"Saved price snapshot for {token}")
                except Exception as e:
                    log.error(f"Error fetching price for {token}: {e}")
