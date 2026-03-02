# V3 信号采集与分析平台 — 实施技术方案

> 基于 V3_AUTOTRADING_SYSTEM_ARCHITECTURE.md 的讨论成果，聚焦"信号采集 + LLM 分析"阶段。
> 交易执行模块暂不实现。

---

## 1. 项目总览

### 1.1 系统目标

构建一个单用户加密货币信号采集与智能分析平台：

- **采集**：X/Twitter KOL 动态、Telegram 群消息、BSC/Solana 链上聪明钱流向、代币行情
- **分析**：DeepSeek LLM 5 分钟批量分析，提取情绪、token 提及、行为标签
- **评分**：多维度 OpportunityScore 评分引擎
- **通知**：Web 看板实时展示 + Telegram Bot 高分信号推送

### 1.2 系统边界（明确不做）

- ❌ 自动交易 / 下单 / 签名
- ❌ 资金管理 / 仓位跟踪
- ❌ 多用户 / 认证系统
- ❌ 付费 API（全部使用免费方案 + 号池轮换）

### 1.3 技术栈

| 层级 | 技术 |
|---|---|
| 后端 | Python 3.11+ / FastAPI / SQLAlchemy / Alembic |
| 前端 | React 18 / Ant Design 5 / Vite / React Router |
| 数据库 | PostgreSQL 15 / Redis 7 |
| LLM | DeepSeek Chat V3（OpenAI 兼容接口） |
| X 采集 | twikit（主力）/ twscrape（备用） |
| TG 监控 | Telethon（User Client） |
| TG 通知 | python-telegram-bot（Bot API） |
| BSC 数据 | BscScan + NodeReal + Moralis 号池 |
| Solana 数据 | Helius + Alchemy + 公共 RPC 号池 |
| 行情 | DEXScreener + Birdeye（免费无 key） |
| 部署 | Docker Compose 单机 |

### 1.4 模块拆分

```
┌─────────────────────────────────────────────────────────────┐
│                        系统模块全景                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────── 采集层 ────────────────────┐         │
│  │  x_kol_collector        (X/Twitter KOL 监控)   │         │
│  │  telegram_collector     (Telegram 群监控)       │         │
│  │  onchain_bsc_collector  (BSC 链上数据)          │         │
│  │  onchain_sol_collector  (Solana 链上数据)       │         │
│  │  price_quote_collector  (行情/报价)             │         │
│  └────────────────────────────────────────────────┘         │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────── 分析层 ────────────────────┐         │
│  │  llm_analyzer           (DeepSeek 批量分析)     │         │
│  │  scoring_engine         (OpportunityScore 计算) │         │
│  │  signal_aggregator      (多源信号融合)          │         │
│  └────────────────────────────────────────────────┘         │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────── 通知层 ────────────────────┐         │
│  │  telegram_notifier      (TG Bot 推送)           │         │
│  │  websocket_pusher       (Web 实时推送)          │         │
│  └────────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────────── 基础设施 ──────────────────┐         │
│  │  api_key_pool           (API Key 池管理)        │         │
│  │  scheduler              (定时任务调度)          │         │
│  │  config_manager         (配置管理)              │         │
│  │  db / cache             (PostgreSQL / Redis)    │         │
│  └────────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────────── API 层 ────────────────────┐         │
│  │  FastAPI REST + WebSocket                       │         │
│  └────────────────────────────────────────────────┘         │
│                                                             │
│  ┌──────────────────── 前端 ──────────────────────┐         │
│  │  React + Ant Design (Dashboard / Config / Feed) │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 项目目录结构

```
v3-signal-platform/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml              # Poetry / pip 依赖
│   ├── alembic.ini                 # DB 迁移配置
│   ├── alembic/
│   │   └── versions/               # 迁移脚本
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI 入口
│   │   ├── config.py               # 配置加载（from .env）
│   │   ├── dependencies.py         # FastAPI 依赖注入
│   │   │
│   │   ├── models/                 # SQLAlchemy ORM 模型
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # Base, engine, session
│   │   │   ├── config.py           # kol_configs, wallet_configs, tg_group_configs
│   │   │   ├── signal.py           # kol_tweets, onchain_events, tg_analysis_results
│   │   │   ├── analysis.py         # llm_analyses, opportunity_scores
│   │   │   └── notification.py     # notification_logs
│   │   │
│   │   ├── schemas/                # Pydantic schemas (request/response)
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── signal.py
│   │   │   ├── analysis.py
│   │   │   └── notification.py
│   │   │
│   │   ├── api/                    # FastAPI routers
│   │   │   ├── __init__.py
│   │   │   ├── router.py           # 聚合所有 router
│   │   │   ├── config_routes.py    # 配置管理 CRUD
│   │   │   ├── signal_routes.py    # 信号数据查询
│   │   │   ├── analysis_routes.py  # 分析结果查询
│   │   │   ├── dashboard_routes.py # 看板数据聚合
│   │   │   ├── system_routes.py    # 健康检查、系统状态
│   │   │   └── ws.py               # WebSocket 端点
│   │   │
│   │   ├── collectors/             # 采集层
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # BaseCollector 抽象基类
│   │   │   ├── x_kol.py            # X/Twitter KOL 采集
│   │   │   ├── telegram_monitor.py # Telegram 群监控
│   │   │   ├── onchain_bsc.py      # BSC 链上采集
│   │   │   ├── onchain_solana.py   # Solana 链上采集
│   │   │   └── price_quote.py      # 行情采集
│   │   │
│   │   ├── analyzers/              # 分析层
│   │   │   ├── __init__.py
│   │   │   ├── llm_client.py       # DeepSeek 客户端封装
│   │   │   ├── tweet_analyzer.py   # 推文分析（情绪、token 提及）
│   │   │   ├── telegram_analyzer.py# TG 消息批量分析
│   │   │   ├── onchain_analyzer.py # 链上行为分析
│   │   │   ├── scoring_engine.py   # OpportunityScore 计算
│   │   │   └── signal_aggregator.py# 多源信号融合
│   │   │
│   │   ├── notifiers/              # 通知层
│   │   │   ├── __init__.py
│   │   │   ├── telegram_bot.py     # Telegram Bot 推送
│   │   │   └── ws_pusher.py        # WebSocket 实时推送
│   │   │
│   │   ├── infra/                  # 基础设施
│   │   │   ├── __init__.py
│   │   │   ├── api_key_pool.py     # API Key 池管理器
│   │   │   ├── redis_client.py     # Redis 封装
│   │   │   ├── scheduler.py        # APScheduler 定时任务
│   │   │   └── rate_limiter.py     # 限流器
│   │   │
│   │   └── utils/                  # 工具函数
│   │       ├── __init__.py
│   │       ├── token_resolver.py   # token symbol/address 标准化
│   │       └── logger.py           # 结构化日志
│   │
│   └── tests/
│       ├── conftest.py
│       ├── test_collectors/
│       ├── test_analyzers/
│       └── test_api/
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes.tsx                # React Router 路由定义
│       ├── vite-env.d.ts
│       │
│       ├── layouts/
│       │   └── MainLayout.tsx        # 侧边栏 + 顶栏布局
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx         # 总览看板
│       │   ├── SignalFeed.tsx         # 实时信号流
│       │   ├── OpportunityList.tsx    # 机会评分排行
│       │   ├── TokenDetail.tsx        # 单 token 详情
│       │   ├── config/
│       │   │   ├── KolConfig.tsx      # KOL 名单管理
│       │   │   ├── WalletConfig.tsx   # Smart Money 地址管理
│       │   │   ├── TelegramConfig.tsx # Telegram 群管理
│       │   │   └── SystemConfig.tsx   # 系统设置（API Keys、通知规则）
│       │   └── analysis/
│       │       ├── AnalysisHistory.tsx # LLM 分析历史
│       │       └── ScoreDetail.tsx     # 评分详情
│       │
│       ├── components/
│       │   ├── SignalCard.tsx          # 信号卡片
│       │   ├── ScoreGauge.tsx          # 分数仪表盘
│       │   ├── TokenTag.tsx            # Token 标签
│       │   ├── ChainBadge.tsx          # 链标识
│       │   ├── StatusIndicator.tsx     # 采集器状态指示
│       │   └── NotificationBell.tsx    # 通知铃铛
│       │
│       ├── services/
│       │   ├── api.ts                  # axios 封装
│       │   ├── ws.ts                   # WebSocket 封装
│       │   └── types.ts               # TypeScript 类型定义
│       │
│       └── styles/
│           └── global.css
│
└── docs/
    ├── V3_AUTOTRADING_SYSTEM_ARCHITECTURE.md  # 原始架构文档
    └── V3_IMPLEMENTATION_PLAN.md               # 本文档
