import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.analyzers.llm_client import llm_client
from app.models.base import async_session_factory
from app.models.signal import OnchainEvent
from app.models.analysis import LlmAnalysisRun
from app.utils.logger import get_logger

log = get_logger(__name__)

ONCHAIN_ANALYSIS_PROMPT = """你是链上数据分析专家。
分析以下地址的近期链上交易行为。
输出 JSON 格式:
{
  "behavior_tag": "accumulating/distributing/arbitrage/dormant/unknown",
  "confidence": 0.0-1.0,
  "tokens_of_interest": [{"symbol": "...", "action": "buy/sell", "significance": "high/medium/low"}],
  "pattern_description": "一句话描述行为模式"
}
"""


class OnchainAnalyzer:
    """Analyze recent un-tagged onchain events per wallet via LLM."""

    async def run(self):
        """Main entry point: fetch, group, analyze, and persist."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)

        # 1. Fetch OnchainEvent records from last 5 mins where behavior_tag is null
        async with async_session_factory() as session:
            result = await session.execute(
                select(OnchainEvent).where(
                    OnchainEvent.behavior_tag.is_(None),
                    OnchainEvent.collected_at >= cutoff,
                )
            )
            events = list(result.scalars().all())

        if not events:
            log.debug("No un-analyzed onchain events")
            return

        # 2. Group by wallet_address
        by_wallet: dict[str, list[OnchainEvent]] = {}
        for ev in events:
            addr = ev.wallet_address or "unknown"
            by_wallet.setdefault(addr, []).append(ev)

        log.info(
            "Onchain analysis starting",
            wallets=len(by_wallet),
            total_events=len(events),
        )

        # 3. For each wallet, analyze
        for wallet_address, wallet_events in by_wallet.items():
            try:
                await self._analyze_wallet(wallet_address, wallet_events)
            except Exception as exc:
                log.error(
                    "Failed to analyze wallet",
                    wallet=wallet_address,
                    error=str(exc),
                )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _analyze_wallet(
        self,
        wallet_address: str,
        events: list[OnchainEvent],
    ):
        """Analyze a single wallet's recent events via LLM and update records."""
        # Build transaction descriptions for the LLM
        tx_descriptions: list[str] = []
        for ev in events:
            desc = (
                f"chain={ev.chain} type={ev.event_type} "
                f"from_token={ev.from_token} to_token={ev.to_token} "
                f"from_amount={ev.from_amount} to_amount={ev.to_amount} "
                f"usd_value={ev.usd_value} is_dex={ev.is_dex_trade} "
                f"dex={ev.dex_name} time={ev.event_time.isoformat()}"
            )
            tx_descriptions.append(desc)

        user_content = (
            f"钱包地址: {wallet_address}\n"
            f"交易数量: {len(events)}\n\n"
            + "\n".join(tx_descriptions[:100])  # Cap to avoid exceeding prompt limits
        )

        # 3a. Call LLM
        t0 = time.time()
        analysis_run = LlmAnalysisRun(
            run_type="onchain",
            input_count=len(events),
            model="deepseek-chat",
            status="running",
        )

        try:
            result = await llm_client.analyze(ONCHAIN_ANALYSIS_PROMPT, user_content)
            latency_ms = int((time.time() - t0) * 1000)
            analysis_run.latency_ms = latency_ms
            analysis_run.status = "success"
            analysis_run.completed_at = datetime.now(timezone.utc)
        except Exception as exc:
            analysis_run.status = "error"
            analysis_run.error = str(exc)[:500]
            analysis_run.completed_at = datetime.now(timezone.utc)

            async with async_session_factory() as session:
                session.add(analysis_run)
                await session.commit()

            log.error(
                "LLM analysis failed for wallet",
                wallet=wallet_address,
                error=str(exc),
            )
            return

        behavior_tag = result.get("behavior_tag", "unknown") if result else "unknown"

        # 3b. Update behavior_tag on all events for this wallet
        event_ids = [ev.id for ev in events]

        # 3c. Persist updates + analysis run in one transaction
        async with async_session_factory() as session:
            await session.execute(
                update(OnchainEvent)
                .where(OnchainEvent.id.in_(event_ids))
                .values(behavior_tag=behavior_tag)
            )
            session.add(analysis_run)
            await session.commit()

        log.info(
            "Wallet analyzed",
            wallet=wallet_address,
            events=len(events),
            behavior=behavior_tag,
            confidence=result.get("confidence") if result else None,
        )


onchain_analyzer = OnchainAnalyzer()
