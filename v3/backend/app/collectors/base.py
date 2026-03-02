from abc import ABC, abstractmethod
import asyncio
import time
from app.infra.redis_client import get_redis
from app.utils.logger import get_logger

log = get_logger(__name__)

class BaseCollector(ABC):
    name: str = "base"
    default_interval: int = 10

    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        log.info(f"Collector [{self.name}] started, interval={self.default_interval}s")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
        log.info(f"Collector [{self.name}] stopped")

    async def _run_loop(self):
        while self._running:
            try:
                await self._update_status("running")
                await self.collect()
                await self._update_status("idle")
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error(f"Collector [{self.name}] error: {e}")
                await self._update_status("error", str(e))
            await asyncio.sleep(self.default_interval)

    async def _update_status(self, status: str, error: str = ""):
        redis = await get_redis()
        await redis.hset(f"collector:status:{self.name}", mapping={
            "status": status,
            "error": error,
            "last_run": str(time.time()),
        })
        await redis.expire(f"collector:status:{self.name}", 60)

    @abstractmethod
    async def collect(self):
        pass