```

---

## 3. 数据库设计

### 3.1 PostgreSQL Schema

#### 配置表（用户输入的监控目标）

```sql
-- KOL 监控名单
CREATE TABLE kol_configs (
    id            SERIAL PRIMARY KEY,
    platform      VARCHAR(20) NOT NULL DEFAULT 'x',       -- 'x' / 'twitter'
    username      VARCHAR(100) NOT NULL UNIQUE,            -- @handle
    user_id       VARCHAR(50),                             -- 平台 user_id (采集后回填)
    display_name  VARCHAR(200),
    label         VARCHAR(100),                            -- 用户备注标签
    reliability   FLOAT DEFAULT 0.5,                       -- 可靠性权重 (0-1)，随分析结果更新
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Smart Money 钱包地址
CREATE TABLE wallet_configs (
    id            SERIAL PRIMARY KEY,
    address       VARCHAR(100) NOT NULL,
    chain         VARCHAR(20) NOT NULL,                    -- 'bsc' / 'solana'
    label         VARCHAR(100),                            -- 用户备注（如 "某大户" "某基金"）
    wallet_type   VARCHAR(50) DEFAULT 'smart_money',       -- 'smart_money' / 'whale' / 'insider'
    reliability   FLOAT DEFAULT 0.5,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(address, chain)
);

-- Telegram 群/频道配置
CREATE TABLE telegram_group_configs (
    id            SERIAL PRIMARY KEY,
    group_id      BIGINT,                                  -- Telegram group/channel numeric ID (采集后回填)
    group_link    VARCHAR(200) NOT NULL UNIQUE,             -- t.me/xxx 或 @xxx
    group_name    VARCHAR(200),
    group_type    VARCHAR(20) DEFAULT 'group',              -- 'group' / 'channel' / 'supergroup'
    label         VARCHAR(100),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### 信号数据表（采集到的原始/半结构化数据）

```sql
-- KOL 推文（全量存储原文）
CREATE TABLE kol_tweets (
    id            SERIAL PRIMARY KEY,
    tweet_id      VARCHAR(50) NOT NULL UNIQUE,              -- Twitter 推文 ID
    kol_config_id INTEGER REFERENCES kol_configs(id),
    username      VARCHAR(100) NOT NULL,
    content       TEXT NOT NULL,                             -- 推文原文
    media_urls    JSONB,                                     -- 图片/视频 URL
    metrics       JSONB,                                     -- {likes, retweets, replies, views}
    tweet_time    TIMESTAMPTZ NOT NULL,                      -- 推文发布时间
    collected_at  TIMESTAMPTZ DEFAULT NOW(),                 -- 采集时间
    -- 以下字段由 LLM 分析填充
    is_analyzed   BOOLEAN DEFAULT FALSE,
    tokens_mentioned JSONB,                                  -- [{symbol, address, chain, confidence}]
    sentiment     VARCHAR(20),                               -- 'bullish' / 'bearish' / 'neutral'
    sentiment_score FLOAT,                                   -- -1.0 ~ 1.0
    signal_strength FLOAT,                                   -- 0 ~ 1.0
    analysis_summary TEXT                                    -- LLM 分析摘要
);
CREATE INDEX idx_kol_tweets_time ON kol_tweets(tweet_time DESC);
CREATE INDEX idx_kol_tweets_analyzed ON kol_tweets(is_analyzed) WHERE NOT is_analyzed;

-- Telegram 分析结果（不存原文，只存分析结果）
CREATE TABLE telegram_signals (
    id              SERIAL PRIMARY KEY,
    group_config_id INTEGER REFERENCES telegram_group_configs(id),
    group_name      VARCHAR(200),
    window_start    TIMESTAMPTZ NOT NULL,                    -- 分析窗口起始
    window_end      TIMESTAMPTZ NOT NULL,                    -- 分析窗口结束
    message_count   INTEGER,                                 -- 窗口内消息数
    tokens_mentioned JSONB,                                  -- [{symbol, mention_count, sentiment}]
    group_sentiment VARCHAR(20),                             -- 'bullish' / 'bearish' / 'neutral'
    fomo_score      FLOAT,                                   -- 0 ~ 100
    spam_ratio      FLOAT,                                   -- 0 ~ 1.0
    analysis_summary TEXT,
    analyzed_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tg_signals_time ON telegram_signals(window_end DESC);

-- 链上事件（Smart Money 交易 + 异常流动）
CREATE TABLE onchain_events (
    id              SERIAL PRIMARY KEY,
    chain           VARCHAR(20) NOT NULL,                    -- 'bsc' / 'solana'
    event_type      VARCHAR(50) NOT NULL,                    -- 'smart_money_trade' / 'large_transfer' / 'liquidity_change'
    wallet_config_id INTEGER REFERENCES wallet_configs(id),
    wallet_address  VARCHAR(100),
    tx_hash         VARCHAR(100),
    block_number    BIGINT,
    -- 交易细节
    from_token      VARCHAR(100),                            -- token symbol 或 address
    to_token        VARCHAR(100),
    from_amount     NUMERIC,
    to_amount       NUMERIC,
    usd_value       NUMERIC,
    -- 分析标签
    behavior_tag    VARCHAR(50),                             -- 'accumulating' / 'distributing' / 'arbitrage' / 'unknown'
    is_dex_trade    BOOLEAN DEFAULT FALSE,
    dex_name        VARCHAR(50),                             -- 'pancakeswap' / 'jupiter' / etc.
    --
    event_time      TIMESTAMPTZ NOT NULL,
    collected_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_onchain_chain_time ON onchain_events(chain, event_time DESC);
CREATE INDEX idx_onchain_wallet ON onchain_events(wallet_address);

-- 行情快照
CREATE TABLE price_snapshots (
    id              SERIAL PRIMARY KEY,
    token_symbol    VARCHAR(50) NOT NULL,
    token_address   VARCHAR(100),
    chain           VARCHAR(20),
    price_usd       NUMERIC,
    volume_24h      NUMERIC,
    volume_5m       NUMERIC,
    liquidity_usd   NUMERIC,
    price_change_5m  FLOAT,
    price_change_1h  FLOAT,
    price_change_24h FLOAT,
    buy_count_5m    INTEGER,
    sell_count_5m   INTEGER,
    source          VARCHAR(50),                             -- 'dexscreener' / 'birdeye'
    snapshot_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_price_token_time ON price_snapshots(token_symbol, snapshot_at DESC);
-- 保留 7 天数据，定期清理
```

#### 分析结果表

```sql
-- LLM 分析任务记录
CREATE TABLE llm_analysis_runs (
    id              SERIAL PRIMARY KEY,
    run_type        VARCHAR(50) NOT NULL,                    -- 'tweet_batch' / 'telegram_batch' / 'onchain_batch' / 'signal_fusion'
    input_count     INTEGER,                                 -- 输入条数
    model           VARCHAR(50),                             -- 'deepseek-chat'
    tokens_used     INTEGER,                                 -- token 消耗
    latency_ms      INTEGER,
    status          VARCHAR(20) DEFAULT 'running',           -- 'running' / 'completed' / 'failed'
    error           TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- 机会评分（核心输出）
CREATE TABLE opportunity_scores (
    id              SERIAL PRIMARY KEY,
    token_symbol    VARCHAR(50) NOT NULL,
    token_address   VARCHAR(100),
    chain           VARCHAR(20),
    -- 分项评分
    kol_score       FLOAT DEFAULT 0,                         -- 0-100
    smart_money_score FLOAT DEFAULT 0,                       -- 0-100
    social_score    FLOAT DEFAULT 0,                          -- 0-100 (TG 群情绪)
    onchain_score   FLOAT DEFAULT 0,                          -- 0-100 (链上动量)
    liquidity_score FLOAT DEFAULT 0,                          -- 0-100
    -- 惩罚项
    crowdedness_penalty FLOAT DEFAULT 0,                      -- 0-100
    manipulation_penalty FLOAT DEFAULT 0,                     -- 0-100
    -- 综合分
    total_score     FLOAT NOT NULL,                           -- 0-100
    regime          VARCHAR(20),                              -- 'quiet' / 'trending' / 'mania'
    direction       VARCHAR(20),                              -- 'bullish' / 'bearish' / 'neutral'
    -- 信号快照
    signal_snapshot JSONB,                                    -- 计算时的所有输入数据快照
    reasoning       TEXT,                                     -- LLM 给出的推理摘要
    --
    scored_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scores_token_time ON opportunity_scores(token_symbol, scored_at DESC);
CREATE INDEX idx_scores_total ON opportunity_scores(total_score DESC);
```

#### 通知表

```sql
-- 通知日志
CREATE TABLE notification_logs (
    id              SERIAL PRIMARY KEY,
    channel         VARCHAR(20) NOT NULL,                    -- 'telegram' / 'web'
    event_type      VARCHAR(50),                             -- 'high_score' / 'smart_money_alert' / 'kol_mention' / 'system'
    title           VARCHAR(200),
    content         TEXT,
    related_token   VARCHAR(50),
    related_score   FLOAT,
    is_sent         BOOLEAN DEFAULT FALSE,
    sent_at         TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### 系统配置表

```sql
-- 系统配置（K-V 结构）
CREATE TABLE system_configs (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL,
    description     VARCHAR(500),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 预置配置项
INSERT INTO system_configs (key, value, description) VALUES
('scoring_weights', '{"kol": 0.25, "smart_money": 0.25, "social": 0.15, "onchain": 0.15, "liquidity": 0.10, "price_momentum": 0.10}', '评分权重'),
('notification_rules', '{"min_score": 75, "channels": ["telegram", "web"], "cooldown_minutes": 30}', '通知触发规则'),
('collector_intervals', '{"x_kol": 120, "telegram": 10, "onchain_bsc": 2, "onchain_sol": 2, "price_quote": 30}', '采集间隔（秒）'),
('llm_config', '{"model": "deepseek-chat", "batch_interval": 300, "max_tokens": 2000}', 'LLM 配置'),
('regime_thresholds', '{"quiet_max_score": 40, "trending_min_score": 40, "mania_min_score": 70}', '市场状态判定阈值');
```

### 3.2 Redis 用途

| Key 模式 | 数据类型 | 用途 | TTL |
|---|---|---|---|
| `api_pool:bsc:keys` | List | BSC API key 可用列表 | 永久 |
| `api_pool:bsc:cooldown:{key_id}` | String | 被限流的 key 冷却标记 | 60s |
| `api_pool:solana:keys` | List | Solana API key 可用列表 | 永久 |
| `collector:status:{name}` | Hash | 采集器运行状态 | 30s |
| `signal:latest:{token}` | Hash | token 最新信号快照 | 5min |
| `score:latest:{token}` | String(JSON) | token 最新评分 | 10min |
| `rate_limit:{provider}:{key}` | String(counter) | 请求计数器 | 按窗口 |
| `ws:broadcast` | Pub/Sub channel | WebSocket 广播通道 | - |
| `tweet:last_id:{kol_username}` | String | 每个 KOL 最后抓取的推文 ID | 永久 |
| `tg:last_msg_id:{group_id}` | String | 每个群最后处理的消息 ID | 永久 |

---

## 4. 采集层详细设计

### 4.1 通用 BaseCollector

```python
# app/collectors/base.py
from abc import ABC, abstractmethod
import asyncio
from app.infra.redis_client import redis
from app.utils.logger import logger

class BaseCollector(ABC):
    """所有采集器的基类"""

    name: str = "base"
    default_interval: int = 10  # 秒

    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self):
        """启动采集循环"""
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"Collector [{self.name}] started, interval={self.default_interval}s")

    async def stop(self):
        """停止采集"""
        self._running = False
        if self._task:
            self._task.cancel()
        logger.info(f"Collector [{self.name}] stopped")

    async def _run_loop(self):
        while self._running:
            try:
                await self._update_status("running")
                await self.collect()
                await self._update_status("idle")
            except Exception as e:
                logger.error(f"Collector [{self.name}] error: {e}")
                await self._update_status("error", str(e))
            await asyncio.sleep(self.default_interval)

    async def _update_status(self, status: str, error: str = ""):
        await redis.hset(f"collector:status:{self.name}", mapping={
            "status": status,
            "error": error,
            "last_run": str(asyncio.get_event_loop().time()),
        })
        await redis.expire(f"collector:status:{self.name}", 30)

    @abstractmethod
    async def collect(self):
        """子类实现具体采集逻辑"""
        ...
```

### 4.2 X/Twitter KOL 采集器

```python
# app/collectors/x_kol.py

class XKolCollector(BaseCollector):
    """
    X/Twitter KOL 推文采集
    - 使用 twikit 库（无官方 API，免费）
    - 每 120s 轮询一次所有 KOL 的最新推文
    - 采集到的推文存入 kol_tweets 表，等待 LLM 分析
    """
    name = "x_kol"
    default_interval = 120  # 2 分钟

    async def collect(self):
        # 1. 从 DB 加载活跃 KOL 列表
        # 2. 对每个 KOL:
        #    a. 从 Redis 读取 last_tweet_id
        #    b. twikit.get_user_tweets(user_id) 获取最新推文
        #    c. 过滤出 last_tweet_id 之后的新推文
        #    d. 写入 kol_tweets 表 (is_analyzed=False)
        #    e. 更新 Redis last_tweet_id
        # 3. 每个 KOL 之间 sleep 2-3s 避免封号
```

**关键设计点：**
- twikit 需要 X 账号 Cookie 登录，启动时用配置的账号密码自动登录
- 账号池：配置 3-5 个 X 小号，round-robin 轮换
- 错误处理：遇到 429/403 自动切换账号，标记冷却
- 初始化：首次运行时，`user_id` 通过 `get_user_by_screen_name()` 获取并回填到 `kol_configs`

### 4.3 Telegram 群监控采集器

```python
# app/collectors/telegram_monitor.py

class TelegramCollector(BaseCollector):
    """
    Telegram 群/频道消息采集
    - 使用 Telethon (User Client)
    - 事件驱动模式：监听 NewMessage 事件，不轮询
    - 消息暂存在内存 buffer 中，每 5 分钟由 LLM 批量分析
    - 分析结果存入 telegram_signals 表（不存原始消息）
    """
    name = "telegram_monitor"
    default_interval = 10  # 健康检查间隔

    # 内存 buffer: {group_id: [messages]}
    # 每 5 分钟由 analyzer 消费并清空

    async def start(self):
        # 1. 创建 Telethon client (api_id, api_hash, session)
        # 2. 从 DB 加载活跃群列表
        # 3. 注册 NewMessage handler:
        #    @client.on(events.NewMessage(chats=[group_ids]))
        #    async def on_message(event):
        #        self.buffer[event.chat_id].append({
        #            "text": event.text,
        #            "sender_id": event.sender_id,
        #            "time": event.date,
        #        })
        # 4. 启动 client
```

**关键设计点：**
- Telethon 是事件驱动（不需要轮询），通过 `client.on(events.NewMessage)` 实时收消息
- 消息缓冲在内存中，**不写数据库**，只有分析结果才持久化
- buffer 数据结构：`dict[int, list[TgMessage]]`，按 group_id 分组
- 首次配置群时：通过 `client.get_entity(group_link)` 解析获取 `group_id` 并回填
- 需要单独 session 文件（`xxx.session`），Docker volume 持久化

### 4.4 BSC 链上采集器

```python
# app/collectors/onchain_bsc.py

class OnchainBscCollector(BaseCollector):
    """
    BSC 链上数据采集
    - API Key 池：BscScan(5) + NodeReal(3) + Moralis(2) 轮换
    - 2s 轮询监控的 smart money 地址
    - 检测 DEX 交易 + 大额转账
    """
    name = "onchain_bsc"
    default_interval = 2

    async def collect(self):
        # 1. 从 DB 加载活跃 BSC wallet_configs
        # 2. 对每个地址:
        #    a. 从 key pool 获取一个可用 key
        #    b. 调 API 获取最新交易 (根据 provider 不同用不同接口)
        #    c. 与上次结果对比，筛选新交易
        #    d. 解析交易类型（DEX swap / transfer / approve）
        #    e. 写入 onchain_events 表
        #    f. 归还 key 到池
```

**API Key Pool 策略：**

```python
# app/infra/api_key_pool.py

class ApiKeyPool:
    """
    多 Provider API Key 池管理器

    支持:
    - Round-Robin 轮换
    - 429 限流自动冷却
    - 健康检查探活
    - 不同 Provider 的请求适配

    Config 示例:
    {
        "bsc": [
            {"provider": "bscscan", "key": "xxx", "base_url": "https://api.bscscan.com/api", "rate_limit": 5},
            {"provider": "nodereal", "key": "xxx", "base_url": "https://bsc-mainnet.nodereal.io/v1/{key}", "rate_limit": 10},
            {"provider": "moralis", "key": "xxx", "base_url": "https://deep-index.moralis.io/api/v2.2", "rate_limit": 5},
        ],
        "solana": [
            {"provider": "helius", "key": "xxx", "base_url": "https://mainnet.helius-rpc.com/?api-key={key}", "rate_limit": 30},
            {"provider": "alchemy", "key": "xxx", "base_url": "https://solana-mainnet.g.alchemy.com/v2/{key}", "rate_limit": 10},
            {"provider": "public_rpc", "key": null, "base_url": "https://api.mainnet-beta.solana.com", "rate_limit": 4},
        ]
    }
    """
    async def get_key(self, chain: str) -> KeyInfo:
        """获取一个可用的 API Key（round-robin + 跳过冷却中的 key）"""
        ...

    async def report_rate_limited(self, chain: str, key_id: str):
        """标记 key 被限流，进入冷却"""
        ...

    async def health_check(self):
        """每 60s 探活所有 key"""
        ...
```

### 4.5 Solana 链上采集器

```python
# app/collectors/onchain_solana.py

class OnchainSolanaCollector(BaseCollector):
    """
    Solana 链上数据采集
    - API Key 池：Helius(3) + Alchemy(2) + 公共 RPC(1) 轮换
    - 2s 轮询
    - getSignaturesForAddress + getTransaction 解析
    """
    name = "onchain_solana"
    default_interval = 2

    # 与 BSC 采集器结构类似
    # 不同点：Solana 用 JSON-RPC 接口
    #   - getSignaturesForAddress(address, {limit: 5})
    #   - getTransaction(signature, {encoding: 'jsonParsed'})
    # Helius Enhanced API 可以直接返回解析后的交易数据（推荐优先用）
```

### 4.6 行情采集器

```python
# app/collectors/price_quote.py

class PriceQuoteCollector(BaseCollector):
    """
    代币行情采集 (price_quote_mcp)
    - DEXScreener: 批量获取 token 价格、成交量、流动性
    - Birdeye: Solana 代币补充数据
    - 30s 间隔
    - 只采集被其他信号提到过的 token（动态列表）
    """
    name = "price_quote"
    default_interval = 30

    async def collect(self):
        # 1. 从 Redis 获取 "活跃 token 列表"（近 1 小时被信号提到的 token）
        # 2. 批量调 DEXScreener API:
        #    GET https://api.dexscreener.com/latest/dex/tokens/{addresses}
        #    (支持批量，逗号分隔)
        # 3. Solana token 补充调 Birdeye
        # 4. 写入 price_snapshots 表
```

**DEXScreener 接口说明：**
- `GET /latest/dex/tokens/{tokenAddresses}` — 按 token 地址批量查（逗号分隔，最多 30 个）
- `GET /latest/dex/search?q={query}` — 搜索 token
- 免费无 key，约 60 req/min
- 返回：price, volume, txns, liquidity, priceChange 等

---

## 5. 分析层详细设计

### 5.1 DeepSeek LLM 客户端

```python
# app/analyzers/llm_client.py
from openai import AsyncOpenAI

class DeepSeekClient:
    """
    DeepSeek API 封装（OpenAI 兼容接口）
    """
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com"
        )
        self.model = "deepseek-chat"

    async def analyze(self, system_prompt: str, user_content: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,        # 低温度，输出更确定
            max_tokens=2000,
            response_format={"type": "json_object"},  # 强制 JSON 输出
        )
        return response.choices[0].message.content

    async def analyze_batch(self, items: list[dict], system_prompt: str) -> list[dict]:
        """
        批量分析：将多条内容打包成一个 prompt 一次调用
        比逐条调用省 token、降延迟
        """
        ...
