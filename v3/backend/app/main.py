from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.router import api_router
from app.config import settings
from app.infra.redis_client import close_redis, get_redis
from app.models.base import async_session_factory
from app.models.config import SystemConfig
from app.utils.logger import get_logger, setup_logging

log = get_logger(__name__)

DEFAULT_SYSTEM_CONFIGS: list[dict] = [
    {
        "key": "scoring_weights",
        "value": {
            "kol": 0.25,
            "smart_money": 0.25,
            "social": 0.15,
            "onchain": 0.15,
            "liquidity": 0.10,
            "price_momentum": 0.10,
        },
        "description": "Weights for opportunity scoring dimensions",
    },
    {
        "key": "notification_rules",
        "value": {
            "min_score": 75,
            "channels": ["telegram", "web"],
            "cooldown_minutes": 30,
        },
        "description": "Rules governing when and how notifications are sent",
    },
    {
        "key": "collector_intervals",
        "value": {
            "x_kol": 120,
            "telegram": 10,
            "onchain_bsc": 2,
            "onchain_sol": 2,
            "price_quote": 30,
        },
        "description": "Data collection intervals in seconds per collector",
    },
    {
        "key": "llm_config",
        "value": {
            "model": "deepseek-chat",
            "batch_interval": 300,
            "max_tokens": 2000,
        },
        "description": "LLM analysis configuration",
    },
    {
        "key": "regime_thresholds",
        "value": {
            "quiet_max_score": 40,
            "trending_min_score": 40,
            "mania_min_score": 70,
        },
        "description": "Score thresholds for market regime classification",
    },
]


async def seed_system_configs() -> None:
    """Insert default system config rows if they don't already exist."""
    async with async_session_factory() as session:
        for cfg in DEFAULT_SYSTEM_CONFIGS:
            existing = await session.execute(
                select(SystemConfig).where(SystemConfig.key == cfg["key"])
            )
            if existing.scalar_one_or_none() is None:
                session.add(SystemConfig(**cfg))
                log.info("seed_system_config", key=cfg["key"])
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup / shutdown."""
    setup_logging()
    log.info("startup.begin")

    # Warm up Redis connection
    try:
        redis = await get_redis()
        await redis.ping()
        log.info("startup.redis_connected")
    except Exception as exc:
        log.warning("startup.redis_unavailable", error=str(exc))

    # Seed default system configs
    try:
        await seed_system_configs()
        log.info("startup.system_configs_seeded")
    except Exception as exc:
        log.error("startup.seed_failed", error=str(exc))

    log.info("startup.complete")
    yield

    # Shutdown
    await close_redis()
    log.info("shutdown.complete")


app = FastAPI(
    title="V3 Signal Platform",
    version="0.1.0",
    description="Crypto signal collection and analysis platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
