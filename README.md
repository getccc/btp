# 🚀 Crypto Monitor - Real-time Trading Data

实时监控 BSC 和 Solana 链上的代币交易数据，追踪最近 30 分钟内交易量和交易笔数最高的 Top 10 代币。

## 📋 功能特性

- ✅ 实时监控 BSC 和 Solana 两条链
- ✅ 追踪最近 30 分钟的交易数据
- ✅ 按交易量或交易笔数排序
- ✅ WebSocket 实时推送更新（每 5 秒）
- ✅ 美观的响应式 UI 界面
- ✅ 支持 Redis 持久化（可选）
- ✅ 完全免费方案（使用 DEXScreener API）

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
- CSS3 (渐变背景 + 模糊效果)

## 📦 项目结构

```
crypto-monitor/
├── backend/                 # 后端服务
│   ├── server.js           # 主服务器文件
│   ├── services/
│   │   └── dexscreener.js  # DEXScreener API 集成
│   ├── utils/
│   │   └── redis.js        # Redis 工具类
│   ├── package.json
│   └── .env.example
│
└── frontend/               # 前端应用
    ├── src/
    │   ├── App.js         # 主应用组件
    │   ├── components/
    │   │   └── TokenList.js  # 代币列表组件
    │   └── index.js
    ├── package.json
    └── .env.example
```

## 🚀 快速开始

### 前置要求

- Node.js >= 16.x
- npm 或 yarn
- Redis (可选，不安装会使用内存缓存)

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

编辑 `.env` 文件（可选）:
```env
PORT=5000
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379  # 可选，没有 Redis 会使用内存缓存
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