```

### 5.2 推文分析器

```python
# app/analyzers/tweet_analyzer.py

TWEET_ANALYSIS_PROMPT = """你是一个专业的加密货币推文分析师。
分析以下 KOL 推文，对每条输出 JSON 格式结果：

对每条推文提取:
1. tokens_mentioned: 提到的代币 [{symbol, chain(bsc/solana/unknown), confidence(0-1)}]
2. sentiment: bullish / bearish / neutral
3. sentiment_score: -1.0 到 1.0
4. signal_strength: 0-1.0（该推文作为交易信号的强度，考虑是否包含具体代币、价格目标、仓位信息等）
5. summary: 一句话中文摘要

注意：
- 只识别加密货币代币，忽略股票、法币
- 区分 shill/推广 和 genuine analysis
- $TICKER 格式是代币提及的强信号
- 转发/引用内容同样分析
"""

class TweetAnalyzer:
    """
    每 5 分钟运行一次:
    1. 从 kol_tweets 取所有 is_analyzed=False 的推文
    2. 按 batch (最多 20 条) 打包发给 DeepSeek
    3. 解析返回的 JSON，更新 kol_tweets 对应字段
    """
    batch_size = 20

    async def run(self):
        unanalyzed = await db.get_unanalyzed_tweets(limit=100)
        if not unanalyzed:
            return

        for batch in chunk(unanalyzed, self.batch_size):
            results = await llm.analyze_batch(batch, TWEET_ANALYSIS_PROMPT)
            for tweet, result in zip(batch, results):
                await db.update_tweet_analysis(tweet.id, result)
