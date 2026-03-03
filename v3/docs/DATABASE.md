# V3 信号采集与分析平台 — 数据库设计文档

系统采用 **PostgreSQL 15** 作为主数据库，利用其强大的 `JSONB` 类型存储 LLM 返回的半结构化数据；采用 **Redis 7** 作为高速缓存和消息总线。

---

## 1. PostgreSQL 表结构设计

数据库共包含 11 张核心表，分为四大领域：配置管理、信号数据、分析结果、系统通知。

### 1.1 配置管理表 (Config Tables)

存储用户在前端配置的监控目标和系统参数。

#### `kol_configs` (X/Twitter KOL 名单)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `platform` | String(20) | Default 'x' | 平台名称 |
| `username` | String(100) | Unique, Not Null | KOL 的 @handle |
| `user_id` | String(50) | Nullable | 平台内部 ID（采集器启动后回填） |
| `display_name` | String(200) | Nullable | 显示名称 |
| `label` | String(100) | Nullable | 用户自定义标签 |
| `reliability` | Float | Default 0.5 | 可靠性权重 (0.0 - 1.0) |
| `is_active` | Boolean | Default True | 是否启用监控 |
| `created_at` | DateTime | Default now() | 创建时间 |
| `updated_at` | DateTime | Default now() | 更新时间 |

#### `wallet_configs` (Smart Money 钱包地址)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `address` | String(100) | Not Null | 钱包地址 |
| `chain` | String(20) | Not Null | 链名称 ('bsc' / 'solana') |
| `label` | String(100) | Nullable | 用户自定义标签 |
| `wallet_type` | String(50) | Default 'smart_money' | 类型 ('smart_money'/'whale'/'insider') |
| `reliability` | Float | Default 0.5 | 可靠性权重 |
| `is_active` | Boolean | Default True | 是否启用监控 |
| `created_at` | DateTime | Default now() | 创建时间 |
| `updated_at` | DateTime | Default now() | 更新时间 |
> **联合唯一索引**: `(address, chain)`

#### `telegram_group_configs` (Telegram 监控群组)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `group_id` | BigInteger | Nullable | TG 内部群组 ID（采集器回填） |
| `group_link` | String(200) | Unique, Not Null | 群组链接 (t.me/xxx) |
| `group_name` | String(200) | Nullable | 群组名称 |
| `group_type` | String(20) | Default 'group' | 类型 ('group'/'channel'/'supergroup') |
| `label` | String(100) | Nullable | 用户自定义标签 |
| `is_active` | Boolean | Default True | 是否启用监控 |
| `created_at` | DateTime | Default now() | 创建时间 |
| `updated_at` | DateTime | Default now() | 更新时间 |

#### `system_configs` (系统全局配置)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `key` | String(100) | PK | 配置键名 |
| `value` | JSONB | Not Null | 配置值（支持复杂结构） |
| `description` | String(500) | Nullable | 配置说明 |
| `updated_at` | DateTime | Default now() | 更新时间 |
> **预置数据**: `scoring_weights`, `notification_rules`, `collector_intervals`, `llm_config`, `regime_thresholds`

---

### 1.2 信号数据表 (Signal Tables)

存储采集器抓取的原始数据及 LLM 的初步分析结果。

#### `kol_tweets` (推文记录)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `tweet_id` | String(50) | Unique, Not Null | X 平台推文 ID |
| `kol_config_id` | Integer | FK | 关联 `kol_configs.id` |
| `username` | String(100) | Not Null | 发布者 |
| `content` | Text | Not Null | 推文原文 |
| `media_urls` | JSONB | Nullable | 包含的图片/视频链接 |
| `metrics` | JSONB | Nullable | 互动数据 (likes, retweets) |
| `tweet_time` | DateTime | Not Null | 推文发布时间 |
| `collected_at` | DateTime | Default now() | 采集入库时间 |
| `is_analyzed` | Boolean | Default False | LLM 是否已分析 |
| `tokens_mentioned`| JSONB | Nullable | LLM 提取的代币列表 |
| `sentiment` | String(20) | Nullable | 情绪 ('bullish'/'bearish'/'neutral') |
| `sentiment_score` | Float | Nullable | 情绪得分 (-1.0 ~ 1.0) |
| `signal_strength` | Float | Nullable | 信号强度 (0.0 ~ 1.0) |
| `analysis_summary`| Text | Nullable | LLM 生成的中文摘要 |
> **索引**: `tweet_time DESC`, `is_analyzed` (部分索引，仅针对 False)

