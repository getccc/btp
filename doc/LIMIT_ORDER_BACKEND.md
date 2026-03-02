# 📋 限价单后端实现文档

## 概述

限价单功能允许用户设置目标价格，当市场价格达到目标时自动准备执行交易。系统采用事件驱动架构，由三个核心服务组成。

## 🏗️ 系统架构

```
┌─────────────────┐
│   Frontend      │
│  (React + WS)   │
└────────┬────────┘
         │ WebSocket / REST API
         │
┌────────▼────────────────────────────────────┐
│            Backend Server                    │
│         (Express + Socket.io)                │
└──┬───────────┬─────────────┬────────────────┘
   │           │             │
   ▼           ▼             ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│  Limit   │ │  Price   │ │    Order     │
│  Order   │ │ Monitor  │ │   Executor   │
│ Manager  │ │          │ │              │
└──────────┘ └──────────┘ └──────────────┘
```

### 核心服务

#### 1. limitOrderManager.js
**职责**: 订单生命周期管理
- 创建、取消、更新订单
- 订单状态管理 (active, filled, cancelled, expired, failed)
- 过期订单检查和清理
- 订单查询和统计

**存储**: 使用 Map 进行内存存储
```javascript
{
  orderId: 'bsc-1',
  userAddress: '0x...',
  chain: 'bsc',
  fromToken: { symbol, address, decimals },
  toToken: { symbol, address, decimals },
  fromAmount: 100,
  targetPrice: 1.5,
  slippage: 0.5,
  orderType: 'limit', // 'limit' or 'stop-loss'
  status: 'active',
  attempts: 0,
  maxAttempts: 3,
  createdAt: 1234567890,
  expiryTime: 1234567890
}
```

#### 2. priceMonitor.js
**职责**: 价格监控和触发检测
- 每10秒轮询价格
- 使用 DexScreener API (BSC) 和 Jupiter Price API (Solana)
- 检测是否满足触发条件
- 发出 'priceTargetReached' 事件

**逻辑**:
- **限价单 (limit)**: 当 `currentPrice >= targetPrice` 时触发
- **止损单 (stop-loss)**: 当 `currentPrice <= targetPrice` 时触发

#### 3. orderExecutor.js
**职责**: 交易执行准备和确认
- 准备交易参数 (BSC Router 参数 / Solana Jupiter 参数)
- 计算预期输出和最小可接受金额
- 等待用户确认 (不自动执行，保证安全)
- 记录执行历史

**安全设计**:
- 不存储私钥
- 不自动执行交易
- 所有交易需要前端用户通过钱包确认

## 📡 REST API 端点

### 1. 创建限价单
```http
POST /api/limit-orders/create
Content-Type: application/json

{
  "userAddress": "0x...",
  "chain": "bsc",
  "fromToken": {
    "symbol": "BNB",
    "address": "0x...",
    "decimals": 18
  },
  "toToken": {
    "symbol": "USDT",
    "address": "0x...",
    "decimals": 18
  },
  "fromAmount": 1.0,
  "targetPrice": 300,
  "slippage": 0.5,
  "orderType": "limit",
  "expiryTime": 1234567890
}
```

**响应**:
```json
{
  "success": true,
  "order": {
    "orderId": "bsc-1",
    "userAddress": "0x...",
    "status": "active",
    ...
  }
}
```

### 2. 取消订单
```http
POST /api/limit-orders/:orderId/cancel
```

**响应**:
```json
{
  "success": true,
  "order": {
    "orderId": "bsc-1",
    "status": "cancelled",
    ...
  }
}
```

### 3. 获取用户订单
```http
GET /api/limit-orders/user/:address?chain=bsc&status=active
```

**响应**:
```json
{
  "success": true,
  "orders": [
    {
      "orderId": "bsc-1",
      "status": "active",
      ...
    }
  ]
}
```

### 4. 获取单个订单
```http
GET /api/limit-orders/:orderId
```

### 5. 获取统计信息
```http
GET /api/limit-orders/stats
```

**响应**:
```json
{
  "success": true,
  "stats": {
    "totalOrders": 50,
    "activeOrders": 10,
    "filledOrders": 30,
    "cancelledOrders": 8,
    "expiredOrders": 2
  }
}
```

### 6. 获取待执行列表
```http
GET /api/limit-orders/execution/pending
```

### 7. 获取执行历史
```http
GET /api/limit-orders/execution/history?limit=50
```

## 🔌 WebSocket 事件

### 客户端 → 服务器