```

### 5.3 Telegram 分析器

```python
# app/analyzers/telegram_analyzer.py

TG_ANALYSIS_PROMPT = """你是一个加密货币社群情绪分析师。
分析以下 Telegram 群在某个时间窗口内的消息集合。

输出 JSON:
{
  "tokens_mentioned": [{"symbol": "...", "mention_count": N, "sentiment": "bullish/bearish/neutral"}],
  "group_sentiment": "bullish/bearish/neutral",
  "fomo_score": 0-100,        // 群内 FOMO 情绪强度
  "spam_ratio": 0-1.0,        // 垃圾/机器人消息占比估计
  "key_topics": ["..."],      // 主要讨论话题
  "summary": "一段中文摘要"
}

注意：
- 区分正常讨论和 spam/shill
- FOMO 信号：急切的买入呼吁、"火箭"emoji密集、价格喊单、"最后机会"类措辞
- 如果消息太少（<5条），标注数据不足
"""

class TelegramAnalyzer:
    """
    每 5 分钟运行一次:
    1. 从 TelegramCollector 的内存 buffer 消费消息
    2. 按群分组，每个群的消息打包分析
    3. 结果写入 telegram_signals 表
    4. 清空 buffer
    """
```

### 5.4 链上行为分析器

```python
# app/analyzers/onchain_analyzer.py

