from typing import Any

from app.notifiers.ws_pusher import ws_pusher
from app.infra.redis_client import get_redis
from app.schemas.analysis import OpportunityScoreResponse
from app.schemas.signal import KolTweetResponse, OnchainEventResponse


async def broadcast_event(event_type: str, data: Any) -> None:
    await ws_pusher.broadcast(event_type, data)


async def broadcast_health_update(health: dict[str, str]) -> None:
    await broadcast_event("health_update", health)


async def get_collector_statuses_snapshot() -> list[dict[str, str]]:
    redis = await get_redis()
    keys = [key async for key in redis.scan_iter(match="collector:status:*")]
    statuses: list[dict[str, str]] = []
    for key in sorted(keys):
        name = key.split(":")[-1]
        data = await redis.hgetall(key)
        statuses.append({"name": name, **data})
    return statuses


async def broadcast_collector_update() -> None:
    await broadcast_event("collector_update", await get_collector_statuses_snapshot())


def serialize_tweet(tweet: Any) -> dict[str, Any]:
    return KolTweetResponse.model_validate(tweet).model_dump(mode="json")


def serialize_onchain_event(event: Any) -> dict[str, Any]:
    return OnchainEventResponse.model_validate(event).model_dump(mode="json")


def serialize_score(score: Any) -> dict[str, Any]:
    return OpportunityScoreResponse.model_validate(score).model_dump(mode="json")
