# Task Plan: BSC/Solana 山寨币自动交易机器人方案与可行性评估

## Goal
在不改现有代码的前提下，产出可执行的自动交易机器人系统方案，覆盖数据采集(MCP)、多Agent协同、策略决策、执行风控与分阶段落地，并给出可行性评估结论。

## Current Phase
Phase 5 (V3 文档交付完成)

## Phases
### Phase 1: Requirements & Discovery
- [x] 理解目标与约束（先方案，不改代码）
- [x] 盘点现有仓库能力边界
- [x] 梳理关键问题与风险
- **Status:** complete

### Phase 2: 方案架构设计
- [x] 设计 MCP 工具集边界
- [x] 设计单Agent与多Agent两套协同模式
- [x] 设计决策闭环（情绪+聪明钱+链上热度）
- **Status:** complete

### Phase 3: 可行性评估
- [x] 评估技术可行性（延迟、数据质量、执行能力）
- [x] 评估交易可行性（Alpha衰减、滑点、MEV）
- [x] 评估合规与平台约束
- **Status:** complete

### Phase 4: 落地路线图
- [x] 输出 MVP -> V2 -> V3 里程碑
- [x] 定义关键指标与验收标准
- [x] 定义失败保护与回滚策略
- **Status:** complete

### Phase 5: 交付
- [x] 给出最终建议（做/不做、如何做）
- [x] 提供下一步执行清单
- [x] 输出 V3 级系统架构文档到本地
- **Status:** complete

## Key Questions
1. 单Agent能否在时延和稳定性上满足“抢先买入”目标，还是必须多Agent并行？
2. 你给出的 6 类 MCP 信号如何量化成统一可交易评分？
3. 你的现有系统离“真实自动下单+风控闭环”还差哪些关键能力？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 先做“方案+可行性评估”，不改代码 | 符合用户当前请求 |
| 采用“事件驱动 + 分层Agent”思路作为主方案 | 与喊单/情绪/链上突发信号场景匹配 |
| 输出两种协同模式（1主Agent、3-5专用Agent） | 便于在复杂度与稳定性之间做权衡 |
| 本轮交付单份完整 V3 架构文档 | 用户明确要求“直接给 V3 并本地输出” |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `apply_patch` 读取 `task_plan.md` 失败 (非 UTF-8) | 1 | 改为 PowerShell 以 UTF-8 重写文件 |