#### 1. 创建限价单
```javascript
socket.emit('create-limit-order', {
  userAddress: '0x...',
  chain: 'bsc',
  fromToken: {...},
  toToken: {...},
  fromAmount: 1.0,
  targetPrice: 300,
  slippage: 0.5,
  orderType: 'limit',
  expiryTime: 1234567890
});
```

#### 2. 取消订单
```javascript
socket.emit('cancel-limit-order', {
  orderId: 'bsc-1'
});
```

#### 3. 请求用户订单
```javascript
socket.emit('request-user-orders', {
  userAddress: '0x...',
  chain: 'bsc'
});
```

#### 4. 确认执行
```javascript
socket.emit('confirm-execution', {
  orderId: 'bsc-1',
  txHash: '0x...'
});
```

#### 5. 取消执行
```javascript
socket.emit('cancel-execution', {
  orderId: 'bsc-1'
});
```

### 服务器 → 客户端

#### 1. 订单创建成功
```javascript
socket.on('order-created', (order) => {
  // order 包含完整的订单信息
});
```

#### 2. 订单取消成功
```javascript
socket.on('order-cancelled', (order) => {
  // order 包含更新后的订单信息
});
```

#### 3. 订单更新
```javascript
socket.on('order-updated', (order) => {
  // 订单状态变化时触发
});
```

#### 4. 准备执行 (价格达到目标)
```javascript
socket.on('execution-ready', (execution) => {
  // execution 包含:
  // - orderId
  // - order (原始订单)
  // - currentPrice (当前价格)
  // - expectedOutput (预期输出)
  // - minOutput (最小输出)
  // - params (交易参数)
  // - timestamp
});
```

#### 5. 执行确认成功
```javascript
socket.on('execution-confirmed', (execution) => {
  // execution 包含确认后的执行信息和 txHash
});
```

#### 6. 执行失败
```javascript
socket.on('execution-failed', (execution) => {
  // execution.error 包含失败原因
});
```

#### 7. 用户订单列表
```javascript
socket.on('user-orders', ({ userAddress, chain, orders }) => {
  // orders 是订单数组
});
```

#### 8. 错误信息
```javascript
socket.on('order-error', ({ error }) => {
  // error 是错误消息
});
```

## 🔄 完整执行流程

### 1. 创建订单
```
用户 → Frontend → WebSocket → Backend
                                  ↓
                          limitOrderManager.createOrder()
                                  ↓
                          存储订单到 Map
                                  ↓
                          发出 'orderCreated' 事件
                                  ↓
                          WebSocket → Frontend → 用户
```

### 2. 价格监控
```
priceMonitor (每10秒)
     ↓
获取所有活跃订单
     ↓
按链分组 (BSC / Solana)
     ↓
并行获取价格
     ↓
检查每个订单是否满足触发条件
     ↓
满足条件?
     ↓ YES
发出 'priceTargetReached' 事件
```

### 3. 准备执行
```
priceMonitor 发出 'priceTargetReached'
     ↓
orderExecutor.prepareExecution()
     ↓
根据链准备交易参数
  - BSC: PancakeSwap Router 参数
  - Solana: Jupiter 交易参数
     ↓
计算预期输出和最小金额
     ↓
存储到 pendingExecutions
     ↓
发出 'executionReady' 事件
     ↓
WebSocket → Frontend
     ↓
弹出确认对话框
```

### 4. 用户确认执行
```
用户在前端确认
     ↓
通过钱包签名交易
     ↓
获得 txHash
     ↓
WebSocket → Backend
     ↓
orderExecutor.confirmExecution(orderId, txHash)
     ↓
更新订单状态为 'filled'
     ↓
添加到执行历史
     ↓
从 pendingExecutions 移除
     ↓
发出 'executionConfirmed' 事件
     ↓
WebSocket → Frontend → 显示成功
```

### 5. 执行失败或取消
```
交易失败 / 用户取消
     ↓
orderExecutor.failExecution() / cancelExecution()
     ↓
记录尝试次数
     ↓
attempts < maxAttempts?
  YES → 保持订单为 active，继续监控
  NO  → 更新订单状态为 'failed'
     ↓
发出相应事件
```

## ⚙️ 配置说明