ONCHAIN_ANALYSIS_PROMPT = """你是链上数据分析专家。
分析以下地址的近期链上交易行为。

输出 JSON:
{
  "behavior_tag": "accumulating/distributing/arbitrage/dormant/unknown",
  "confidence": 0-1.0,
  "tokens_of_interest": [{"symbol": "...", "action": "buy/sell", "significance": "high/medium/low"}],
  "pattern_description": "一句话描述行为模式",
  "alert_level": "high/medium/low/none"
}
"""

class OnchainAnalyzer:
    """
    每 5 分钟运行一次:
    1. 从 onchain_events 取最近 5 分钟的新事件
    2. 按钱包地址分组
    3. 每组交易打包给 DeepSeek 分析行为模式
    4. 更新 onchain_events 的 behavior_tag
    5. 高价值信号直接触发通知
    """
```

### 5.5 评分引擎

```python
# app/analyzers/scoring_engine.py

class ScoringEngine:
    """
    OpportunityScore 计算引擎
    每 5 分钟运行一次，为所有"活跃 token"计算综合评分

    活跃 token 定义：近 1 小时被任意信号提到过的 token

    公式：
    OpportunityScore =
        w_kol * KolScore
      + w_sm  * SmartMoneyScore
      + w_soc * SocialScore
      + w_oc  * OnchainScore
      + w_liq * LiquidityScore
      + w_pm  * PriceMomentumScore
      - Penalty(Crowdedness, ManipulationRisk)

    权重从 system_configs 表读取，可在前端调整
    """

    async def run(self):
        weights = await self.load_weights()
        active_tokens = await self.get_active_tokens()

        for token in active_tokens:
            # 1. 计算各分项
            kol_score = await self.calc_kol_score(token)          # 基于推文情绪和 KOL 可靠性
            sm_score = await self.calc_smart_money_score(token)    # 基于聪明钱净流入
            social_score = await self.calc_social_score(token)     # 基于 TG 群情绪
            onchain_score = await self.calc_onchain_score(token)   # 基于链上动量
            liq_score = await self.calc_liquidity_score(token)     # 基于流动性深度
            pm_score = await self.calc_price_momentum(token)       # 基于价格变化

            # 2. 计算惩罚项
            crowdedness = await self.calc_crowdedness(token)       # FOMO 过高 → 扣分
            manipulation = await self.calc_manipulation_risk(token)

            # 3. 加权求和
            total = (
                weights['kol'] * kol_score +
                weights['smart_money'] * sm_score +
                weights['social'] * social_score +
                weights['onchain'] * onchain_score +
                weights['liquidity'] * liq_score +
                weights['price_momentum'] * pm_score
            ) - crowdedness - manipulation

            # 4. 判断市场状态
            regime = self.detect_regime(token)

            # 5. 存入 opportunity_scores
            await self.save_score(token, total, regime, ...)

            # 6. 高分触发通知
            if total >= notification_threshold:
                await notifier.send(token, total, ...)

    async def calc_kol_score(self, token: str) -> float:
        """
        近 1h 内提到该 token 的 KOL 推文:
        - 加权平均 sentiment_score (权重 = KOL reliability)
        - 考虑提及次数和 KOL 数量
        """
        ...

    async def calc_smart_money_score(self, token: str) -> float:
        """
        近 1h 内 smart money 对该 token 的链上行为:
        - 净买入额 / 净卖出额
        - 参与的钱包数
        - Z-Score 标准化
        """
        ...
