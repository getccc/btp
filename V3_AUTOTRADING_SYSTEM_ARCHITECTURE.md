# V3 自动交易机器人系统架构设计（BSC + Solana）

## 1. 目标与范围

### 1.1 目标
- 构建可持续运行的跨链自动交易系统，围绕“情绪驱动 + 聪明钱跟随”的山寨币交易策略。
- 把多源信号（X、Telegram、新闻、链上、聪明钱）统一为可计算的交易机会评分。
- 实现从信号采集、策略决策、自动执行、风险控制到复盘学习的闭环。

### 1.2 非目标
- 不承诺固定收益或无回撤。
- 不依赖单一 LLM 直接持私钥做不可控交易。
- 不在无风控闸门情况下进行全自动高杠杆扩张。

## 2. V3 总体架构

```text
+------------------------------- Control Plane --------------------------------+
|  Strategy Config | Risk Config | Agent Registry | Feature Flags | Audit Policy |
+-------------------------------------------------------------------------------+

+------------------------------- Data Plane -----------------------------------+
|  MCP Collectors -> Event Bus -> Feature Store -> Agent Mesh -> Exec Gateway |
+-------------------------------------------------------------------------------+

MCP Collectors:
  x_kol_mcp / telegram_group_mcp / news_media_mcp / onchain_flow_mcp /
  smart_money_mcp / trade_execution_mcp

Agent Mesh:
  Signal Fusion Agent
  Opportunity Scoring Agent
  Portfolio & Risk Agent
  Execution Agent
  Guardrail Agent (Kill-Switch)

Execution:
  Quote Router -> Tx Builder -> Signer Gateway (HSM/MPC) -> Broadcaster
  -> Confirmation Tracker -> Position Manager

Observability:
  Metrics + Traces + Structured Logs + Replay + PnL Attribution
```

## 3. 组件分层与职责

### 3.1 采集层（MCP Servers）
- 各 MCP 仅负责“采集 + 标准化 + 质量评分”，不做交易决策。
- 每条事件必须带 `source_latency_ms`、`source_reliability`、`event_confidence`。

### 3.2 事件层（Event Bus）
- 使用 Redis Streams / Kafka 作为事件总线。
- Topic 设计：
  - `signal.social.x`
  - `signal.social.telegram`
  - `signal.news`
  - `signal.onchain.flow`
  - `signal.onchain.smartmoney`
  - `decision.trade`
  - `execution.order`
  - `risk.alert`

### 3.3 特征层（Feature Store）
- 在线特征：近 30s/2m/10m 的提及增速、净买入、钱包增长率、成交量冲击。
- 离线特征：历史策略命中率、代币生命周期阶段、KOL 历史有效率。

### 3.4 Agent 层（决策网格）
- `Signal Fusion Agent`：多源实体对齐（token ticker/mint/contract），去重与冲突消解。
- `Opportunity Scoring Agent`：生成 `OpportunityScore(0-100)` 和 `RegimeTag`。
- `Portfolio & Risk Agent`：仓位、相关性、回撤、资金利用率控制。
- `Execution Agent`：执行路径选择、切单、重试、链路降级。
- `Guardrail Agent`：硬闸门，违反风险规则直接拒单或强平。

### 3.5 执行层（Execution Gateway）
- 统一下单接口，支持 BSC/Solana 的 quote/build/sign/send/confirm。
- 签名与私钥隔离：Signer Gateway 不暴露私钥给 LLM 或策略层。
- 下单模型：`IOC + 分批 + 滑点动态调整 + 超时撤单`。

### 3.6 治理层（Control Plane）
- 版本化策略配置、风险参数、黑白名单、特征开关。
- 灰度发布：paper -> canary(小资金) -> full。
- 任何参数变更必须可审计、可回滚。

## 4. MCP 工具集设计（V3）

## 4.1 统一 MCP 调用规范

### 请求头
- `trace_id`
- `request_id`
- `agent_id`
- `deadline_ms`

### 响应包络
```json
{
  "ok": true,
  "data": {},
  "meta": {
    "source": "x_kol_mcp",
    "latency_ms": 120,
    "reliability": 0.92,
    "as_of": 1735689600000
  },
  "error": null
}
```

### 事件标准字段
```json
{
  "event_id": "uuid",
  "event_type": "social_mention|news_alert|smartmoney_trade|onchain_spike",
  "chain": "bsc|solana|none",
  "token": {
    "symbol": "ABC",
    "address": "0x...|So...",
    "confidence": 0.86
  },
  "signal": {
    "direction": "bullish|bearish|neutral",
    "strength": 0.0,
    "novelty": 0.0,
    "crowdedness": 0.0
  },
  "timestamps": {
    "event_time": 0,
    "ingest_time": 0
  },
  "quality": {
    "source_reliability": 0.0,
    "dedup_score": 0.0
  }
}
```

