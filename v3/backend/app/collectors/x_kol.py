import json
from datetime import datetime, timezone

from sqlalchemy import select
from twikit import Client

from app.collectors.base import BaseCollector
from app.config import settings
from app.infra.redis_client import get_redis
from app.models.base import async_session_factory
from app.models.config import KolConfig
from app.models.signal import KolTweet
from app.utils.logger import get_logger

log = get_logger(__name__)

REDIS_PREFIX = "collector:x_kol"


class XKolCollector(BaseCollector):
    name = "x_kol"
    default_interval = 120

    def __init__(self):
        super().__init__()
        self.client = Client("en-US")
        self.accounts: list[dict] = (
            json.loads(settings.X_ACCOUNTS) if settings.X_ACCOUNTS else []
        )
        self.current_account_idx = 0
        self.logged_in = False

    # ------------------------------------------------------------------
    # Auth helpers
    # ------------------------------------------------------------------

    async def _login(self):
        """Login to X using the current account credentials."""
        if not self.accounts:
            log.warning("No X accounts configured – skipping login")
            return

        acct = self.accounts[self.current_account_idx]
        try:
            await self.client.login(
                auth_info_1=acct["username"],
                auth_info_2=acct.get("email", ""),
                password=acct["password"],
            )
            self.logged_in = True
            log.info("X login success", username=acct["username"])
        except Exception as exc:
            log.error("X login failed", username=acct["username"], error=str(exc))
            self.logged_in = False
            self._rotate_account()

    def _rotate_account(self):
        """Switch to the next available account."""
        if len(self.accounts) <= 1:
            return
        self.current_account_idx = (self.current_account_idx + 1) % len(self.accounts)
        self.logged_in = False
        log.info(
            "Rotated X account",
            new_idx=self.current_account_idx,
        )

    # ------------------------------------------------------------------
    # Core collection
    # ------------------------------------------------------------------

    async def collect(self):
        if not self.accounts:
            log.debug("No X accounts configured – skipping collection")
            return

        if not self.logged_in:
            await self._login()
        if not self.logged_in:
            return

        kols = await self._get_active_kols()
        if not kols:
            log.debug("No active KOLs to monitor")
            return

        redis = await get_redis()

        for kol in kols:
            try:
                await self._collect_kol(kol, redis)
            except Exception as exc:
                log.error(
                    "Error collecting KOL tweets",
                    username=kol.username,
                    error=str(exc),
                )
                # On auth errors, rotate account and retry next cycle
                err_msg = str(exc).lower()
                if "unauthorized" in err_msg or "403" in err_msg:
                    self._rotate_account()
                    break

    async def _collect_kol(self, kol: KolConfig, redis) -> None:
        """Fetch latest tweets for a single KOL and persist new ones."""
        # Resolve user_id if not yet stored
        user_id = kol.user_id
        if not user_id:
            user_id = await self._resolve_user_id(kol)
            if not user_id:
                log.warning("Could not resolve user_id", username=kol.username)
                return

        # Fetch recent tweets
        try:
            tweets = await self.client.get_user_tweets(user_id, "Tweets", count=5)
        except Exception as exc:
            log.error(
                "Failed to fetch tweets",
                user_id=user_id,
                username=kol.username,
                error=str(exc),
            )
            raise

        if not tweets:
            return

        # Determine which tweets are new
        last_key = f"{REDIS_PREFIX}:last_tweet:{kol.username}"
        last_tweet_id = await redis.get(last_key)

        new_tweets = []
        for tweet in tweets:
            tid = str(tweet.id)
            if last_tweet_id and tid <= last_tweet_id:
                break
            new_tweets.append(tweet)

        if not new_tweets:
            return

        # Persist new tweets
        async with async_session_factory() as session:
            for tweet in reversed(new_tweets):  # oldest first
                # Skip if already exists (unique constraint on tweet_id)
                existing = await session.execute(
                    select(KolTweet.id).where(KolTweet.tweet_id == str(tweet.id))
                )
                if existing.scalar_one_or_none() is not None:
                    continue

                tweet_time = self._parse_tweet_time(tweet)

                media_urls = None
                if hasattr(tweet, "media") and tweet.media:
                    media_urls = [
                        m.get("media_url_https", m.get("url", ""))
                        for m in (tweet.media if isinstance(tweet.media, list) else [])
                    ]

                metrics = None
                if hasattr(tweet, "favorite_count"):
                    metrics = {
                        "likes": getattr(tweet, "favorite_count", 0),
                        "retweets": getattr(tweet, "retweet_count", 0),
                        "replies": getattr(tweet, "reply_count", 0),
                        "views": getattr(tweet, "view_count", 0),
                    }

                record = KolTweet(
                    tweet_id=str(tweet.id),
                    kol_config_id=kol.id,
                    username=kol.username,
                    content=tweet.text or "",
                    media_urls=media_urls,
                    metrics=metrics,
                    tweet_time=tweet_time,
                    is_analyzed=False,
                )
                session.add(record)

            await session.commit()

        # Update Redis cursor to the newest tweet
        newest_id = str(new_tweets[0].id)
        await redis.set(last_key, newest_id, ex=86400 * 7)  # 7-day TTL

        log.info(
            "Saved new KOL tweets",
            username=kol.username,
            count=len(new_tweets),
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_active_kols(self) -> list[KolConfig]:
        async with async_session_factory() as session:
            result = await session.execute(
                select(KolConfig).where(
                    KolConfig.is_active.is_(True),
                    KolConfig.platform == "x",
                )
            )
            return list(result.scalars().all())

    async def _resolve_user_id(self, kol: KolConfig) -> str | None:
        """Fetch user_id by screen_name via twikit and persist it."""
        try:
            user = await self.client.get_user_by_screen_name(kol.username)
            if not user:
                return None

            user_id = str(user.id)

            async with async_session_factory() as session:
                db_kol = await session.get(KolConfig, kol.id)
                if db_kol:
                    db_kol.user_id = user_id
                    db_kol.display_name = getattr(user, "name", None)
                    await session.commit()

            log.info(
                "Resolved X user_id",
                username=kol.username,
                user_id=user_id,
            )
            return user_id
        except Exception as exc:
            log.error(
                "Failed to resolve user_id",
                username=kol.username,
                error=str(exc),
            )
            return None

    @staticmethod
    def _parse_tweet_time(tweet) -> datetime:
        """Extract tweet creation time, falling back to utcnow."""
        raw = getattr(tweet, "created_at", None)
        if raw is None:
            return datetime.now(timezone.utc)
        if isinstance(raw, datetime):
            return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
        try:
            # Twitter's date format: "Thu Oct 14 00:00:00 +0000 2021"
            return datetime.strptime(str(raw), "%a %b %d %H:%M:%S %z %Y")
        except (ValueError, TypeError):
            return datetime.now(timezone.utc)
