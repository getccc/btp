from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.config import KolConfig, SystemConfig, TelegramGroupConfig, WalletConfig
from app.schemas.config import (
    KolConfigCreate,
    KolConfigResponse,
    KolConfigUpdate,
    SystemConfigResponse,
    SystemConfigUpdate,
    TelegramGroupConfigCreate,
    TelegramGroupConfigResponse,
    TelegramGroupConfigUpdate,
    WalletConfigCreate,
    WalletConfigResponse,
    WalletConfigUpdate,
)

router = APIRouter(prefix="/api/config", tags=["config"])


# ──────────────────────────── KOL CRUD ──────────────────────────────────────


@router.get("/kols", response_model=list[KolConfigResponse])
async def list_kols(
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[KolConfig]:
    stmt = select(KolConfig)
    if is_active is not None:
        stmt = stmt.where(KolConfig.is_active == is_active)
    stmt = stmt.order_by(KolConfig.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/kols", response_model=KolConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_kol(
    payload: KolConfigCreate,
    db: AsyncSession = Depends(get_db),
) -> KolConfig:
    kol = KolConfig(**payload.model_dump())
    db.add(kol)
    await db.flush()
    await db.refresh(kol)
    return kol


@router.put("/kols/{kol_id}", response_model=KolConfigResponse)
async def update_kol(
    kol_id: int,
    payload: KolConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> KolConfig:
    kol = await db.get(KolConfig, kol_id)
    if not kol:
        raise HTTPException(status_code=404, detail="KOL not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(kol, field, value)
    await db.flush()
    await db.refresh(kol)
    return kol


@router.delete("/kols/{kol_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kol(
    kol_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    kol = await db.get(KolConfig, kol_id)
    if not kol:
        raise HTTPException(status_code=404, detail="KOL not found")
    await db.delete(kol)


# ──────────────────────────── Wallet CRUD ───────────────────────────────────


@router.get("/wallets", response_model=list[WalletConfigResponse])
async def list_wallets(
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[WalletConfig]:
    stmt = select(WalletConfig)
    if is_active is not None:
        stmt = stmt.where(WalletConfig.is_active == is_active)
    stmt = stmt.order_by(WalletConfig.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/wallets", response_model=WalletConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_wallet(
    payload: WalletConfigCreate,
    db: AsyncSession = Depends(get_db),
) -> WalletConfig:
    wallet = WalletConfig(**payload.model_dump())
    db.add(wallet)
    await db.flush()
    await db.refresh(wallet)
    return wallet


@router.put("/wallets/{wallet_id}", response_model=WalletConfigResponse)
async def update_wallet(
    wallet_id: int,
    payload: WalletConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> WalletConfig:
    wallet = await db.get(WalletConfig, wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(wallet, field, value)
    await db.flush()
    await db.refresh(wallet)
    return wallet


@router.delete("/wallets/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wallet(
    wallet_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    wallet = await db.get(WalletConfig, wallet_id)
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    await db.delete(wallet)


# ──────────────────────────── TelegramGroup CRUD ────────────────────────────


@router.get("/telegram-groups", response_model=list[TelegramGroupConfigResponse])
async def list_telegram_groups(
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[TelegramGroupConfig]:
    stmt = select(TelegramGroupConfig)
    if is_active is not None:
        stmt = stmt.where(TelegramGroupConfig.is_active == is_active)
    stmt = stmt.order_by(TelegramGroupConfig.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/telegram-groups",
    response_model=TelegramGroupConfigResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_telegram_group(
    payload: TelegramGroupConfigCreate,
    db: AsyncSession = Depends(get_db),
) -> TelegramGroupConfig:
    group = TelegramGroupConfig(**payload.model_dump())
    db.add(group)
    await db.flush()
    await db.refresh(group)
    return group


@router.put("/telegram-groups/{group_id}", response_model=TelegramGroupConfigResponse)
async def update_telegram_group(
    group_id: int,
    payload: TelegramGroupConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> TelegramGroupConfig:
    group = await db.get(TelegramGroupConfig, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Telegram group not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    await db.flush()
    await db.refresh(group)
    return group


@router.delete("/telegram-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_telegram_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    group = await db.get(TelegramGroupConfig, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Telegram group not found")
    await db.delete(group)


# ──────────────────────────── SystemConfig CRUD ─────────────────────────────


@router.get("/system", response_model=list[SystemConfigResponse])
async def list_system_configs(
    db: AsyncSession = Depends(get_db),
) -> list[SystemConfig]:
    stmt = select(SystemConfig).order_by(SystemConfig.key)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/system/{key}", response_model=SystemConfigResponse)
async def get_system_config(
    key: str,
    db: AsyncSession = Depends(get_db),
) -> SystemConfig:
    config = await db.get(SystemConfig, key)
    if not config:
        raise HTTPException(status_code=404, detail=f"System config '{key}' not found")
    return config


@router.put("/system/{key}", response_model=SystemConfigResponse)
async def update_system_config(
    key: str,
    payload: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> SystemConfig:
    config = await db.get(SystemConfig, key)
    if not config:
        raise HTTPException(status_code=404, detail=f"System config '{key}' not found")
    config.value = payload.value
    if payload.description is not None:
        config.description = payload.description
    await db.flush()
    await db.refresh(config)
    return config
