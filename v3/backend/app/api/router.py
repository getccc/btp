from fastapi import APIRouter

from app.api.config_routes import router as config_router
from app.api.system_routes import router as system_router
from app.api.ws import router as ws_router
from app.api.signal_routes import router as signal_router
from app.api.analysis_routes import router as analysis_router

api_router = APIRouter()
api_router.include_router(config_router)
api_router.include_router(system_router)
api_router.include_router(ws_router)
api_router.include_router(signal_router)
api_router.include_router(analysis_router)
