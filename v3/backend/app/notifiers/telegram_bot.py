from telegram import Bot
from app.config import settings
from app.models.analysis import OpportunityScore
from app.models.signal import OnchainEvent
from app.utils.logger import get_logger

log = get_logger(__name__)


class TelegramNotifier:
    def __init__(self) -> None:
        self.bot = Bot(token=settings.TG_BOT_TOKEN) if settings.TG_BOT_TOKEN else None
        self.chat_id = settings.TG_OWNER_CHAT_ID

    async def send_opportunity_alert(self, score: OpportunityScore) -> None:
        if not self.bot or not self.chat_id:
            return

        text = (
            f"🎯 *机会信号*\n\n"
            f"Token: `{score.token_symbol}` ({score.chain})\n"
            f"综合评分: *{score.total_score:.1f}* / 100\n"
            f"方向: {score.direction}\n"
            f"市场状态: {score.regime}\n\n"
            f"📊 分项:\n"
            f"  KOL: {score.kol_score:.0f} | 聪明钱: {score.smart_money_score:.0f}\n"
            f"  社群: {score.social_score:.0f} | 链上: {score.onchain_score:.0f}\n\n"
            f"💡 {score.reasoning}\n\n"
            f"⏰ {score.scored_at.strftime('%H:%M:%S')}"
        )
        try:
            await self.bot.send_message(
                chat_id=self.chat_id, text=text, parse_mode="Markdown",
            )
        except Exception as e:
            log.error("Failed to send TG alert", error=str(e))

    async def send_smart_money_alert(self, event: OnchainEvent) -> None:
        if not self.bot or not self.chat_id:
            return

        usd_str = f"${float(event.usd_value):,.0f}" if event.usd_value else "N/A"
        dex_info = f" via {event.dex_name}" if event.dex_name else ""
        tag_info = f"  标签: {event.behavior_tag}\n" if event.behavior_tag else ""

        text = (
            f"🐋 *聪明钱动态*\n\n"
            f"链: {event.chain} | 类型: {event.event_type}{dex_info}\n"
            f"钱包: `{event.wallet_address}`\n"
            f"交易: {event.from_token} → {event.to_token}\n"
            f"金额: {usd_str}\n"
            f"{tag_info}"
            f"TX: `{event.tx_hash}`\n\n"
            f"⏰ {event.event_time.strftime('%H:%M:%S')}"
        )
        try:
            await self.bot.send_message(
                chat_id=self.chat_id, text=text, parse_mode="Markdown",
            )
        except Exception as e:
            log.error("Failed to send smart money TG alert", error=str(e))

    async def send_system_alert(self, title: str, message: str) -> None:
        if not self.bot or not self.chat_id:
            return

        text = f"⚠️ *系统通知*\n\n*{title}*\n{message}"
        try:
            await self.bot.send_message(
                chat_id=self.chat_id, text=text, parse_mode="Markdown",
            )
        except Exception as e:
            log.error("Failed to send system TG alert", error=str(e))


telegram_notifier = TelegramNotifier()