## 4.2 x_kol_mcp
- 功能：固定 KOL 列表流式采集、关键词/合约地址抽取、传播加速度计算。
- 核心方法：
  - `watch_kol_posts(kol_ids, rules)`
  - `get_kol_signal(token, window)`
  - `get_kol_reputation(kol_id)`
- 关键输出：`kol_pulse_score`, `mention_velocity`, `kol_hit_rate_30d`。

## 4.3 telegram_group_mcp
- 功能：群消息流采集、情绪分析、FOMO 指标。
- 核心方法：
  - `stream_group_messages(group_ids)`
  - `get_group_sentiment(token, window)`
  - `get_fomo_index(token, window)`
- 关键输出：`retail_fomo_score`, `spam_ratio`, `first_seen_delta`。

## 4.4 news_media_mcp
- 功能：币圈媒体、交易所公告、listing/delisting/news 标签化。
- 核心方法：
  - `stream_news(sources, tags)`
  - `get_news_impact(token, window)`
- 关键输出：`news_impact_score`, `exchange_event_flag`。

## 4.5 onchain_flow_mcp
- 功能：链上交易流、池子流动性变化、成交量冲击监控。
- 核心方法：
  - `subscribe_pair_activity(chain, pair_or_token)`
  - `get_flow_features(chain, token, window)`
- 关键输出：`buy_sell_imbalance`, `liquidity_delta`, `new_wallet_rate`。

## 4.6 smart_money_mcp
- 功能：聪明钱地址簇跟踪、净流入/净流出、持仓变化。
- 核心方法：
  - `watch_smart_wallets(chain, wallet_set)`
  - `get_smartmoney_signal(chain, token, window)`
- 关键输出：`smart_money_netflow`, `smart_wallet_count`, `follow_through_rate`。

## 4.7 trade_execution_mcp
- 功能：跨链执行统一接口。
- 核心方法：
  - `get_quote(chain, in_token, out_token, amount, slippage_bps)`
  - `build_order(chain, route, params)`
  - `sign_order(order_id)`
  - `send_order(order_id)`
  - `get_order_status(order_id)`
- 关键输出：`expected_out`, `price_impact_bps`, `tx_hash`, `final_state`。

## 4.8 辅助 MCP（建议新增）
- `token_registry_mcp`：代币实体标准化与黑白名单。
- `risk_state_mcp`：账户风险状态、限额和熔断状态。
- `backtest_replay_mcp`：历史事件回放与策略回测。

## 5. 多 Agent 协同设计（V3 推荐）

### 5.1 Agent 拓扑
1. `Collector Agent`：调度 MCP 拉流，写入事件总线。
2. `Fusion Agent`：实体解析、冲突合并、噪声过滤。
3. `Alpha Agent`：计算入场 Alpha 与退出 Risk-Off 信号。
4. `Risk Agent`：生成风险预算与交易许可令牌（Permit）。
5. `Execution Agent`：执行与成交跟踪。
6. `Supervisor Agent`：异常检测、杀开关、降级策略。

### 5.2 协同协议
- 所有 Agent 只通过事件总线通信，不直接互调。
- `Risk Agent` 输出的 Permit 是下单前置条件。
- `Execution Agent` 无 Permit 不可执行。

### 5.3 状态机
```text
DETECTED -> SCORED -> APPROVED -> STAGED -> SENT -> FILLED/PARTIAL/FAILED -> MANAGED -> CLOSED
```

## 6. 策略闭环（核心）

## 6.1 入场逻辑（Early In）
触发条件（示例阈值，可配置）：
- `KOL Pulse >= 70`
- `SmartMoney Netflow ZScore >= 1.8`
- `Retail FOMO <= 55`（尚未拥挤）
- `Liquidity Safety >= 60`
- `OpportunityScore >= 75`

动作：
- 小仓首单（试探单）`0.25R`
- 30-90 秒内二次确认后加仓到 `1.0R`

## 6.2 持仓管理（In Trade）
- 动态止损：`ATR + 波动率跳变` 联动。
- 保护利润：达到 `+1.5R` 后启用追踪止盈。
- 资金挤兑检测：滑点/失败率异常时禁止加仓。

## 6.3 退出逻辑（Crowd Exit）
任一触发即减仓或清仓：
- `Retail FOMO >= 80` 且增速持续 2 个窗口。
- 聪明钱从净流入转净流出。
- 深度骤降、价格冲击上升、成交失败率上升。
- 事件面反转（负面新闻/项目方异常转账）。

## 6.4 学习闭环（Post Trade）
- 记录每笔交易的信号快照、执行质量、PnL 归因。
- 更新：
  - KOL 可靠性权重
  - 聪明钱地址权重
  - 触发阈值（分市场状态）

## 7. 评分系统（OpportunityScore）

