"""initial schema - all tables

Revision ID: 0001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── kol_configs ─────────────────────────────────────────────────────
    op.create_table(
        "kol_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("platform", sa.String(20), server_default="x", nullable=False),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("user_id", sa.String(50), nullable=True),
        sa.Column("display_name", sa.String(200), nullable=True),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("reliability", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )

    # ── wallet_configs ──────────────────────────────────────────────────
    op.create_table(
        "wallet_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("address", sa.String(100), nullable=False),
        sa.Column("chain", sa.String(20), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("wallet_type", sa.String(50), server_default="smart_money", nullable=False),
        sa.Column("reliability", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("address", "chain", name="uq_wallet_address_chain"),
    )

    # ── telegram_group_configs ──────────────────────────────────────────
    op.create_table(
        "telegram_group_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("group_id", sa.BigInteger(), nullable=True),
        sa.Column("group_link", sa.String(200), nullable=False),
        sa.Column("group_name", sa.String(200), nullable=True),
        sa.Column("group_type", sa.String(20), server_default="group", nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_link"),
    )

    # ── system_configs ──────────────────────────────────────────────────
    op.create_table(
        "system_configs",
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("value", JSONB(), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )

    # ── kol_tweets ──────────────────────────────────────────────────────
    op.create_table(
        "kol_tweets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tweet_id", sa.String(50), nullable=False),
        sa.Column("kol_config_id", sa.Integer(), sa.ForeignKey("kol_configs.id"), nullable=True),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("media_urls", JSONB(), nullable=True),
        sa.Column("metrics", JSONB(), nullable=True),
        sa.Column("tweet_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_analyzed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("tokens_mentioned", JSONB(), nullable=True),
        sa.Column("sentiment", sa.String(20), nullable=True),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("signal_strength", sa.Float(), nullable=True),
        sa.Column("analysis_summary", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tweet_id"),
    )
    op.create_index("ix_kol_tweets_tweet_time", "kol_tweets", ["tweet_time"])
    op.create_index(
        "ix_kol_tweets_not_analyzed",
        "kol_tweets",
        ["is_analyzed"],
        postgresql_where=sa.text("is_analyzed = false"),
    )

    # ── telegram_signals ────────────────────────────────────────────────
    op.create_table(
        "telegram_signals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("group_config_id", sa.Integer(), sa.ForeignKey("telegram_group_configs.id"), nullable=True),
        sa.Column("group_name", sa.String(200), nullable=True),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("message_count", sa.Integer(), nullable=True),
        sa.Column("tokens_mentioned", JSONB(), nullable=True),
        sa.Column("group_sentiment", sa.String(20), nullable=True),
        sa.Column("fomo_score", sa.Float(), nullable=True),
        sa.Column("spam_ratio", sa.Float(), nullable=True),
        sa.Column("analysis_summary", sa.Text(), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_telegram_signals_window_end", "telegram_signals", ["window_end"])

    # ── onchain_events ──────────────────────────────────────────────────
    op.create_table(
        "onchain_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chain", sa.String(20), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("wallet_config_id", sa.Integer(), sa.ForeignKey("wallet_configs.id"), nullable=True),
        sa.Column("wallet_address", sa.String(100), nullable=True),
        sa.Column("tx_hash", sa.String(100), nullable=True),
        sa.Column("block_number", sa.BigInteger(), nullable=True),
        sa.Column("from_token", sa.String(100), nullable=True),
        sa.Column("to_token", sa.String(100), nullable=True),
        sa.Column("from_amount", sa.Numeric(), nullable=True),
        sa.Column("to_amount", sa.Numeric(), nullable=True),
        sa.Column("usd_value", sa.Numeric(), nullable=True),
        sa.Column("behavior_tag", sa.String(50), nullable=True),
        sa.Column("is_dex_trade", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("dex_name", sa.String(50), nullable=True),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_onchain_events_chain_time", "onchain_events", ["chain", "event_time"])
    op.create_index("ix_onchain_events_wallet", "onchain_events", ["wallet_address"])

    # ── price_snapshots ─────────────────────────────────────────────────
    op.create_table(
        "price_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_symbol", sa.String(50), nullable=False),
        sa.Column("token_address", sa.String(100), nullable=True),
        sa.Column("chain", sa.String(20), nullable=True),
        sa.Column("price_usd", sa.Numeric(), nullable=True),
        sa.Column("volume_24h", sa.Numeric(), nullable=True),
        sa.Column("volume_5m", sa.Numeric(), nullable=True),
        sa.Column("liquidity_usd", sa.Numeric(), nullable=True),
        sa.Column("price_change_5m", sa.Float(), nullable=True),
        sa.Column("price_change_1h", sa.Float(), nullable=True),
        sa.Column("price_change_24h", sa.Float(), nullable=True),
        sa.Column("buy_count_5m", sa.Integer(), nullable=True),
        sa.Column("sell_count_5m", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_price_snapshots_symbol_time", "price_snapshots", ["token_symbol", "snapshot_at"])

    # ── llm_analysis_runs ───────────────────────────────────────────────
    op.create_table(
        "llm_analysis_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_type", sa.String(50), nullable=False),
        sa.Column("input_count", sa.Integer(), nullable=True),
        sa.Column("model", sa.String(50), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), server_default="running", nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── opportunity_scores ──────────────────────────────────────────────
    op.create_table(
        "opportunity_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_symbol", sa.String(50), nullable=False),
        sa.Column("token_address", sa.String(100), nullable=True),
        sa.Column("chain", sa.String(20), nullable=True),
        sa.Column("kol_score", sa.Float(), server_default="0", nullable=False),
        sa.Column("smart_money_score", sa.Float(), server_default="0", nullable=False),
        sa.Column("social_score", sa.Float(), server_default="0", nullable=False),
        sa.Column("onchain_score", sa.Float(), server_default="0", nullable=False),
        sa.Column("liquidity_score", sa.Float(), server_default="0", nullable=False),
        sa.Column("crowdedness_penalty", sa.Float(), server_default="0", nullable=False),
        sa.Column("manipulation_penalty", sa.Float(), server_default="0", nullable=False),
        sa.Column("total_score", sa.Float(), nullable=False),
        sa.Column("regime", sa.String(20), nullable=True),
        sa.Column("direction", sa.String(20), nullable=True),
        sa.Column("signal_snapshot", JSONB(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("scored_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_opportunity_scores_symbol_time", "opportunity_scores", ["token_symbol", "scored_at"])
    op.create_index("ix_opportunity_scores_total", "opportunity_scores", ["total_score"])

    # ── notification_logs ───────────────────────────────────────────────
    op.create_table(
        "notification_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=True),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("related_token", sa.String(50), nullable=True),
        sa.Column("related_score", sa.Float(), nullable=True),
        sa.Column("is_sent", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Seed default system_configs ─────────────────────────────────────
    op.execute(
        """
        INSERT INTO system_configs (key, value, description) VALUES
        (
            'scoring_weights',
            '{"kol": 0.25, "smart_money": 0.25, "social": 0.15, "onchain": 0.15, "liquidity": 0.10, "price_momentum": 0.10}',
            'Weights for opportunity scoring dimensions'
        ),
        (
            'notification_rules',
            '{"min_score": 75, "channels": ["telegram", "web"], "cooldown_minutes": 30}',
            'Rules governing when and how notifications are sent'
        ),
        (
            'collector_intervals',
            '{"x_kol": 120, "telegram": 10, "onchain_bsc": 2, "onchain_sol": 2, "price_quote": 30}',
            'Data collection intervals in seconds per collector'
        ),
        (
            'llm_config',
            '{"model": "deepseek-chat", "batch_interval": 300, "max_tokens": 2000}',
            'LLM analysis configuration'
        ),
        (
            'regime_thresholds',
            '{"quiet_max_score": 40, "trending_min_score": 40, "mania_min_score": 70}',
            'Score thresholds for market regime classification'
        )
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_table("notification_logs")
    op.drop_table("opportunity_scores")
    op.drop_table("llm_analysis_runs")
    op.drop_table("price_snapshots")
    op.drop_table("onchain_events")
    op.drop_table("telegram_signals")
    op.drop_table("kol_tweets")
    op.drop_table("system_configs")
    op.drop_table("telegram_group_configs")
    op.drop_table("wallet_configs")
    op.drop_table("kol_configs")
