from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


# ──────────────────────────── KolTweet ───────────────────────────────────────


class KolTweetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tweet_id: str
    kol_config_id: int | None = None
    username: str
    content: str
    media_urls: list | None = None
    metrics: dict | None = None
    tweet_time: datetime
    collected_at: datetime
    is_analyzed: bool
    tokens_mentioned: dict | None = None
    sentiment: str | None = None
    sentiment_score: float | None = None
    signal_strength: float | None = None
    analysis_summary: str | None = None


# ──────────────────────────── OnchainEvent ───────────────────────────────────


class OnchainEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    chain: str
    event_type: str
    wallet_config_id: int | None = None
    wallet_address: str | None = None
    tx_hash: str | None = None
    block_number: int | None = None
    from_token: str | None = None
    to_token: str | None = None
    from_amount: Decimal | None = None
    to_amount: Decimal | None = None
    usd_value: Decimal | None = None
    behavior_tag: str | None = None
    is_dex_trade: bool
    dex_name: str | None = None
    event_time: datetime
    collected_at: datetime


# ──────────────────────────── PriceSnapshot ──────────────────────────────────


class PriceSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token_symbol: str
    token_address: str | None = None
    chain: str | None = None
    price_usd: Decimal | None = None
    volume_24h: Decimal | None = None
    volume_5m: Decimal | None = None
    liquidity_usd: Decimal | None = None
    price_change_5m: float | None = None
    price_change_1h: float | None = None
    price_change_24h: float | None = None
    buy_count_5m: int | None = None
    sell_count_5m: int | None = None
    source: str | None = None
    snapshot_at: datetime