#### `telegram_signals` (TG 群组分析结果)
*注：系统不持久化 TG 原始聊天记录，仅存储 5 分钟窗口的 LLM 分析结果。*
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `group_config_id` | Integer | FK | 关联 `telegram_group_configs.id` |
| `group_name` | String(200) | Nullable | 群组名称 |
| `window_start` | DateTime | Not Null | 分析窗口起始时间 |
| `window_end` | DateTime | Not Null | 分析窗口结束时间 |
| `message_count` | Integer | Nullable | 窗口内消息总数 |
| `tokens_mentioned`| JSONB | Nullable | 提及的代币及次数统计 |
| `group_sentiment` | String(20) | Nullable | 群组整体情绪 |
| `fomo_score` | Float | Nullable | FOMO 指数 (0-100) |
| `spam_ratio` | Float | Nullable | 垃圾信息比例 (0.0-1.0) |
| `analysis_summary`| Text | Nullable | 讨论话题摘要 |
| `analyzed_at` | DateTime | Default now() | 分析时间 |
> **索引**: `window_end DESC`

#### `onchain_events` (链上交易事件)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `chain` | String(20) | Not Null | 链名称 |
| `event_type` | String(50) | Not Null | 事件类型 (swap/transfer) |
| `wallet_config_id`| Integer | FK | 关联 `wallet_configs.id` |
| `wallet_address` | String(100) | Nullable | 发生交易的地址 |
| `tx_hash` | String(100) | Nullable | 交易哈希 |
| `block_number` | BigInteger | Nullable | 区块高度 |
| `from_token` | String(100) | Nullable | 卖出代币 |
| `to_token` | String(100) | Nullable | 买入代币 |
| `from_amount` | Numeric | Nullable | 卖出数量 |
| `to_amount` | Numeric | Nullable | 买入数量 |
| `usd_value` | Numeric | Nullable | 预估美元价值 |
| `behavior_tag` | String(50) | Nullable | LLM 打标 (accumulating/distributing) |
| `is_dex_trade` | Boolean | Default False | 是否为 DEX 交易 |
| `dex_name` | String(50) | Nullable | DEX 名称 (pancakeswap/jupiter) |
| `event_time` | DateTime | Not Null | 链上发生时间 |
| `collected_at` | DateTime | Default now() | 采集入库时间 |
> **索引**: `(chain, event_time DESC)`, `wallet_address`

#### `price_snapshots` (行情快照)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `token_symbol` | String(50) | Not Null | 代币符号 |
| `token_address` | String(100) | Nullable | 合约地址 |
| `chain` | String(20) | Nullable | 所在链 |
| `price_usd` | Numeric | Nullable | 美元价格 |
| `volume_24h` | Numeric | Nullable | 24小时交易量 |
| `volume_5m` | Numeric | Nullable | 5分钟交易量 |
| `liquidity_usd` | Numeric | Nullable | 流动性池深度 |
| `price_change_5m` | Float | Nullable | 5分钟涨跌幅 |
| `price_change_1h` | Float | Nullable | 1小时涨跌幅 |
| `price_change_24h`| Float | Nullable | 24小时涨跌幅 |
| `buy_count_5m` | Integer | Nullable | 5分钟买单数 |
| `sell_count_5m` | Integer | Nullable | 5分钟卖单数 |
| `source` | String(50) | Nullable | 数据源 (dexscreener) |
| `snapshot_at` | DateTime | Default now() | 快照时间 |
> **索引**: `(token_symbol, snapshot_at DESC)`