```

### 5.6 调度器编排

```python
# app/infra/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

def setup_scheduler(app):
    scheduler = AsyncIOScheduler()

    # 采集任务（各自有自己的 interval，通过 BaseCollector.start() 管理）
    # 不走 scheduler，走 asyncio.create_task

    # 分析任务（5 分钟一次）
    scheduler.add_job(tweet_analyzer.run,     'interval', seconds=300, id='tweet_analysis')
    scheduler.add_job(telegram_analyzer.run,  'interval', seconds=300, id='tg_analysis')
    scheduler.add_job(onchain_analyzer.run,   'interval', seconds=300, id='onchain_analysis')
    scheduler.add_job(scoring_engine.run,     'interval', seconds=300, id='scoring',
                      # 在分析任务之后 30 秒运行，确保输入数据已更新
                      next_run_time=datetime.now() + timedelta(seconds=330))

    # 维护任务
    scheduler.add_job(cleanup_old_snapshots,  'cron', hour=3)   # 每天凌晨清理过期行情
    scheduler.add_job(api_key_pool.health_check, 'interval', seconds=60)

    scheduler.start()
```

---

## 6. API 设计 (FastAPI)

### 6.1 路由总览

| Method | Path | 描述 |
|---|---|---|
| **配置管理** | | |
| GET | `/api/config/kols` | 获取 KOL 列表 |
| POST | `/api/config/kols` | 添加 KOL |
| PUT | `/api/config/kols/{id}` | 更新 KOL |
| DELETE | `/api/config/kols/{id}` | 删除 KOL |
| GET | `/api/config/wallets` | 获取钱包列表 |
| POST | `/api/config/wallets` | 添加钱包 |
| PUT | `/api/config/wallets/{id}` | 更新钱包 |
| DELETE | `/api/config/wallets/{id}` | 删除钱包 |
| GET | `/api/config/telegram-groups` | 获取 TG 群列表 |
| POST | `/api/config/telegram-groups` | 添加 TG 群 |
| PUT | `/api/config/telegram-groups/{id}` | 更新 TG 群 |
| DELETE | `/api/config/telegram-groups/{id}` | 删除 TG 群 |
| GET | `/api/config/system` | 获取系统配置 |
| PUT | `/api/config/system/{key}` | 更新系统配置 |
| **信号数据** | | |
| GET | `/api/signals/tweets` | 查询推文（分页、过滤） |
| GET | `/api/signals/tweets/{id}` | 推文详情 |
| GET | `/api/signals/telegram` | TG 分析结果列表 |
| GET | `/api/signals/onchain` | 链上事件列表 |
| GET | `/api/signals/onchain?wallet={addr}` | 按钱包筛选 |
| GET | `/api/signals/prices/{token}` | Token 行情历史 |
| **分析与评分** | | |
| GET | `/api/scores` | 机会评分排行 |
| GET | `/api/scores/{token}` | 单 token 评分详情 + 历史 |
| GET | `/api/scores/latest` | 最新一轮所有评分 |
| GET | `/api/analysis/runs` | LLM 分析运行记录 |
| **看板聚合** | | |
| GET | `/api/dashboard/overview` | 看板数据聚合（top scores, recent signals, collector status） |
| GET | `/api/dashboard/token/{symbol}` | 单 Token 全维度聚合视图 |
| **系统** | | |
| GET | `/api/system/health` | 健康检查 |
| GET | `/api/system/collectors` | 所有采集器状态 |
| POST | `/api/system/collectors/{name}/restart` | 重启单个采集器 |
| GET | `/api/system/notifications` | 通知日志 |
| **WebSocket** | | |
| WS | `/ws/signals` | 实时信号推流（新推文、新链上事件、新评分） |

### 6.2 请求/响应示例

```python
# 添加 KOL
POST /api/config/kols
{
    "username": "VitalikButerin",
    "label": "以太坊创始人",
    "reliability": 0.9
}
→ 201 {
    "id": 1,
    "username": "VitalikButerin",
    "user_id": null,          # 采集器启动后自动填充
    "label": "以太坊创始人",
    "reliability": 0.9,
    "is_active": true,
    "created_at": "2026-03-02T12:00:00Z"
}