### 环境变量
```bash
# .env 文件
PORT=5000
FRONTEND_URL=http://localhost:3000

# BSC API (可选，用于更精确的价格)
BSCSCAN_API_KEY=your_api_key

# Solana RPC (可选，使用自定义节点)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### 价格监控频率
在 `priceMonitor.js` 中修改:
```javascript
// 默认10秒
this.checkInterval = 10000; // 毫秒
```

### 订单过期检查
在 `limitOrderManager.js` 中:
```javascript
checkExpiredOrders() {
  const now = Date.now();
  // 检查所有订单的 expiryTime
}
```

### 最大尝试次数
在创建订单时设置:
```javascript
maxAttempts: 3 // 执行失败后最多重试3次
```

## 🛠️ 部署和运行

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置环境变量
创建 `.env` 文件并配置必要的环境变量

### 3. 启动服务器
```bash
npm start
```

### 4. 验证运行状态
```bash
curl http://localhost:5000/api/health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "redis": "connected",
  "clients": 2,
  "tasksRunning": true
}
```

## 📊 监控和日志

### 控制台日志
系统会输出以下关键日志:

```
🚀 Starting limit order monitoring...
✅ Limit order monitoring started

📋 New limit order created: bsc-1
🔍 Checking prices for 5 active orders...
🎯 Price target reached for order bsc-1: 302.5
⏳ Execution ready for order bsc-1, waiting for user confirmation
✅ Execution confirmed for order bsc-1
```

### 统计信息
通过 API 获取实时统计:
```javascript
const stats = limitOrderManager.getStats();
// {
//   totalOrders: 50,
//   activeOrders: 10,
//   filledOrders: 30,
//   ...
// }
```

## 🔐 安全考虑

### 1. 不存储私钥
- 所有交易需要前端通过钱包签名
- 后端只准备交易参数，不执行签名

### 2. 用户确认
- 价格达到目标后，必须用户手动确认
- 防止恶意或意外执行

### 3. 滑点保护
- 每个订单设置 slippage 参数
- 计算 minOutput 防止价格剧烈波动

### 4. 尝试次数限制
- maxAttempts 限制失败重试次数
- 防止无限循环

### 5. 订单过期
- 每个订单都有 expiryTime
- 定期清理过期订单

## 🐛 故障排查

### 1. 订单未触发
**问题**: 价格已达到目标，但订单未执行

**排查**:
- 检查 priceMonitor 是否正常运行
- 查看价格 API 是否返回正确数据
- 确认订单状态为 'active'
- 检查订单是否已过期

### 2. 价格获取失败
**问题**: 无法获取代币价格

**排查**:
- BSC: 检查 DexScreener API 是否可用
- Solana: 检查 Jupiter Price API 是否可用
- 查看网络连接
- 确认代币地址正确

### 3. WebSocket 连接断开
**问题**: 前端无法接收实时更新

**排查**:
- 检查 CORS 配置
- 确认 FRONTEND_URL 环境变量正确
- 查看前端 WebSocket 连接状态
- 检查防火墙设置

### 4. 执行失败
**问题**: 准备执行后用户确认失败

**排查**:
- 查看 execution.error 错误信息
- 确认用户有足够余额
- 检查 Gas 费设置
- 验证代币授权 (approve)

## 📈 性能优化

### 1. 价格查询优化
```javascript
// 按链分组，并行查询
const ordersByChain = groupOrdersByChain(activeOrders);
await Promise.all([
  checkBSCOrders(ordersByChain.bsc || []),
  checkSolanaOrders(ordersByChain.solana || [])
]);
```

### 2. 批量价格获取
```javascript
// Solana: 一次请求获取多个代币价格
const prices = await jupiterService.getPrices(tokenAddresses);
```

### 3. 内存清理
```javascript
// 定期清理过期的待执行订单
setInterval(() => {
  orderExecutor.cleanupPendingExecutions();
}, 30 * 60 * 1000); // 每30分钟
```

### 4. 限制历史大小
```javascript
// 限制执行历史条数
if (this.executionHistory.length > this.maxHistorySize) {
  this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
}
```

## 🚀 未来增强

### 1. 数据持久化
- 使用 Redis 或 MongoDB 存储订单
- 服务器重启后恢复订单

### 2. 高级订单类型
- 止盈止损 (Take Profit / Stop Loss)
- 条件订单 (Conditional Orders)
- 冰山订单 (Iceberg Orders)

### 3. 通知系统
- 邮件通知
- Telegram Bot
- 推送通知

### 4. 性能监控
- 订单执行成功率
- 平均执行时间
- 价格偏差分析

### 5. 链上订单簿
- 使用智能合约存储订单
- 实现完全去中心化

## 📞 支持

如遇问题请查看:
1. 本文档的故障排查章节
2. 后端控制台日志
3. 浏览器开发者工具 (Network, Console)
4. GitHub Issues

---

**版本**: 1.0.0
**最后更新**: 2025-01
**作者**: BTP Team