---

### 1.3 分析结果表 (Analysis Tables)

#### `opportunity_scores` (机会评分记录)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `token_symbol` | String(50) | Not Null | 代币符号 |
| `token_address` | String(100) | Nullable | 合约地址 |
| `chain` | String(20) | Nullable | 所在链 |
| `kol_score` | Float | Default 0 | KOL 维度得分 |
| `smart_money_score`| Float | Default 0 | 聪明钱维度得分 |
| `social_score` | Float | Default 0 | 社群维度得分 |
| `onchain_score` | Float | Default 0 | 链上动量得分 |
| `liquidity_score` | Float | Default 0 | 流动性得分 |
| `crowdedness_penalty`| Float | Default 0 | 拥挤度惩罚扣分 |
| `manipulation_penalty`| Float | Default 0 | 操纵风险惩罚扣分 |
| `total_score` | Float | Not Null | 最终综合得分 (0-100) |
| `regime` | String(20) | Nullable | 市场状态 (quiet/trending/mania) |
| `direction` | String(20) | Nullable | 交易方向 (bullish/bearish) |
| `signal_snapshot` | JSONB | Nullable | 计算时的输入数据快照 |
| `reasoning` | Text | Nullable | LLM 给出的打分推理过程 |
| `scored_at` | DateTime | Default now() | 评分时间 |
> **索引**: `(token_symbol, scored_at DESC)`, `total_score DESC`

#### `llm_analysis_runs` (LLM 调用审计日志)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `run_type` | String(50) | Not Null | 任务类型 (tweet_batch/tg_batch等) |
| `input_count` | Integer | Nullable | 处理的条目数 |
| `model` | String(50) | Nullable | 使用的模型 (deepseek-chat) |
| `tokens_used` | Integer | Nullable | 消耗的 Token 数 |
| `latency_ms` | Integer | Nullable | API 响应延迟(毫秒) |
| `status` | String(20) | Default 'running'| 状态 (completed/failed) |
| `error` | Text | Nullable | 错误堆栈信息 |
| `started_at` | DateTime | Default now() | 开始时间 |
| `completed_at` | DateTime | Nullable | 结束时间 |

---

### 1.4 通知表 (Notification Tables)

#### `notification_logs` (推送日志)
| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | Integer | PK | 主键 |
| `channel` | String(20) | Not Null | 渠道 (telegram/web) |
| `event_type` | String(50) | Nullable | 事件类型 (high_score/system) |
| `title` | String(200) | Nullable | 通知标题 |
| `content` | Text | Nullable | 通知正文 |
| `related_token` | String(50) | Nullable | 关联代币 |
| `related_score` | Float | Nullable | 关联分数 |
| `is_sent` | Boolean | Default False | 是否发送成功 |
| `sent_at` | DateTime | Nullable | 发送时间 |
| `error` | Text | Nullable | 失败原因 |
| `created_at` | DateTime | Default now() | 创建时间 |

---

## 2. Redis 键空间设计 (Key Space)

Redis 在系统中承担缓存、状态同步和消息总线的作用。

| Key 模式 | 数据类型 | TTL | 用途说明 |
|---|---|---|---|
| `api_pool:{chain}:cooldown:{key_id}` | String | 60s | 标记某个 API Key 触发了 429 限流，处于冷却期 |
| `collector:status:{name}` | Hash | 60s | 采集器心跳状态（包含 status, error, last_run），供前端看板读取 |
| `collector:telegram:messages:{chat_id}` | List | 永久 | Telegram 群消息内存缓冲队列，由分析器定期 `lrange` + `delete` 消费 |
| `notify:cooldown:{token}` | String | 3600s | 某个代币的高分推送冷却锁，防止 1 小时内对同一代币重复发送 Telegram 警报 |
| `ws:broadcast` | Pub/Sub | - | WebSocket 消息广播通道，后端推送，API 层订阅并转发给前端 |