```text
OpportunityScore =
  0.25 * KOLScore
+ 0.25 * SmartMoneyScore
+ 0.15 * NewsImpactScore
+ 0.15 * OnchainMomentumScore
+ 0.10 * LiquidityScore
+ 0.10 * ExecutionQualityScore
- Penalty(Crowdedness, ManipulationRisk, SourceConflict)
```

### 7.1 市场状态分层
- `Regime A (Quiet)`：提高新信号阈值，降低出手频率。
- `Regime B (Trending)`：允许趋势跟随加仓。
- `Regime C (Mania)`：提高止盈敏感度，缩短持仓时长。

## 8. 风控体系（硬规则优先）

### 8.1 交易前
- 代币黑名单、合约安全评分、最小流动性门槛。
- 单币仓位上限：`<= NAV 5%`
- 单链风险上限：`<= NAV 35%`

### 8.2 交易中
- 最大滑点：按池深动态，但不超过上限（如 150 bps）。
- 连续失败熔断：`N` 次失败停止该 token/链交易。
- 异常波动熔断：分钟级振幅超阈值直接拒单。

### 8.3 交易后
- 日内回撤阈值（如 `-4%`）触发全局停机。
- 风险事件复盘报告自动生成。

### 8.4 Kill-Switch
- 手动开关 + 自动触发双通道。
- 触发后动作：取消挂单、停止新单、保留平仓权限。

## 9. BSC / Solana 执行专项

### 9.1 BSC
- 路由：PancakeSwap + 聚合器备选。
- 重点：gas 竞价策略、MEV 风险、失败重试与 nonce 管理。

### 9.2 Solana
- 路由：Jupiter。
- 重点：优先费、区块拥堵、RPC 多节点健康检查、交易重发窗口。

### 9.3 统一执行 SLA
- 机会到下单：P95 < 2s（理想）
- 下单到链上确认：按链拆分监控
- 失败恢复：< 5s 进入重试或降级

## 10. 数据与存储

- `Postgres`：订单、持仓、审计、配置版本。
- `Redis`：实时特征、限流、短期状态。
- `Object Storage`：原始事件归档、模型产物、复盘快照。
- `Feature Store`：在线/离线一致性管理。

## 11. 可观测性与运维

### 11.1 指标
- Alpha 指标：信号命中率、首小时 alpha 保留率。
- 执行指标：成交率、滑点、quote 偏差、确认延迟。
- 风险指标：VaR、回撤、集中度、熔断频次。

### 11.2 审计
- 每次决策保留“证据包”：输入信号、打分、规则校验、执行回执。
- 支持按 `trace_id` 全链路追踪。

## 12. 安全与权限

- 私钥隔离：MPC/HSM，策略层永不接触密钥明文。
- 最小权限：MCP token 分级授权。
- 机密管理：Vault/KMS，定期轮换。
- 供应链安全：依赖锁定、镜像签名、运行时完整性检查。

## 13. 发布与演进计划

### 13.1 V3 发布门槛
- Paper Trading 连续 30 天，样本数 > 500，策略稳定。
- Canary 真仓连续 14 天，回撤与执行指标达标。
- Kill-switch 演练与故障演练通过。

### 13.2 里程碑
1. `V3.1`：事件总线 + MCP 统一标准 + 风控 Permit。
2. `V3.2`：多 Agent 协同 + 自动执行网关。
3. `V3.3`：在线学习 + 自适应阈值 + 复盘自动化。

## 14. 结合你现有代码的迁移建议

- 复用：`addressMonitor/bscMonitor/solanaMonitor` 的监控基础能力。
- 替换：10 秒轮询为 WebSocket 订阅优先、轮询兜底。
- 扩展：`orderExecutor/copyTradingExecutor` 从“参数准备+确认”升级为“Permit 驱动自动执行”。
- 新增：
  - `signal-fusion-service`
  - `opportunity-scoring-service`
  - `risk-permit-service`
  - `execution-gateway-service`
  - `replay-backtest-service`

## 15. 最小可运行配置（建议）

- Agent：Fusion + Alpha + Risk + Execution + Supervisor。
- MCP：先接 `onchain_flow + smart_money + trade_execution`，再接社媒与新闻。
- 资金：先小资金、低并发、严格熔断。

---

## 附录 A：决策伪代码

```python
if kill_switch.on:
    reject_all_new_orders()

signal = fuse_signals(token)
score = calc_opportunity(signal)
permit = risk_agent.evaluate(score, portfolio_state)

if not permit.allowed:
    skip(token, permit.reason)

plan = execution_agent.plan_order(token, permit.size)
result = execution_agent.execute(plan)

position_manager.update(result)
learning_pipeline.record(signal, permit, result)
```

## 附录 B：关键验收指标

- PnL 不是唯一指标；必须同时满足：
  - 执行稳定性（成交率、延迟、滑点）
  - 风险稳定性（回撤、集中度、熔断恢复）
  - 信号稳定性（噪声率、漂移率、失效率）
