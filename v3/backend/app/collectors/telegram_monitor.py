import asyncio
import json
import os
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat, User

from app.collectors.base import BaseCollector
from app.config import settings
from app.infra.redis_client import get_redis
from app.models.base import async_session_factory
from app.models.config import TelegramGroupConfig
from app.utils.logger import get_logger

log = get_logger(__name__)

SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "sessions")
SESSION_PATH = os.path.join(SESSION_DIR, "telethon")

REDIS_PREFIX = "collector:telegram"


class TelegramCollector(BaseCollector):
    name = "telegram_monitor"
    default_interval = 60  # Health-check interval; actual collection is event-driven

    def __init__(self):
        super().__init__()
        self.client: TelegramClient | None = None
        self.buffer: dict[int, list[dict]] = defaultdict(list)
        self._monitored_ids: set[int] = set()
        self._flush_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self):
        if not settings.TG_API_ID or not settings.TG_API_HASH:
            log.warning("Telegram API credentials not configured – skipping start")
            return

        # Ensure session directory exists
        os.makedirs(SESSION_DIR, exist_ok=True)

        self.client = TelegramClient(
            SESSION_PATH,
            settings.TG_API_ID,
            settings.TG_API_HASH,
        )

        try:
            await self.client.start(phone=settings.TG_PHONE or None)
            log.info("Telegram client connected")
        except Exception as exc:
            log.error("Telegram client failed to start", error=str(exc))
            return

        # Load monitored groups and register handler
        await self._load_groups()
        self._register_handler()

        # Background task to periodically flush buffered messages
        self._flush_task = asyncio.create_task(self._flush_loop())

        await super().start()

    async def stop(self):
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()

        # Flush any remaining buffered messages
        await self._flush_all_buffers()

        if self.client and self.client.is_connected():
            await self.client.disconnect()
            log.info("Telegram client disconnected")

        await super().stop()

    # ------------------------------------------------------------------
    # collect() – periodic health check
    # ------------------------------------------------------------------

    async def collect(self):
        """Lightweight health check. Actual collection is event-driven."""
        total_buffered = sum(len(msgs) for msgs in self.buffer.values())
        groups_count = len(self._monitored_ids)

        redis = await get_redis()
        await redis.hset(
            f"{REDIS_PREFIX}:health",
            mapping={
                "monitored_groups": str(groups_count),
                "buffered_messages": str(total_buffered),
                "connected": str(self.client.is_connected() if self.client else False),
                "ts": str(datetime.now(timezone.utc).isoformat()),
            },
        )
        await redis.expire(f"{REDIS_PREFIX}:health", 120)

        log.debug(
            "Telegram health check",
            groups=groups_count,
            buffered=total_buffered,
        )

        # Periodically reload group list (in case admin added new ones)
        await self._load_groups()

    # ------------------------------------------------------------------
    # Group management
    # ------------------------------------------------------------------

    async def _load_groups(self):
        """Load active Telegram groups from DB and resolve their entity IDs."""
        async with async_session_factory() as session:
            result = await session.execute(
                select(TelegramGroupConfig).where(
                    TelegramGroupConfig.is_active.is_(True),
                )
            )
            groups = list(result.scalars().all())

        if not groups:
            log.debug("No active Telegram groups configured")
            return

        for group in groups:
            try:
                await self._ensure_group_id(group)
            except Exception as exc:
                log.error(
                    "Failed to resolve Telegram group",
                    group_link=group.group_link,
                    error=str(exc),
                )

    async def _ensure_group_id(self, group: TelegramGroupConfig):
        """Resolve and persist the numeric group_id if not yet known."""
        if group.group_id and group.group_id in self._monitored_ids:
            return  # Already resolved and tracked

        if not self.client:
            return

        if group.group_id:
            self._monitored_ids.add(group.group_id)
            return

        # Resolve entity by link
        try:
            entity = await self.client.get_entity(group.group_link)
        except Exception as exc:
            log.warning(
                "Cannot resolve entity for group",
                group_link=group.group_link,
                error=str(exc),
            )
            return

        entity_id = self._extract_entity_id(entity)
        if entity_id is None:
            return

        self._monitored_ids.add(entity_id)

        # Persist resolved ID back to DB
        async with async_session_factory() as session:
            db_group = await session.get(TelegramGroupConfig, group.id)
            if db_group:
                db_group.group_id = entity_id
                if hasattr(entity, "title"):
                    db_group.group_name = entity.title
                await session.commit()

        log.info(
            "Resolved Telegram group",
            group_link=group.group_link,
            group_id=entity_id,
        )

    @staticmethod
    def _extract_entity_id(entity) -> int | None:
        if isinstance(entity, (Channel, Chat)):
            return entity.id
        if isinstance(entity, User):
            return entity.id
        if hasattr(entity, "id"):
            return entity.id
        return None

    # ------------------------------------------------------------------
    # Event-driven message collection
    # ------------------------------------------------------------------

    def _register_handler(self):
        if not self.client:
            return

        @self.client.on(events.NewMessage)
        async def _on_new_message(event):
            try:
                await self._handle_message(event)
            except Exception as exc:
                log.error("Error handling Telegram message", error=str(exc))

    async def _handle_message(self, event):
        """Buffer incoming messages from monitored groups."""
        chat = await event.get_chat()
        chat_id = getattr(chat, "id", None)
        if chat_id is None:
            return

        # Only process messages from monitored groups
        if chat_id not in self._monitored_ids:
            return

        sender = await event.get_sender()
        sender_name = ""
        if sender:
            sender_name = getattr(sender, "username", "") or getattr(
                sender, "first_name", ""
            )

        msg_data = {
            "message_id": event.message.id,
            "chat_id": chat_id,
            "chat_title": getattr(chat, "title", str(chat_id)),
            "sender": sender_name,
            "text": event.message.text or "",
            "date": event.message.date or datetime.now(timezone.utc),
        }

        self.buffer[chat_id].append(msg_data)

        log.debug(
            "Buffered Telegram message",
            chat_id=chat_id,
            sender=sender_name,
            text_len=len(msg_data["text"]),
        )

    # ------------------------------------------------------------------
    # Buffer flush – persist to Redis for downstream analysis
    # ------------------------------------------------------------------

    async def _flush_loop(self):
        """Periodically flush message buffers to Redis."""
        while self._running:
            try:
                await asyncio.sleep(30)  # Flush every 30 seconds
                await self._flush_all_buffers()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                log.error("Error in flush loop", error=str(exc))

    async def _flush_all_buffers(self):
        """Flush all buffered messages to Redis for the analysis pipeline."""
        if not self.buffer:
            return

        redis = await get_redis()
        total_flushed = 0

        for chat_id, messages in list(self.buffer.items()):
            if not messages:
                continue

            # Store messages as a Redis list for the analysis pipeline to consume
            key = f"{REDIS_PREFIX}:messages:{chat_id}"

            for msg in messages:
                serialized = json.dumps(
                    {
                        "message_id": msg["message_id"],
                        "chat_id": msg["chat_id"],
                        "chat_title": msg["chat_title"],
                        "sender": msg["sender"],
                        "text": msg["text"],
                        "date": msg["date"].isoformat()
                        if isinstance(msg["date"], datetime)
                        else str(msg["date"]),
                    }
                )
                await redis.rpush(key, serialized)

            # Keep the list trimmed to last 500 messages per group
            await redis.ltrim(key, -500, -1)
            await redis.expire(key, 86400)  # 24-hour TTL

            # Update per-group message counter
            counter_key = f"{REDIS_PREFIX}:count:{chat_id}"
            await redis.incrby(counter_key, len(messages))
            await redis.expire(counter_key, 86400)

            total_flushed += len(messages)

        # Clear buffers after flushing
        self.buffer.clear()

        if total_flushed:
            log.info("Flushed Telegram messages to Redis", count=total_flushed)
