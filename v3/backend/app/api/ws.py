import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.infra.redis_client import get_redis
from app.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.websocket("/ws/signals")
async def websocket_signals(websocket: WebSocket):
    await websocket.accept()
    redis = await get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe("ws:broadcast")

    async def reader():
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await websocket.send_text(message["data"])
        except Exception as e:
            log.error(f"WS reader error: {e}")

    task = asyncio.create_task(reader())
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages if needed
    except WebSocketDisconnect:
        pass
    finally:
        task.cancel()
        await pubsub.unsubscribe("ws:broadcast")