# 评分排行
GET /api/scores?min_score=60&limit=20
→ 200 {
    "items": [
        {
            "token_symbol": "XYZ",
            "chain": "solana",
            "total_score": 82.5,
            "direction": "bullish",
            "regime": "trending",
            "kol_score": 85,
            "smart_money_score": 90,
            "social_score": 65,
            "onchain_score": 78,
            "reasoning": "3个高可靠KOL看多，2个聪明钱地址近1h大量买入...",
            "scored_at": "2026-03-02T12:05:00Z"
        },
        ...
    ],
    "total": 5
}

# WebSocket 消息格式
{
    "type": "new_signal",        // new_signal | new_score | collector_status | system_alert
    "data": { ... },
    "timestamp": "2026-03-02T12:00:00Z"
}
```

---

## 7. 前端页面规划 (React + Ant Design)

### 7.1 路由结构

```tsx
// src/routes.tsx
<Route path="/" element={<MainLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="signals" element={<SignalFeed />} />
    <Route path="opportunities" element={<OpportunityList />} />
    <Route path="token/:symbol" element={<TokenDetail />} />
    <Route path="config">
        <Route path="kols" element={<KolConfig />} />
        <Route path="wallets" element={<WalletConfig />} />
        <Route path="telegram" element={<TelegramConfig />} />
        <Route path="system" element={<SystemConfig />} />
    </Route>
    <Route path="analysis" element={<AnalysisHistory />} />
</Route>
```

### 7.2 页面详细规划

#### Dashboard（首页看板）

```
┌─────────────────────────────────────────────────────────────┐
│  [侧边栏]     │           Dashboard                         │
│               │                                             │
│  📊 看板       │  ┌──────────┬──────────┬──────────┐        │
│  📡 信号流     │  │ 采集器状态 │ 今日信号数 │ 今日分析数 │        │
│  🎯 机会评分   │  │ 5/5 ✅   │ 1,234    │ 89 runs  │        │
│  ─────────    │  └──────────┴──────────┴──────────┘        │
│  ⚙️ 配置       │                                             │
│    KOL 名单   │  ┌─── Top Opportunities ──────────────┐    │
│    钱包地址   │  │ #1  XYZ  Score: 85  🟢 Bullish     │    │
│    TG 群     │  │ #2  ABC  Score: 78  🟢 Bullish     │    │
│    系统设置   │  │ #3  DEF  Score: 72  🟡 Neutral     │    │
│  ─────────    │  └────────────────────────────────────┘    │
│  📋 分析记录   │                                             │
│               │  ┌─── Recent Signals ─────────────────┐    │
│               │  │ 🐦 @KOL1 提到 $XYZ - 2min ago      │    │
│               │  │ 💰 SmartMoney 买入 XYZ - 5min ago   │    │
│               │  │ 💬 TG群 FOMO=72 on ABC - 8min ago   │    │
│               │  └────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### KOL 管理页

- Ant Design `Table` 展示 KOL 列表（username, label, reliability, 状态, 最新推文时间）
- `Button` + `Modal` + `Form` 添加/编辑 KOL
- `Popconfirm` 删除确认
- `Switch` 启用/停用
- `Slider` 调整 reliability 权重

#### Wallet 管理页

- 同 KOL，额外增加 `Select` 选链（BSC/Solana）
- 地址输入自动校验格式（BSC: 0x 开头 42 位，Solana: Base58 32-44 字符）

#### Telegram 群管理页

- 输入 `t.me/xxx` 或 `@xxx` 格式
- 添加后显示解析状态（等待 Telethon 解析 group_id）
- `Tag` 显示群类型（group/channel/supergroup）

#### Signal Feed（信号流页面）

- 类似 Twitter timeline 的无限滚动列表
- 每条信号卡片包含：来源图标 + 内容摘要 + 相关 token + 时间
- Ant Design `Tabs` 按来源过滤：全部 / KOL / Telegram / 链上

#### Opportunity List（机会评分排行）

- `Table` 排行，列：排名、Token、链、总分、各分项、方向、时间
- 点击行展开详情或跳转 Token 详情页
- 条件筛选：最低分数、链、方向

#### Token Detail（Token 详情页）

- 汇聚该 token 所有维度信息
- 上方：基本信息 + 当前评分 + 价格
- 中部 Tabs：KOL 提及 / 聪明钱动向 / TG 讨论 / 价格走势
- 评分历史折线图

#### System Config（系统设置）

- 评分权重调节（6 个 Slider，总和自动归一化）
- 通知规则（最低分数阈值、冷却时间）
- 采集间隔调节
- API Key 管理（显示、添加、删除；密钥部分遮罩显示）
- DeepSeek API Key 配置

---

## 8. 通知层设计

### 8.1 Telegram Bot 推送

```python
# app/notifiers/telegram_bot.py
from telegram import Bot

class TelegramNotifier:
    """
    使用独立的 Telegram Bot 推送通知
    与 Telethon 监控完全独立

    通知类型：
    1. 高分机会: OpportunityScore >= 阈值
    2. 聪明钱警报: 大额买入/卖出
    3. KOL 提及: 高可靠性 KOL 发布代币相关推文
    4. 系统警报: 采集器异常、API 配额耗尽
    """

    async def send_opportunity_alert(self, score: OpportunityScore):
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
        await self.bot.send_message(
            chat_id=self.owner_chat_id,
            text=text,
            parse_mode="Markdown"
        )

    async def send_smart_money_alert(self, event: OnchainEvent):
        """聪明钱大额操作即时推送"""
        ...

    async def send_system_alert(self, title: str, message: str):
        """系统异常推送"""
        ...
```

**冷却机制**：同一个 token 在 `cooldown_minutes`（默认 30 分钟）内不重复推送。用 Redis key `notify:cooldown:{token}` 控制。

### 8.2 WebSocket 实时推送

```python
# app/notifiers/ws_pusher.py

class WebSocketPusher:
    """
    通过 Redis Pub/Sub 广播到所有 WebSocket 连接

    事件类型:
    - new_tweet: 新推文采集到
    - new_onchain_event: 新链上事件
    - new_score: 新评分产出
    - collector_status: 采集器状态变化
    """

    async def broadcast(self, event_type: str, data: dict):
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        await redis.publish("ws:broadcast", json.dumps(message))
```

---

## 9. 部署方案 (Docker Compose)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: signal_platform
      POSTGRES_USER: ${DB_USER:-signal}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-signal_pass}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U signal"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER:-signal}:${DB_PASSWORD:-signal_pass}@postgres:5432/signal_platform
      REDIS_URL: redis://redis:6379/0
    ports:
      - "8000:8000"
    volumes:
      - telethon_sessions:/app/sessions    # Telethon session 持久化
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
  telethon_sessions:
