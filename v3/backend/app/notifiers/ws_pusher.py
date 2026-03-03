import json

from app.infra.redis_client import get_redis
from app.utils.logger import get_logger

log = get_logger(__name__)


class WsPusher:
    """Push events to WebSocket clients via Redis pub/sub."""

    async def broadcast(self, event: str, data: dict) -> None:
        """Publish a message to the ws:broadcast Redis channel."""
        redis = await get_redis()
        payload = json.dumps({"event": event, "data": data}, default=str)
        await redis.publish("ws:broadcast", payload)
        log.debug("WS broadcast sent", event=event)


ws_pusher = WsPusher()