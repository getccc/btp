# V3 信号采集与分析平台 — 系统架构文档

## 1. 系统定位与目标

V3 平台是一个专注于**加密货币市场信号采集与智能分析**的自动化系统。
它通过多渠道（社交媒体、链上数据、行情数据）实时收集市场异动，利用 DeepSeek 大语言模型进行情绪与意图分析，最终通过多维度评分引擎产出交易机会（Opportunity Score），并通过 Telegram 和 Web 看板实时推送给用户。

**核心特点：**
- **全免费数据源**：通过 API Key 池轮换技术，零成本获取 BSC/Solana 链上数据。
- **AI 深度参与**：使用 LLM 替代传统的正则匹配，实现对推文情绪、社群 FOMO 指数、链上复杂行为的精准打标。
- **单机高内聚**：采用 Docker Compose 单机部署，降低运维成本，适合个人或小团队使用。

---

## 2. 整体架构图

```text
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose 单机部署                    │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐       │
│  │  React +    │  │  FastAPI     │  │  PostgreSQL   │       │
│  │  Ant Design │◄─┤  Backend     │──┤  + Redis      │       │
│  │  (前端看板)  │  │  (核心后端)   │  │  (持久化/缓存) │       │
│  └─────────────┘  └──────┬───────┘  └───────────────┘       │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 采集层       │ │ 分析层        │ │ 通知层        │        │
│  │             │ │              │ │              │        │
│  │ • X/Twitter │ │ • DeepSeek   │ │ • TG Bot     │        │
│  │ • Telegram  │ │   LLM Client │ │   (高分推送)  │        │
│  │ • BSC 链上   │ │ • 推文分析器  │ │ • WebSocket  │        │
│  │ • SOL 链上   │ │ • TG 分析器   │ │   (看板刷新)  │        │
│  │ • 行情报价   │ │ • 链上分析器  │ │              │        │
│  │             │ │ • 评分引擎    │ │              │        │
│  └─────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心模块设计

### 3.1 采集层 (Collectors)
采集层负责从外部世界获取原始数据，所有采集器继承自 `BaseCollector`，由 `CollectorManager` 统一管理生命周期。

- **X/Twitter 采集器 (`x_kol.py`)**：使用 `twikit` 库模拟浏览器登录，绕过官方 API 限制。支持多账号 Cookie 轮换，每 2 分钟抓取一次目标 KOL 的最新推文。
- **Telegram 采集器 (`telegram_monitor.py`)**：使用 `telethon` 作为 User Client 登录，事件驱动监听目标群组消息。消息暂存于 Redis 内存缓冲中，等待批量分析。
- **链上采集器 (`onchain_bsc.py` / `onchain_solana.py`)**：每 2 秒高频轮询目标 Smart Money 地址。依赖 `ApiKeyPool` 基础设施，在 BscScan、NodeReal、Helius 等免费节点间进行 Round-Robin 轮换，自动处理 429 限流冷却。
- **行情采集器 (`price_quote.py`)**：每 30 秒通过 DEXScreener 免费 API 获取活跃代币的最新价格、流动性和 24h 涨跌幅。

### 3.2 分析层 (Analyzers)
分析层由 `APScheduler` 驱动，每 5 分钟执行一次批量分析任务。

- **LLM 客户端 (`llm_client.py`)**：封装 OpenAI 兼容接口对接 DeepSeek API。强制开启 `json_object` 响应格式，确保输出结构化数据。
- **推文分析器 (`tweet_analyzer.py`)**：将未分析的推文按批次（Batch）打包发送给 LLM，提取提及代币、情绪倾向（Bullish/Bearish）和信号强度。
- **社群分析器 (`telegram_analyzer.py`)**：消费 Redis 中的群消息缓冲，LLM 综合评估群内的 FOMO 指数、垃圾信息比例及核心讨论话题。
- **链上分析器 (`onchain_analyzer.py`)**：将原始的 Transfer/Swap 记录交给 LLM，结合上下文打上行为标签（如：建仓 accumulating、出货 distributing、套利 arbitrage）。

### 3.3 评分引擎 (Scoring Engine)
系统的决策大脑。每 5 分钟在所有分析器运行完毕后触发。

- **计算逻辑**：提取近 1 小时内活跃的代币，综合其 KOL 提及得分、聪明钱净流入得分、社群 FOMO 得分、链上动量和流动性深度，加权计算出 `OpportunityScore` (0-100分)。
- **市场状态感知**：根据整体得分分布，判定当前市场处于 Quiet（平静）、Trending（趋势）还是 Mania（狂热）状态。

### 3.4 通知层 (Notifiers)
- **Telegram Bot (`telegram_bot.py`)**：当某代币的 `OpportunityScore` 超过系统设定的阈值（如 75 分）时，触发 Markdown 格式的图文警报。内置 Redis 冷却机制（默认 1 小时），防止同一代币频繁轰炸。
- **WebSocket 推送 (`ws_pusher.py`)**：基于 Redis Pub/Sub 实现。任何新的推文、链上事件或评分产出，都会实时广播给前端 React 看板，实现无刷新数据流。

---

## 4. 技术栈选型依据

| 组件 | 选型 | 依据 |
|---|---|---|
| **后端框架** | FastAPI | 原生支持 Asyncio，极佳的 WebSocket 支持，适合高并发的 IO 密集型采集任务。 |
| **数据库** | PostgreSQL 15 | 强大的 JSONB 支持，完美契合 LLM 返回的半结构化分析结果。 |
| **缓存/消息** | Redis 7 | 承担 API Key 冷却状态、采集器心跳、TG 消息缓冲以及 WebSocket Pub/Sub 消息总线四大重任。 |
| **ORM** | SQLAlchemy 2.0 | 配合 asyncpg 实现全异步数据库操作，Alembic 管理表结构变更。 |
| **前端框架** | React 18 + Vite | 极速的冷启动和热更新体验。 |
| **UI 组件库** | Ant Design 5 | 提供开箱即用的复杂数据表格（Table）和表单（Form），极其适合后台配置管理界面的快速开发。 |
| **LLM 模型** | DeepSeek Chat V3 | 极高的性价比（约 ¥1/百万 tokens），在信息抽取和情感分类任务上表现优异，完全兼容 OpenAI SDK。 |

---

## 5. 目录结构规范

```text
v3/
├── backend/
│   ├── alembic/            # 数据库迁移脚本
│   ├── app/
│   │   ├── api/            # FastAPI 路由控制器 (REST + WS)
│   │   ├── analyzers/      # LLM 分析器与评分引擎
│   │   ├── collectors/     # 数据采集器
│   │   ├── infra/          # 基础设施 (Redis, Scheduler, API Key Pool)
│   │   ├── models/         # SQLAlchemy ORM 模型
│   │   ├── notifiers/      # 消息推送 (TG Bot, WS)
│   │   ├── schemas/        # Pydantic 数据校验模型
│   │   └── utils/          # 工具类 (Logger)
│   └── main.py             # 程序入口与生命周期管理
│
└── frontend/
    ├── src/
    │   ├── components/     # 可复用 UI 组件
    │   ├── layouts/        # 页面布局 (侧边栏+顶栏)
    │   ├── pages/          # 路由页面 (Dashboard, Config, Feed)
    │   └── services/       # API 请求与 WebSocket 客户端
    └── vite.config.ts      # 构建与代理配置
```
