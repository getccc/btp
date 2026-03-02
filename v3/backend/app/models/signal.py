from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class KolTweet(Base):
    __tablename__ = "kol_tweets"
    __table_args__ = (
        Index("ix_kol_tweets_tweet_time", "tweet_time", postgresql_using="btree"),
        Index(
            "ix_kol_tweets_not_analyzed",
            "is_analyzed",
            postgresql_where="is_analyzed = false",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tweet_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    kol_config_id: Mapped[int | None] = mapped_column(
        ForeignKey("kol_configs.id"), nullable=True,
    )
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    media_urls: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tweet_time: Mapped[datetime] = mapped_column(nullable=False)
    collected_at: Mapped[datetime] = mapped_column(server_default=func.now())
    is_analyzed: Mapped[bool] = mapped_column(Boolean, default=False)
    tokens_mentioned: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sentiment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    signal_strength: Mapped[float | None] = mapped_column(Float, nullable=True)
    analysis_summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class TelegramSignal(Base):
    __tablename__ = "telegram_signals"
    __table_args__ = (
        Index("ix_telegram_signals_window_end", "window_end", postgresql_using="btree"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_config_id: Mapped[int | None] = mapped_column(
        ForeignKey("telegram_group_configs.id"), nullable=True,
    )
    group_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    window_start: Mapped[datetime] = mapped_column(nullable=False)
    window_end: Mapped[datetime] = mapped_column(nullable=False)
    message_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_mentioned: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    group_sentiment: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fomo_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    spam_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    analysis_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    analyzed_at: Mapped[datetime] = mapped_column(server_default=func.now())


class OnchainEvent(Base):
    __tablename__ = "onchain_events"
    __table_args__ = (
        Index("ix_onchain_events_chain_time", "chain", "event_time", postgresql_using="btree"),
        Index("ix_onchain_events_wallet", "wallet_address", postgresql_using="btree"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chain: Mapped[str] = mapped_column(String(20), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    wallet_config_id: Mapped[int | None] = mapped_column(
        ForeignKey("wallet_configs.id"), nullable=True,
    )
    wallet_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tx_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    block_number: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    from_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    to_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    from_amount: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    to_amount: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    usd_value: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    behavior_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_dex_trade: Mapped[bool] = mapped_column(Boolean, default=False)
    dex_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    event_time: Mapped[datetime] = mapped_column(nullable=False)
    collected_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"
    __table_args__ = (
        Index("ix_price_snapshots_symbol_time", "token_symbol", "snapshot_at", postgresql_using="btree"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token_symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    token_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chain: Mapped[str | None] = mapped_column(String(20), nullable=True)
    price_usd: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    volume_24h: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    volume_5m: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    liquidity_usd: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    price_change_5m: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_change_1h: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_change_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    buy_count_5m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sell_count_5m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    snapshot_at: Mapped[datetime] = mapped_column(server_default=func.now())
