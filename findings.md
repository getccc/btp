# Findings & Decisions

## Requirements
- 用户目标：把当前项目演进为 BSC + Solana 山寨币自动交易机器人。
- 核心交易逻辑：
  - 在喊单/情绪扩散早期买入，在散户普遍 FOMO 阶段撤离。
  - 跟随聪明钱买入，在散户大规模涌入时撤离。
- 监控维度：
  - 固定 KOL（X）喊单强度。
  - Telegram 群组情绪与扩散强度。
  - 币圈媒体/交易所新闻热度。
  - 链上交易动态。
  - 链上聪明钱动态。
- 约束：本轮先做方案和可行性评估，不改代码。

## Research Findings
- 现有仓库已具备：BSC/Solana 地址监控、限价单执行参数准备、跟单配置与事件流，但自动执行仍偏“半自动确认”模型。
- 官方文档验证到的外部能力：
  - Solana RPC 支持 WebSocket `logsSubscribe` / `accountSubscribe`，可用于低延迟监听。
  - BNB Chain 提供 HTTP 与 WebSocket RPC 端点，支持实时订阅。
  - Telegram Bot API 可用于群消息采集（需机器人在群内并有权限）。
  - Jupiter 提供 Swap API 作为 Solana 路由与交易构建基础。
  - X API 提供 streaming 能力，但权限/成本和合规门槛较高。
  - MCP 有标准化协议能力，适合把多源采集封装成统一可调用工具。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 将 6 类 MCP 拆为“采集层 MCP + 交易层 MCP” | 降低耦合，便于替换数据源 |
| 采用“策略Agent 与执行Agent分离” | 避免 LLM 直接持有私钥并下单 |
| 使用“评分卡 + 规则闸门”而非纯 LLM 端到端决策 | 提高可解释性与风险可控性 |
| 首版先上单Agent编排，后续演进多Agent | 更快验证端到端闭环 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 无代码改动前提下，难以做实测收益验证 | 采用架构可行性 + 风险约束 + MVP实验设计替代 |

## Resources
- Solana RPC WebSocket methods: https://solana.com/docs/rpc/websocket
- BNB Chain RPC endpoints: https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
- Telegram Bot API: https://core.telegram.org/bots/api
- Jupiter docs: https://dev.jup.ag/docs/api/swap-api
- X filtered stream intro: https://developer.x.com/en/docs/x-api/filtered-stream-introduction
- Model Context Protocol docs: https://modelcontextprotocol.io/introduction

## Visual/Browser Findings
- 本轮主要是文档检索，无图片/PDF关键信息。
- 关键结论已转录到 Research Findings 与 Resources。

## Codebase Gap Snapshot (2026-03-01)
- `backend/services/orderExecutor.js` 仅做 `prepareExecution` + 等待 `confirmExecution`，注释明确“实际执行需要用户授权和私钥”。
- `backend/services/copyTradingExecutor.js` 的 `autoExecute` 也只是 emit `copyTradeReady` 给前端，不是后端自动签名广播。
- BSC/Solana 地址监控目前是轮询模型（默认 10s 间隔），而不是实时订阅模型；对于“资讯扩散前抢跑”时延偏高。
- 因此现状更像“交易参数生成 + 人工确认 + 监控面板”，距离“全自动交易机器人”仍有执行引擎、低延迟数据通道、风控闭环三大缺口。

## External Constraint Snapshot (Official Docs)
- X Filtered Stream 文档给出约 `6-7s P99 latency`，并且不同 access level 的连接数和规则数有上限；这意味着“社媒信号抢跑”能力受平台级延迟与配额约束。
- Telegram Bot API 支持 `getUpdates`(long polling) 与 `setWebhook` 两种接收模式，二者互斥；生产环境应优先 webhook 以降低轮询延迟。
- Solana RPC 文档明确提供 `logsSubscribe/accountSubscribe/programSubscribe` 等 WebSocket 订阅能力，适合替代当前 10s 轮询。
- BNB Chain JSON-RPC 文档给出公共端点速率限制与对 `eth_getLogs` 的限制提示，且官方建议高频日志场景优先 WebSocket 推送。
- Jupiter Swap API 可以返回 `base64-encoded unsigned swap transaction`，说明你可把“路由/组交易”与“本地签名/风控网关”解耦。
- MCP 文档强调其作为连接外部数据与工具的标准协议，适合把你的 6 类采集能力封装为统一工具集。

## Deliverables (2026-03-01)
- 已输出本地文档：`V3_AUTOTRADING_SYSTEM_ARCHITECTURE.md`
- 文档覆盖：
  - V3 分层架构（采集/事件/特征/Agent/执行/治理）
  - MCP 工具集接口规范（统一包络、事件标准、各 MCP 方法）
  - 多 Agent 协同协议与状态机
  - 策略闭环（入场、持仓、退出、学习）
  - 风控体系、执行专项、SLA、可观测性与发布门槛

