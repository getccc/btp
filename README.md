# 🚀 Crypto Monitor - Real-time Trading Data & Address Monitoring

实时监控 BSC 和 Solana 链上的代币交易数据和特定地址的交易活动。

## 📋 功能特性

### 📊 代币排名监控
- ✅ 实时监控 BSC 和 Solana 两条链
- ✅ 追踪最近 30 分钟的交易数据
- ✅ 按交易量或交易笔数排序
- ✅ WebSocket 实时推送更新（每 5 秒）
- ✅ 显示 Top 10 热门代币

### 📍 地址交易监控
- ✅ 监控特定钱包地址的所有交易
- ✅ 支持 BNB/SOL 和所有代币转账
- ✅ 自动识别 DEX 交易
- ✅ 实时推送新交易
- ✅ 支持同时监控多个地址
- ✅ 查看交易详情和区块链浏览器链接

### 💱 代币交易 (全面升级)

**核心交易功能**:
- ✅ BSC 链交易（通过 PancakeSwap）
- ✅ Solana 链交易（通过 Jupiter 聚合器）
- ✅ 支持所有主流代币（BNB, SOL, USDT, USDC等）
- ✅ 实时价格报价和最优路由
- ✅ 可调滑点设置 (0.1% - 3%)
- ✅ MetaMask & Phantom 钱包集成
- ✅ 自动获取余额和授权

**增强功能**:
- ✅ 交易历史记录（本地存储）
- ✅ 实时价格图表 (1H, 4H, 24H, 7D)
- ✅ 路由信息和价格影响显示
- ✅ 限价单功能 (Beta)
- ✅ 多链无缝切换

### 🎨 通用特性
- ✅ 美观的响应式 UI 界面
- ✅ 支持 Redis 持久化（可选）
- ✅ 完全免费方案（使用免费 API）

## 🏗️ 技术栈

### 后端
- Node.js + Express
- Socket.io (实时推送)
- Redis (可选，数据缓存)
- Axios (API 请求)
- DEXScreener API (数据源)

### 前端
- React 18
- Socket.io-client
- Ethers.js (BSC 交易)
- @solana/web3.js (Solana 交易)
- CSS3 (渐变背景 + 模糊效果)

## 📦 项目结构

```
crypto-monitor/
├── backend/                      # 后端服务
│   ├── server.js                # 主服务器文件
│   ├── services/
│   │   ├── dexscreener.js      # DEXScreener API 集成
│   │   ├── addressMonitor.js   # 地址监控核心服务
│   │   ├── bscMonitor.js       # BSC 链监控
│   │   └── solanaMonitor.js    # Solana 链监控
│   ├── utils/
│   │   └── redis.js            # Redis 工具类
│   ├── package.json
│   └── .env.example
│
└── frontend/                          # 前端应用
    ├── src/
    │   ├── App.js                    # 主应用组件
    │   ├── pages/
    │   │   ├── AddressMonitor.js    # 地址监控页面
    │   │   └── SwapPageEnhanced.js  # 增强版交易页面
    │   ├── hooks/
    │   │   ├── useWallet.js         # BSC钱包Hook (MetaMask)
    │   │   └── useSolanaWallet.js   # Solana钱包Hook (Phantom)
    │   ├── services/
    │   │   └── jupiterService.js    # Jupiter聚合交易服务
    │   ├── utils/
    │   │   └── tokens.js            # 代币配置和合约ABI
    │   └── components/
    │       ├── TokenList.js         # 代币列表组件
    │       ├── TransactionHistory.js # 交易历史组件
    │       ├── PriceChart.js        # 价格图表组件
    │       └── LimitOrder.js        # 限价单组件
    ├── package.json
    └── .env.example
```

## 💱 代币交易功能

**支持双链**: BSC (MetaMask) 和 Solana (Phantom)

📖 **完整使用指南**:
- [SWAP_GUIDE.md](SWAP_GUIDE.md) - 基础功能
- [SWAP_GUIDE_NEW_FEATURES.md](SWAP_GUIDE_NEW_FEATURES.md) - 新增功能详解

### 快速开始

**BSC 交易**:
1. 安装 MetaMask: https://metamask.io/
2. 添加 BSC 网络（应用自动提示）
3. 充值 BNB (Gas 费约 $0.3-0.6)
4. 点击 "💱 Swap" → "BSC (PancakeSwap)"

**Solana 交易**:
1. 安装 Phantom: https://phantom.app/
2. 创建或导入钱包
3. 充值 SOL (Gas 费约 $0.00025)
4. 点击 "💱 Swap" → "Solana (Jupiter)"

### 核心功能

**BSC**:
- BNB ⇄ 任意 BEP20 代币
- 通过 PancakeSwap Router V2
- 主流 DEX: PancakeSwap, BiSwap

**Solana**:
- SOL ⇄ 任意 SPL 代币
- 通过 Jupiter Aggregator V6
- 聚合 20+ DEX 获得最优价格

### 增强功能

- 📜 **交易历史**: 自动保存最近 50 笔交易
- 📊 **价格图表**: 多时间范围价格走势 (1H-7D)
- 🔀 **智能路由**: 显示最佳交易路径
- 📋 **限价单**: 设置目标价格自动执行 (Beta)
- ⚡ **极速切换**: BSC 和 Solana 一键切换

## 📍 地址监控功能

**重要**: 使用地址监控功能需要配置 BscScan API Key（免费）

📖 **详细使用指南**: [ADDRESS_MONITOR_GUIDE.md](ADDRESS_MONITOR_GUIDE.md)

### 快速配置

1. 注册免费 BscScan API: https://bscscan.com/myapikey
2. 在 `backend/.env` 中配置:
   ```env
   BSCSCAN_API_KEY=你的API_KEY
   ```
