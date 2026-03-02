from fastapi import APIRouter
from sqlalchemy import select

from app.models.base import async_session_factory
from app.models.signal import KolTweet, OnchainEvent, PriceSnapshot
from app.schemas.signal import (
    KolTweetResponse,
    OnchainEventResponse,
    PriceSnapshotResponse,
)

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.get("/tweets", response_model=list[KolTweetResponse])
async def list_tweets() -> list[KolTweetResponse]:
    """Return the 50 most recent KOL tweets."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(KolTweet).order_by(KolTweet.tweet_time.desc()).limit(50)
        )
        return [KolTweetResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/onchain", response_model=list[OnchainEventResponse])
async def list_onchain_events() -> list[OnchainEventResponse]:
    """Return the 50 most recent on-chain events."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(OnchainEvent).order_by(OnchainEvent.event_time.desc()).limit(50)
        )
        return [OnchainEventResponse.model_validate(r) for r in result.scalars().all()]


@router.get("/prices", response_model=list[PriceSnapshotResponse])
async def list_price_snapshots() -> list[PriceSnapshotResponse]:
    """Return the 50 most recent price snapshots."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(PriceSnapshot).order_by(PriceSnapshot.snapshot_at.desc()).limit(50)
        )
        return [PriceSnapshotResponse.model_validate(r) for r in result.scalars().all()]
