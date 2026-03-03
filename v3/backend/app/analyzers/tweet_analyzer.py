import time
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.analyzers.llm_client import llm_client
from app.models.analysis import LlmAnalysisRun
from app.models.base import async_session_factory
from app.models.signal import KolTweet
from app.utils.logger import get_logger

log = get_logger(__name__)

TWEET_ANALYSIS_PROMPT = """你是一个专业的加密货币推文分析师。
分析以下 KOL 推文，输出 JSON 格式结果，必须包含 "results" 数组，数组中每个元素对应一条推文的分析结果。
每个结果包含:
1. id: 推文的内部 ID (原样返回)
2. tokens_mentioned: 提到的代币 [{"symbol": "...", "chain": "bsc/solana/unknown", "confidence": 0.9}]
3. sentiment: "bullish" / "bearish" / "neutral"
4. sentiment_score: -1.0 到 1.0
5. signal_strength: 0.0 到 1.0
6. summary: 一句话中文摘要
"""


class TweetAnalyzer:
    batch_size = 20

    async def run(self) -> None:
        """Fetch unanalyzed tweets and process them in batches."""
        tweets = await self._fetch_unanalyzed(limit=100)
        if not tweets:
            log.debug("No unanalyzed tweets")
            return

        log.info("Starting tweet analysis", total=len(tweets))

        for i in range(0, len(tweets), self.batch_size):
            batch = tweets[i : i + self.batch_size]
            await self._process_batch(batch)

        log.info("Tweet analysis complete", total=len(tweets))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_unanalyzed(self, limit: int = 100) -> list[KolTweet]:
        async with async_session_factory() as session:
            result = await session.execute(
                select(KolTweet)
                .where(KolTweet.is_analyzed.is_(False))
                .order_by(KolTweet.tweet_time.asc())
                .limit(limit),
            )
            return list(result.scalars().all())

    async def _process_batch(self, batch: list[KolTweet]) -> None:
        """Analyze one batch via LLM and persist results."""
        items = [
            {"id": t.id, "username": t.username, "content": t.content}
            for t in batch
        ]
        batch_ids = [t.id for t in batch]

        start_ms = _now_ms()
        status = "completed"
        error_text: str | None = None
        results: list[dict] = []

        try:
            results = await llm_client.analyze_batch(items, TWEET_ANALYSIS_PROMPT)
        except Exception as exc:
            status = "failed"
            error_text = str(exc)[:2000]
            log.error("Batch analysis failed", error=error_text)

        latency = _now_ms() - start_ms

        # Map results by tweet id for fast lookup
        result_map: dict[int, dict] = {}
        for r in results:
            rid = r.get("id")
            if isinstance(rid, int):
                result_map[rid] = r

        # Persist updates
        async with async_session_factory() as session:
            for tweet_id in batch_ids:
                analysis = result_map.get(tweet_id, {})
                await session.execute(
                    update(KolTweet)
                    .where(KolTweet.id == tweet_id)
                    .values(
                        is_analyzed=True,
                        tokens_mentioned=analysis.get("tokens_mentioned"),
                        sentiment=analysis.get("sentiment"),
                        sentiment_score=analysis.get("sentiment_score"),
                        signal_strength=analysis.get("signal_strength"),
                        analysis_summary=analysis.get("summary"),
                    ),
                )

            # Record analysis run
            run = LlmAnalysisRun(
                run_type="tweet_batch",
                input_count=len(batch),
                model=llm_client.model,
                latency_ms=latency,
                status=status,
                error=error_text,
                completed_at=datetime.now(timezone.utc) if status == "completed" else None,
            )
            session.add(run)
            await session.commit()

        log.info(
            "Batch processed",
            batch_size=len(batch),
            matched=len(result_map),
            latency_ms=latency,
            status=status,
        )


def _now_ms() -> int:
    return int(time.monotonic() * 1000)


tweet_analyzer = TweetAnalyzer()