```

### .env.example

```env
# Database
DB_USER=signal
DB_PASSWORD=signal_pass

# DeepSeek
DEEPSEEK_API_KEY=sk-xxx

# Telegram (监控用 User Client)
TG_API_ID=12345678
TG_API_HASH=abcdef1234567890
TG_PHONE=+8613800138000

# Telegram (通知用 Bot)
TG_BOT_TOKEN=123456:ABC-DEF...
TG_OWNER_CHAT_ID=987654321

# X/Twitter 账号池 (JSON 数组)
X_ACCOUNTS='[{"username":"acc1","password":"pass1"},{"username":"acc2","password":"pass2"}]'

# BSC API Keys (JSON 数组)
BSC_API_KEYS='[
  {"provider":"bscscan","key":"xxx"},
  {"provider":"bscscan","key":"yyy"},
  {"provider":"nodereal","key":"zzz"},
  {"provider":"moralis","key":"aaa"}
]'

# Solana API Keys (JSON 数组)
SOLANA_API_KEYS='[
  {"provider":"helius","key":"xxx"},
  {"provider":"helius","key":"yyy"},
  {"provider":"alchemy","key":"zzz"}
]'
```

### Backend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction

COPY . .

# Alembic 迁移 + 启动
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

### Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 10. 开发顺序与里程碑

### Phase 1：基础骨架（预计 3-4 天）

```
目标：项目能跑起来，DB 能连，API 能访问
├── 初始化 backend (FastAPI + SQLAlchemy + Alembic)
├── 初始化 frontend (Vite + React + Ant Design + React Router)
├── Docker Compose 搭建 (Postgres + Redis + Backend + Frontend)
├── DB Schema 创建 (所有表的 migration)
├── 配置管理 CRUD API (kols, wallets, tg_groups, system_configs)
├── 前端 MainLayout + 配置管理 4 个页面
└── 验收标准：可以通过前端增删改查 KOL/钱包/TG群 配置
```

### Phase 2：采集层（预计 5-7 天）

```
目标：5 个采集器全部运行，数据入库
├── API Key Pool 基础设施
├── price_quote_collector (DEXScreener + Birdeye) ← 最简单，先做
├── onchain_bsc_collector (BscScan 号池)
├── onchain_solana_collector (Helius 号池)
├── x_kol_collector (twikit)
├── telegram_collector (Telethon)
├── 前端 Dashboard 采集器状态展示
├── 前端 Signal Feed 基础版（展示原始信号）
└── 验收标准：5 个采集器持续运行，数据稳定入库，前端可看到实时信号
```

### Phase 3：分析层（预计 4-5 天）

```
目标：DeepSeek 分析跑通，评分产出
├── DeepSeek 客户端封装
├── tweet_analyzer (推文分析)
├── telegram_analyzer (TG 批量分析)
├── onchain_analyzer (链上行为分析)
├── scoring_engine (OpportunityScore)
├── APScheduler 编排所有分析任务
├── 前端 Opportunity List (评分排行)
├── 前端 Token Detail (多维度聚合)
└── 验收标准：每 5 分钟产出评分，前端可看到评分排行和详情
```

### Phase 4：通知层 + 收尾（预计 2-3 天）

```
目标：通知推送，系统稳定
├── Telegram Bot 通知推送
├── WebSocket 实时推送
├── 前端实时更新（WebSocket 接入）
├── 前端 SystemConfig 页面完善
├── 日志 + 错误处理 + 重启恢复
├── 数据清理定时任务
└── 验收标准：高分信号自动推送到 TG，Web 看板实时更新，系统稳定运行 24h+
```

### 总时间估算：14-19 天

```
Phase 1 (骨架)    ████░░░░░░░░░░░░  3-4 天
Phase 2 (采集)    ░░░░███████░░░░░  5-7 天
Phase 3 (分析)    ░░░░░░░░░░█████░  4-5 天
Phase 4 (通知)    ░░░░░░░░░░░░░░██  2-3 天
```

---

## 附录 A：核心依赖清单

### Backend (Python)

```toml
[tool.poetry.dependencies]
python = "^3.11"
# Web 框架
fastapi = "^0.115"
uvicorn = {extras = ["standard"], version = "^0.30"}
# 数据库
sqlalchemy = {extras = ["asyncio"], version = "^2.0"}
asyncpg = "^0.29"
alembic = "^1.13"
# Redis
redis = {extras = ["hiredis"], version = "^5.0"}
# 任务调度
apscheduler = "^3.10"
# LLM
openai = "^1.40"              # DeepSeek 兼容
# X/Twitter
twikit = "^2.0"
# Telegram
telethon = "^1.36"            # 群监控 (User Client)
python-telegram-bot = "^21"   # 通知推送 (Bot API)
# HTTP
httpx = "^0.27"               # 异步 HTTP 客户端
# 工具
pydantic = "^2.0"
pydantic-settings = "^2.0"
python-dotenv = "^1.0"
structlog = "^24.0"           # 结构化日志
```

### Frontend (React)

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.26",
    "antd": "^5.20",
    "@ant-design/icons": "^5.4",
    "axios": "^1.7",
    "dayjs": "^1.11",
    "recharts": "^2.12"
  },
  "devDependencies": {
    "vite": "^5.4",
    "@vitejs/plugin-react": "^4.3",
    "typescript": "^5.5"
  }
}
```

---

## 附录 B：关键技术风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| twikit 被 X 封堵 | 中 | 高 | twscrape 备用；账号池轮换；请求间隔 ≥ 2s |
| Telethon 账号被封 | 低 | 高 | 备用手机号；控制加群频率；只监听不发送 |
| BscScan 免费额度不够 | 中 | 中 | 10 key 池；NodeReal/Moralis 补充；优先级调度 |
| DeepSeek API 不稳定 | 低 | 中 | 分析失败重试 3 次；降级为规则分析 |
| 单机性能瓶颈 | 低 | 低 | 当前规模远不到瓶颈；后续可拆分采集器为独立进程 |
