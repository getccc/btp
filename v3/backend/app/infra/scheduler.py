
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.collectors.price_quote import PriceQuoteCollector
from app.collectors.onchain_bsc import OnchainBscCollector
from app.collectors.onchain_solana import OnchainSolanaCollector
from app.collectors.x_kol import XKolCollector
from app.collectors.telegram_monitor import TelegramCollector
from app.models.base import async_session_factory
from app.models.signal import PriceSnapshot
from app.utils.logger import get_logger

log = get_logger(__name__)


async def cleanup_old_data() -> None:
    """Delete PriceSnapshot records older than 7 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    async with async_session_factory() as session:
        result = await session.execute(
            delete(PriceSnapshot).where(PriceSnapshot.snapshot_at < cutoff)
        )
        await session.commit()
        log.info("Cleanup complete", deleted_snapshots=result.rowcount)



class CollectorManager:
    def __init__(self):
        self.collectors = {
            "price_quote": PriceQuoteCollector(),
            "onchain_bsc": OnchainBscCollector(),
            "onchain_solana": OnchainSolanaCollector(),
            "x_kol": XKolCollector(),
            "telegram_monitor": TelegramCollector(),
        }
        self.scheduler: AsyncIOScheduler | None = None

    async def start_all(self):
        log.info("Starting all collectors...")
        for name, collector in self.collectors.items():
            try:
                await collector.start()
            except Exception as e:
                log.error(f"Failed to start collector {name}: {e}")

        # Start the APScheduler for periodic analyzer jobs
        self._setup_scheduler()
        if self.scheduler:
            self.scheduler.start()
            log.info("APScheduler started")

    async def stop_all(self):
        log.info("Stopping all collectors...")
        if self.scheduler:
            self.scheduler.shutdown(wait=False)
            log.info("APScheduler stopped")
        for name, collector in self.collectors.items():
            try:
                await collector.stop()
            except Exception as e:
                log.error(f"Failed to stop collector {name}: {e}")

    def _setup_scheduler(self) -> None:
        """Configure APScheduler with periodic analyzer jobs."""
        from app.analyzers.tweet_analyzer import tweet_analyzer
        from app.analyzers.scoring_engine import scoring_engine

        self.scheduler = AsyncIOScheduler()

        # Tweet analysis — every 300s
        self.scheduler.add_job(
            tweet_analyzer.run,
            "interval",
            seconds=300,
            id="tweet_analyzer",
            name="Tweet Analyzer",
            replace_existing=True,
        )

        # Telegram analysis — every 300s (stub import; add when analyzer exists)
        try:
            from app.analyzers.telegram_analyzer import telegram_analyzer

            self.scheduler.add_job(
                telegram_analyzer.run,
                "interval",
                seconds=300,
                id="telegram_analyzer",
                name="Telegram Analyzer",
                replace_existing=True,
            )
        except ImportError:
            log.warning("telegram_analyzer not yet implemented, skipping scheduler job")

        # On-chain analysis — every 300s (stub import; add when analyzer exists)
        try:
            from app.analyzers.onchain_analyzer import onchain_analyzer

            self.scheduler.add_job(
                onchain_analyzer.run,
                "interval",
                seconds=300,
                id="onchain_analyzer",
                name="Onchain Analyzer",
                replace_existing=True,
            )
        except ImportError:
            log.warning("onchain_analyzer not yet implemented, skipping scheduler job")

        # Scoring engine — every 300s
        self.scheduler.add_job(
            scoring_engine.run,
            "interval",
            seconds=300,
            id="scoring_engine",
            name="Scoring Engine",
            replace_existing=True,
        )

        # Daily cleanup of old price snapshots at 3 AM
        self.scheduler.add_job(
            cleanup_old_data,
            "cron",
            hour=3,
            id="cleanup_old_data",
            name="Cleanup Old Data",
            replace_existing=True,
        )

        log.info(
            "Scheduler configured",
            job_count=len(self.scheduler.get_jobs()),
        )


collector_manager = CollectorManager()
