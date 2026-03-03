import time
import json
from datetime import datetime, timezone

from sqlalchemy import select

from app.analyzers.llm_client import llm_client
from app.infra.redis_client import get_redis
from app.models.base import async_session_factory
from app.models.config import TelegramGroupConfig
from app.models.signal import TelegramSignal
from app.models.analysis import LlmAnalysisRun
from app.utils.logger import get_logger

log = get_logger(__name__)

# Redis key prefix used by the Telegram collector
REDIS_MSG_PREFIX = "collector:telegram:messages"

TG_ANALYSIS_PROMPT = """你是一个加密货币社群情绪分析师。
分析以下 Telegram 群在某个时间窗口内的消息集合。
输出 JSON 格式:
{
  "tokens_mentioned": [{"symbol": "...", "mention_count": 1, "sentiment": "bullish/bearish/neutral"}],
  "group_sentiment": "bullish/bearish/neutral",
  "fomo_score": 0-100,
  "spam_ratio": 0.0-1.0,
  "summary": "一段中文摘要"
}
"""


def _safe_float(val) -> float | None:
    """Safely convert a value to float, returning None on failure."""
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


class TelegramAnalyzer:
    """Consume buffered Telegram messages from Redis and analyze per group via LLM."""

    async def run(self):
        """Main entry point: scan Redis buffers, analyze each group, persist results."""
        redis = await get_redis()

        # 1. Find all keys matching collector:telegram:messages:*
        keys: list[str] = []
        async for key in redis.scan_iter(match=f"{REDIS_MSG_PREFIX}:*"):
            keys.append(key)

        if not keys:
            log.debug("No Telegram message buffers to analyze")
            return

        # Pre-load group configs for mapping chat_id -> config
        group_map = await self._load_group_map()

        # 2. For each group buffer, analyze
        for key in keys:
            try:
                await self._analyze_group_buffer(redis, key, group_map)
            except Exception as exc:
                log.error(
                    "Failed to analyze Telegram group buffer",
                    key=key,
                    error=str(exc),
                )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _load_group_map(self) -> dict[int, TelegramGroupConfig]:
        """Load active Telegram group configs keyed by group_id."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(TelegramGroupConfig).where(
                    TelegramGroupConfig.is_active.is_(True),
                )
            )
            groups = result.scalars().all()
            return {g.group_id: g for g in groups if g.group_id is not None}

    async def _analyze_group_buffer(
        self,
        redis,
        key: str,
        group_map: dict[int, TelegramGroupConfig],
    ):
        """Pop all messages from a single group buffer, analyze, and persist."""
        # 3a. Atomically read and clear the buffer
        pipe = redis.pipeline()
        pipe.lrange(key, 0, -1)
        pipe.delete(key)
        results = await pipe.execute()
        raw_messages: list[str] = results[0]

        if not raw_messages:
            return

        # Parse messages
        messages: list[dict] = []
        for raw in raw_messages:
            try:
                messages.append(json.loads(raw) if isinstance(raw, str) else raw)
            except json.JSONDecodeError:
                log.warning("Skipping unparseable Telegram message", raw=str(raw)[:200])

        if not messages:
            return

        # Extract chat_id from key suffix or first message
        chat_id: int | None = None
        try:
            chat_id = int(key.rsplit(":", 1)[-1])
        except (ValueError, IndexError):
            chat_id = messages[0].get("chat_id")

        group_config = group_map.get(chat_id) if chat_id else None
        group_name = (
            (group_config.group_name if group_config else None)
            or messages[0].get("chat_title", "unknown")
        )

        # Determine time window from message dates
        dates: list[datetime] = []
        for m in messages:
            d = m.get("date")
            if isinstance(d, str):
                try:
                    dates.append(datetime.fromisoformat(d))
                except ValueError:
                    pass

        now = datetime.now(timezone.utc)
        window_start = min(dates) if dates else now
        window_end = max(dates) if dates else now

        # Build user content for LLM (only messages with text)
        text_lines = [
            f"[{m.get('sender', '?')}] {m.get('text', '')}"
            for m in messages
            if m.get("text")
        ]
        if not text_lines:
            log.debug("No text content in buffer", group=group_name)
            return

        user_content = (
            f"群: {group_name}\n"
            f"时间窗口: {window_start.isoformat()} ~ {window_end.isoformat()}\n"
            f"消息数: {len(text_lines)}\n\n"
            + "\n".join(text_lines[:200])  # Cap to avoid exceeding prompt limits
        )

        # 3b. Call LLM
        t0 = time.time()
        analysis_run = LlmAnalysisRun(
            run_type="telegram",
            input_count=len(messages),
            model="deepseek-chat",
            status="running",
        )

        try:
            result = await llm_client.analyze(TG_ANALYSIS_PROMPT, user_content)
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
                "LLM analysis failed for Telegram group",
                group=group_name,
                error=str(exc),
            )
            return

        if not result:
            analysis_run.status = "empty_response"
            analysis_run.completed_at = datetime.now(timezone.utc)
            async with async_session_factory() as session:
                session.add(analysis_run)
                await session.commit()
            return

        # 3c. Build TelegramSignal from LLM result
        signal = TelegramSignal(
            group_config_id=group_config.id if group_config else None,
            group_name=group_name,
            window_start=window_start,
            window_end=window_end,
            message_count=len(messages),
            tokens_mentioned=result.get("tokens_mentioned"),
            group_sentiment=result.get("group_sentiment"),
            fomo_score=_safe_float(result.get("fomo_score")),
            spam_ratio=_safe_float(result.get("spam_ratio")),
            analysis_summary=result.get("summary"),
        )

        # 3d. Persist signal + analysis run
        async with async_session_factory() as session:
            session.add(signal)
            session.add(analysis_run)
            await session.commit()

        log.info(
            "Telegram group analyzed",
            group=group_name,
            messages=len(messages),
            sentiment=result.get("group_sentiment"),
            fomo=result.get("fomo_score"),
        )


telegram_analyzer = TelegramAnalyzer()
