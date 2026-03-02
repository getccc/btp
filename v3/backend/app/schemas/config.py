from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


# ──────────────────────────── Paginated Response ────────────────────────────


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int


# ──────────────────────────── KolConfig ─────────────────────────────────────


class KolConfigCreate(BaseModel):
    platform: str = "x"
    username: str
    user_id: str | None = None
    display_name: str | None = None
    label: str | None = None
    reliability: float = 0.5
    is_active: bool = True


class KolConfigUpdate(BaseModel):
    platform: str | None = None
    username: str | None = None
    user_id: str | None = None
    display_name: str | None = None
    label: str | None = None
    reliability: float | None = None
    is_active: bool | None = None


class KolConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: str
    username: str
    user_id: str | None = None
    display_name: str | None = None
    label: str | None = None
    reliability: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ──────────────────────────── WalletConfig ──────────────────────────────────


class WalletConfigCreate(BaseModel):
    address: str
    chain: str
    label: str | None = None
    wallet_type: str = "smart_money"
    reliability: float = 0.5
    is_active: bool = True


class WalletConfigUpdate(BaseModel):
    address: str | None = None
    chain: str | None = None
    label: str | None = None
    wallet_type: str | None = None
    reliability: float | None = None
    is_active: bool | None = None


class WalletConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    address: str
    chain: str
    label: str | None = None
    wallet_type: str
    reliability: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ──────────────────────────── TelegramGroupConfig ───────────────────────────


class TelegramGroupConfigCreate(BaseModel):
    group_id: int | None = None
    group_link: str
    group_name: str | None = None
    group_type: str = "group"
    label: str | None = None
    is_active: bool = True


class TelegramGroupConfigUpdate(BaseModel):
    group_id: int | None = None
    group_link: str | None = None
    group_name: str | None = None
    group_type: str | None = None
    label: str | None = None
    is_active: bool | None = None


class TelegramGroupConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int | None = None
    group_link: str
    group_name: str | None = None
    group_type: str
    label: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ──────────────────────────── SystemConfig ──────────────────────────────────


class SystemConfigUpdate(BaseModel):
    value: Any
    description: str | None = None


class SystemConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: Any
    description: str | None = None
    updated_at: datetime
