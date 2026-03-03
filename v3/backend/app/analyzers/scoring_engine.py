from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models.base import async_session_factory
from app.models.config import SystemConfig
from app.models.analysis import OpportunityScore
from app.models.signal import KolTweet, OnchainEvent, TelegramSignal
from app.infra.redis_client import get_redis
from app.notifiers.telegram_notifier import telegram_notifier
from app.notifiers.ws_pusher import ws_pusher
from app.utils.logger import get_logger

log = get_logger(__name__)

# Default weights if SystemConfig is missing
_DEFAULT_WEIGHTS = {
    "kol": 0.25,
    "smart_money": 0.25,
    "social": 0.15,
    "onchain": 0.15,
    "liquidity": 0.10,
    "price_momentum": 0.10,
}


class ScoringEngine:
    """Aggregate multi-dimensional signals into a single opportunity score."""

    async def run(self) -> None:
        """Score all tokens that appeared in signals within the last hour."""
        weights = await self._load_weights()
        tokens = await self._find_active_tokens()

        if not tokens:
            log.debug("No active tokens to score")
            return

        log.info("Scoring engine started", token_count=len(tokens))
        scores: list[OpportunityScore] = []
        async with async_session_factory() as session:
            for symbol in tokens:
                try:
                    score = await self._score_token(symbol, weights)
                    session.add(score)
                    scores.append(score)
                except Exception as exc:
                    log.error("Failed to score token", symbol=symbol, error=str(exc))

            await session.commit()

        await self._notify_and_broadcast(scores)

        log.info("Scoring engine complete", scored=len(scores))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _load_weights(self) -> dict[str, float]:
        """Load scoring weights from SystemConfig, fallback to defaults."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(SystemConfig).where(SystemConfig.key == "scoring_weights")
            )
            config = result.scalar_one_or_none()
            if config and isinstance(config.value, dict):
                return config.value
        return _DEFAULT_WEIGHTS.copy()

    async def _load_notification_threshold(self) -> float:
        """Load notification threshold from SystemConfig, default 70."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(SystemConfig).where(SystemConfig.key == "notification_threshold")
            )
            config = result.scalar_one_or_none()
            if config and isinstance(config.value, dict):
                return float(config.value.get("threshold", 70.0))
        return 70.0

    async def _notify_and_broadcast(self, scores: list[OpportunityScore]) -> None:
        """Send notifications for high scores and broadcast all via WebSocket."""
        if not scores:
            return

        threshold = await self._load_notification_threshold()
        redis = await get_redis()

        for score in scores:
            try:
                score_data = {
                    "token_symbol": score.token_symbol,
                    "token_address": score.token_address,
                    "chain": score.chain,
                    "kol_score": score.kol_score,
                    "smart_money_score": score.smart_money_score,
                    "social_score": score.social_score,
                    "onchain_score": score.onchain_score,
                    "liquidity_score": score.liquidity_score,
                    "crowdedness_penalty": score.crowdedness_penalty,
                    "manipulation_penalty": score.manipulation_penalty,
                    "total_score": score.total_score,
                    "regime": score.regime,
                    "direction": score.direction,
                    "signal_snapshot": score.signal_snapshot,
                }
                await ws_pusher.broadcast("new_score", score_data)

                if score.total_score >= threshold:
                    cooldown_key = f"notify:cooldown:{score.token_symbol}"
                    if not await redis.exists(cooldown_key):
                        await telegram_notifier.send_opportunity_alert(score)
                        await redis.setex(cooldown_key, 3600, "1")  # 1h cooldown
            except Exception as exc:
                log.error("Notification failed", symbol=score.token_symbol, error=str(exc))

    async def _find_active_tokens(self) -> list[str]:
        """Return distinct token symbols mentioned in signals in the last hour."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        symbols: set[str] = set()

        async with async_session_factory() as session:
            # Tokens from KOL tweets
            tweets = await session.execute(
                select(KolTweet)
                .where(
                    KolTweet.is_analyzed.is_(True),
                    KolTweet.tweet_time >= cutoff,
                    KolTweet.tokens_mentioned.isnot(None),
                )
                .limit(200)
            )
            for tweet in tweets.scalars().all():
                mentioned = tweet.tokens_mentioned
                if isinstance(mentioned, list):
                    for tok in mentioned:
                        if isinstance(tok, dict) and tok.get("symbol"):
                            symbols.add(tok["symbol"].upper())

            # Tokens from on-chain events (to_token field)
            events = await session.execute(
                select(OnchainEvent.to_token)
                .where(
                    OnchainEvent.event_time >= cutoff,
                    OnchainEvent.to_token.isnot(None),
                )
                .distinct()
                .limit(200)
            )
            for (token,) in events.all():
                if token:
                    symbols.add(token.upper())

            # Tokens from telegram signals
            tg_signals = await session.execute(
                select(TelegramSignal)
                .where(
                    TelegramSignal.window_end >= cutoff,
                    TelegramSignal.tokens_mentioned.isnot(None),
                )
                .limit(200)
            )
            for sig in tg_signals.scalars().all():
                mentioned = sig.tokens_mentioned
                if isinstance(mentioned, list):
                    for tok in mentioned:
                        if isinstance(tok, dict) and tok.get("symbol"):
                            symbols.add(tok["symbol"].upper())

        return sorted(symbols)

    async def _score_token(
        self, symbol: str, weights: dict[str, float],
    ) -> OpportunityScore:
        """Calculate an aggregated opportunity score for a single token.

        This is a simplified scoring model. Each dimension produces a 0-100
        sub-score, then the weighted total is computed.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)

        kol_score = await self._calc_kol_score(symbol, cutoff)
        smart_money_score = await self._calc_smart_money_score(symbol, cutoff)
        social_score = await self._calc_social_score(symbol, cutoff)
        onchain_score = await self._calc_onchain_score(symbol, cutoff)
        liquidity_score = 50.0  # placeholder — needs price data integration
        crowdedness_penalty = 0.0
        manipulation_penalty = 0.0

        total = (
            kol_score * weights.get("kol", 0.25)
            + smart_money_score * weights.get("smart_money", 0.25)
            + social_score * weights.get("social", 0.15)
            + onchain_score * weights.get("onchain", 0.15)
            + liquidity_score * weights.get("liquidity", 0.10)
            - crowdedness_penalty
            - manipulation_penalty
        )
        total = max(0.0, min(100.0, total))

        # Determine direction from KOL sentiment
        direction = "neutral"
        if kol_score > 60:
            direction = "bullish"
        elif kol_score < 40:
            direction = "bearish"

        # Determine regime based on total score thresholds
        regime = "quiet"
        if total >= 70:
            regime = "mania"
        elif total >= 40:
            regime = "trending"

        return OpportunityScore(
            token_symbol=symbol,
            kol_score=kol_score,
            smart_money_score=smart_money_score,
            social_score=social_score,
            onchain_score=onchain_score,
            liquidity_score=liquidity_score,
            crowdedness_penalty=crowdedness_penalty,
            manipulation_penalty=manipulation_penalty,
            total_score=round(total, 2),
            regime=regime,
            direction=direction,
            signal_snapshot={"weights": weights},
        )

    # ------------------------------------------------------------------
    # Dimension calculators (simplified / mock-level)
    # ------------------------------------------------------------------

    async def _calc_kol_score(self, symbol: str, cutoff: datetime) -> float:
        """Score based on KOL tweet sentiment and signal strength."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(KolTweet)
                .where(
                    KolTweet.is_analyzed.is_(True),
                    KolTweet.tweet_time >= cutoff,
                    KolTweet.tokens_mentioned.isnot(None),
                )
                .limit(200)
            )
            tweets = result.scalars().all()

        scores: list[float] = []
        for tweet in tweets:
            mentioned = tweet.tokens_mentioned
            if not isinstance(mentioned, list):
                continue
            for tok in mentioned:
                if isinstance(tok, dict) and tok.get("symbol", "").upper() == symbol:
                    strength = tweet.signal_strength or 0.5
                    sentiment_val = tweet.sentiment_score or 0.0
                    # Map (-1..1) sentiment + (0..1) strength to 0..100
                    scores.append(((sentiment_val + 1) / 2) * strength * 100)

        if not scores:
            return 50.0
        return min(100.0, sum(scores) / len(scores))

    async def _calc_smart_money_score(self, symbol: str, cutoff: datetime) -> float:
        """Score based on smart-money on-chain activity for this token."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(OnchainEvent)
                .where(
                    OnchainEvent.event_time >= cutoff,
                    OnchainEvent.is_dex_trade.is_(True),
                    OnchainEvent.to_token == symbol,
                )
                .limit(100)
            )
            events = result.scalars().all()

        if not events:
            return 50.0

        # More buy-side trades → higher score
        score = min(100.0, 50.0 + len(events) * 5.0)
        return score

    async def _calc_social_score(self, symbol: str, cutoff: datetime) -> float:
        """Score based on Telegram signal mentions and FOMO."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(TelegramSignal)
                .where(
                    TelegramSignal.window_end >= cutoff,
                    TelegramSignal.tokens_mentioned.isnot(None),
                )
                .limit(100)
            )
            signals = result.scalars().all()

        fomo_scores: list[float] = []
        for sig in signals:
            mentioned = sig.tokens_mentioned
            if not isinstance(mentioned, list):
                continue
            for tok in mentioned:
                if isinstance(tok, dict) and tok.get("symbol", "").upper() == symbol:
                    fomo_scores.append((sig.fomo_score or 0.5) * 100)

        if not fomo_scores:
            return 50.0
        return min(100.0, sum(fomo_scores) / len(fomo_scores))

    async def _calc_onchain_score(self, symbol: str, cutoff: datetime) -> float:
        """Score based on total on-chain event volume for this token."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(OnchainEvent)
                .where(
                    OnchainEvent.event_time >= cutoff,
                    OnchainEvent.to_token == symbol,
                )
                .limit(200)
            )
            events = result.scalars().all()

        if not events:
            return 50.0

        total_usd = sum(float(e.usd_value or 0) for e in events)
        # Scale: $10k → ~60, $100k → ~80, $1M → ~100
        if total_usd <= 0:
            return 50.0
        import math
        score = 50.0 + 10.0 * math.log10(max(1, total_usd / 1000))
        return min(100.0, max(0.0, score))


scoring_engine = ScoringEngine()
