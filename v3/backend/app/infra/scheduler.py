from app.collectors.price_quote import PriceQuoteCollector
from app.collectors.onchain_bsc import OnchainBscCollector
from app.collectors.onchain_solana import OnchainSolanaCollector
from app.collectors.x_kol import XKolCollector
from app.collectors.telegram_monitor import TelegramCollector
from app.utils.logger import get_logger

log = get_logger(__name__)


class CollectorManager:
    def __init__(self):
        self.collectors = {
            "price_quote": PriceQuoteCollector(),
            "onchain_bsc": OnchainBscCollector(),
            "onchain_solana": OnchainSolanaCollector(),
            "x_kol": XKolCollector(),
            "telegram_monitor": TelegramCollector(),
        }

    async def start_all(self):
        log.info("Starting all collectors...")
        for name, collector in self.collectors.items():
            try:
                await collector.start()
            except Exception as e:
                log.error(f"Failed to start collector {name}: {e}")

    async def stop_all(self):
        log.info("Stopping all collectors...")
        for name, collector in self.collectors.items():
            try:
                await collector.stop()
            except Exception as e:
                log.error(f"Failed to stop collector {name}: {e}")


collector_manager = CollectorManager()
