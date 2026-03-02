from datetime import datetime

from sqlalchemy import Float, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LlmAnalysisRun(Base):
    __tablename__ = "llm_analysis_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_type: Mapped[str] = mapped_column(String(50), nullable=False)
    input_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="running")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)


class OpportunityScore(Base):
    __tablename__ = "opportunity_scores"
    __table_args__ = (
        Index("ix_opportunity_scores_symbol_time", "token_symbol", "scored_at", postgresql_using="btree"),
        Index("ix_opportunity_scores_total", "total_score", postgresql_using="btree"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token_symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    token_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chain: Mapped[str | None] = mapped_column(String(20), nullable=True)
    kol_score: Mapped[float] = mapped_column(Float, default=0)
    smart_money_score: Mapped[float] = mapped_column(Float, default=0)
    social_score: Mapped[float] = mapped_column(Float, default=0)
    onchain_score: Mapped[float] = mapped_column(Float, default=0)
    liquidity_score: Mapped[float] = mapped_column(Float, default=0)
    crowdedness_penalty: Mapped[float] = mapped_column(Float, default=0)
    manipulation_penalty: Mapped[float] = mapped_column(Float, default=0)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    regime: Mapped[str | None] = mapped_column(String(20), nullable=True)
    direction: Mapped[str | None] = mapped_column(String(20), nullable=True)
    signal_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    scored_at: Mapped[datetime] = mapped_column(server_default=func.now())
