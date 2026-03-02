from fastapi import APIRouter, WebSocket

router = APIRouter()


@router.websocket("/ws/signals")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "pong", "data": data})
    except Exception:
        pass