3. 重启后端服务
4. 访问前端，点击 "📍 Address Monitor" 开始监控

## 🚀 快速开始

### 前置要求

- Node.js >= 16.x
- npm 或 yarn
- Redis (可选，不安装会使用内存缓存)
- BscScan API Key (可选，用于地址监控功能)

### 1. 安装依赖

#### 后端
```bash
cd backend
npm install
```

#### 前端
```bash
cd frontend
npm install
```

### 2. 配置环境变量

#### 后端配置
```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件:
```env
PORT=5000
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379  # 可选，没有 Redis 会使用内存缓存

# BscScan API Key (用于地址监控功能)
# 免费注册: https://bscscan.com/myapikey
BSCSCAN_API_KEY=YourApiKeyToken  # 替换为你的 API Key
```

#### 前端配置
```bash
cd frontend
cp .env.example .env
```

编辑 `.env` 文件:
```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

### 3. 启动服务

#### 方式 1: 分别启动（推荐用于开发）

**启动后端:**
```bash
cd backend
npm start
```

后端将运行在 `http://localhost:5000`

**启动前端:**
```bash
cd frontend
npm start
```

前端将运行在 `http://localhost:3000`

#### 方式 2: 使用开发模式（自动重启）

**后端:**
```bash
cd backend
npm run dev
```

### 4. 访问应用

打开浏览器访问: http://localhost:3000

## 📊 数据说明

### 数据源
- 使用 DEXScreener 免费 API
- 每 10 秒获取一次最新数据
- 数据包含: 交易量、交易笔数、价格、流动性等

### 时间窗口
- 监控最近 30 分钟的交易数据
- 自动清理过期数据
- 滑动窗口实时更新

### 排序方式
1. **按交易量**: 显示 30 分钟内交易额最高的代币
2. **按交易笔数**: 显示 30 分钟内交易次数最多的代币

## 🎨 界面功能

- **链切换**: 在 BSC 和 Solana 之间切换
- **排序切换**: 在交易量和交易笔数之间切换
- **实时更新**: 每 5 秒自动推送最新数据
- **手动刷新**: 点击刷新按钮立即更新
- **连接状态**: 实时显示 WebSocket 连接状态
- **代币详情**: 点击查看 DEXScreener 上的详细信息

## 🔧 配置选项

### 后端配置

在 `backend/server.js` 中可调整:

```javascript
// 数据获取间隔（毫秒）
dataFetchInterval = setInterval(fetchData, 10000);  // 10秒

// 排名推送间隔（毫秒）
rankingInterval = setInterval(calculateAndPushRankings, 5000);  // 5秒

// 数据清理间隔（毫秒）
setInterval(cleanupOldData, 5 * 60 * 1000);  // 5分钟
```

### Redis 配置

如果不想使用 Redis:
- 不安装 Redis，系统会自动使用内存缓存
- 数据在服务器重启后会丢失
- 适合开发和测试环境

如果要使用 Redis（推荐生产环境）:
```bash
# 安装 Redis (Ubuntu/Debian)
sudo apt-get install redis-server

# 或使用 Docker
docker run -d -p 6379:6379 redis:alpine

# 启动 Redis
redis-server
```

## 📈 性能优化

### MVP 版本（当前）
- 每 10 秒 API 轮询
- 内存缓存（或 Redis）
- 适合个人使用

### 未来优化方向
1. **WebSocket 实时数据**: 连接 DEXScreener WebSocket 获取秒级更新
2. **数据库持久化**: 使用 PostgreSQL 或 MongoDB 存储历史数据
3. **缓存优化**: 实现多级缓存策略
4. **负载均衡**: 支持水平扩展

## 🐛 常见问题

### 1. 后端启动失败
```bash
# 检查端口是否被占用
netstat -ano | findstr :5000  # Windows
lsof -i :5000                 # Mac/Linux

# 修改 .env 中的 PORT
```

### 2. 前端无法连接后端
- 确保后端已启动
- 检查 `.env` 中的 `REACT_APP_BACKEND_URL`
- 查看浏览器控制台错误信息

### 3. 没有数据显示
- 等待 10-15 秒（首次获取数据需要时间）
- 检查后端日志是否有 API 错误
- 确认网络连接正常

### 4. Redis 连接失败
- 不影响使用，会自动切换到内存模式
- 如需 Redis，确保 Redis 服务已启动
- 检查 `REDIS_URL` 配置是否正确

## 📝 API 接口

### REST API

#### 健康检查
```
GET /api/health
```

返回:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "redis": "connected",
  "clients": 2,
  "tasksRunning": true
}
```

#### 获取排名数据
```
GET /api/rankings/:chain
```

参数:
- `chain`: `bsc` 或 `solana`

返回:
```json
{
  "topByVolume": [...],
  "topByTxns": [...],
  "totalTokens": 150
}
```

### WebSocket Events

#### 客户端 -> 服务器
- `request-update`: 请求立即更新数据

#### 服务器 -> 客户端
- `rankings-update`: 推送最新排名数据

## 🎯 开发计划

### Phase 1: MVP ✅
- [x] 基础数据采集
- [x] API 轮询
- [x] 简单 UI 展示
- [x] WebSocket 推送

### Phase 2: 功能增强 (计划中)
- [ ] 添加价格走势图表
- [ ] 支持更多链（Ethereum, Polygon 等）
- [ ] 添加代币搜索功能
- [ ] 实现数据导出功能

### Phase 3: 性能优化 (计划中)
- [ ] WebSocket 实时数据流
- [ ] 数据库持久化
- [ ] 历史数据查询
- [ ] 用户自定义监控

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📞 支持

如有问题，请创建 Issue 或联系开发者。

---

**享受实时监控加密货币交易的乐趣! 🚀📈**
