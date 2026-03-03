from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ──────────────────────────── OpportunityScore ────────────────────────────────


class OpportunityScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    token_symbol: str
    token_address: str | None = None
    chain: str | None = None
    kol_score: float
    smart_money_score: float
    social_score: float
    onchain_score: float
    liquidity_score: float
    crowdedness_penalty: float
    manipulation_penalty: float
    total_score: float
    regime: str | None = None
    direction: str | None = None
    signal_snapshot: dict | None = None
    reasoning: str | None = None
    scored_at: datetime


# ──────────────────────────── LlmAnalysisRun ──────────────────────────────────


class LlmAnalysisRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_type: str
    input_count: int | None = None
    model: str | None = None
    tokens_used: int | None = None
    latency_ms: int | None = None
    status: str
    error: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
