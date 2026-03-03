import httpx

from app.config import settings
from app.utils.logger import get_logger

log = get_logger(__name__)


class TelegramNotifier:
    """Send alerts via Telegram Bot API."""

    async def send_opportunity_alert(self, score) -> None:
        """Send a high-score opportunity alert to the configured Telegram chat."""
        token = settings.TG_BOT_TOKEN
        chat_id = settings.TG_OWNER_CHAT_ID
        if not token or not chat_id:
            log.warning("Telegram bot not configured, skipping alert")
            return

        text = (
            f"🚨 *High Score Alert*\n"
            f"Token: `{score.token_symbol}`\n"
            f"Score: `{score.total_score}`\n"
            f"Regime: `{score.regime}`\n"
            f"Direction: `{score.direction}`"
        )
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        try:
            async with httpx.AsyncClient() as client:
                await client.post(url, json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown",
                })
            log.info("Telegram alert sent", token=score.token_symbol)
        except Exception as exc:
            log.error("Telegram send failed", error=str(exc))


telegram_notifier = TelegramNotifier()
