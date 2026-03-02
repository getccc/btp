from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.models.base import async_session_factory
from app.infra.redis_client import get_redis
from app.utils.logger import get_logger

router = APIRouter(prefix="/api/system", tags=["system"])
log = get_logger(__name__)


@router.get("/health")
async def health_check() -> dict:
    """Check database and Redis connectivity."""
    result: dict = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "unknown",
        "redis": "unknown",
    }

    # Check database
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        result["database"] = "connected"
    except Exception as exc:
        result["database"] = f"error: {exc}"
        result["status"] = "degraded"
        log.error("health_check.db_failed", error=str(exc))

    # Check Redis
    try:
        redis = await get_redis()
        await redis.ping()
        result["redis"] = "connected"
    except Exception as exc:
        result["redis"] = f"error: {exc}"
        result["status"] = "degraded"
        log.error("health_check.redis_failed", error=str(exc))

    return result


@router.get("/collectors")
async def collector_statuses() -> list[dict]:
    """Return current status of all collectors from Redis."""
    redis = await get_redis()
    keys = await redis.keys("collector:status:*")
    statuses: list[dict] = []
    for key in sorted(keys):
        name = key.split(":")[-1]
        data = await redis.hgetall(key)
        statuses.append({"name": name, **data})
    return statuses
