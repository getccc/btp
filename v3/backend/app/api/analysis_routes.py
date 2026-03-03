from fastapi import APIRouter
from sqlalchemy import select

from app.models.base import async_session_factory
from app.models.analysis import LlmAnalysisRun, OpportunityScore
from app.schemas.analysis import LlmAnalysisRunResponse, OpportunityScoreResponse

router = APIRouter(prefix="/api", tags=["analysis"])


@router.get("/scores", response_model=list[OpportunityScoreResponse])
async def list_scores() -> list[OpportunityScoreResponse]:
    """Return the latest opportunity scores, ordered by total_score descending."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(OpportunityScore)
            .order_by(OpportunityScore.total_score.desc())
            .limit(50)
        )
        return [
            OpportunityScoreResponse.model_validate(r)
            for r in result.scalars().all()
        ]


@router.get("/scores/{token}", response_model=list[OpportunityScoreResponse])
async def get_token_score_history(token: str) -> list[OpportunityScoreResponse]:
    """Return score history for a specific token, most recent first."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(OpportunityScore)
            .where(OpportunityScore.token_symbol == token.upper())
            .order_by(OpportunityScore.scored_at.desc())
            .limit(100)
        )
        return [
            OpportunityScoreResponse.model_validate(r)
            for r in result.scalars().all()
        ]


@router.get("/analysis/runs", response_model=list[LlmAnalysisRunResponse])
async def list_analysis_runs() -> list[LlmAnalysisRunResponse]:
    """Return the most recent LLM analysis runs."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(LlmAnalysisRun)
            .order_by(LlmAnalysisRun.started_at.desc())
            .limit(50)
        )
        return [
            LlmAnalysisRunResponse.model_validate(r)
            for r in result.scalars().all()
        ]
