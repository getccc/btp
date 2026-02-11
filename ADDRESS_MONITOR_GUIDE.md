# 📍 地址监控功能使用指南

## 功能介绍

地址监控功能允许你实时监控 BSC 和 Solana 链上特定钱包地址的所有交易活动，包括:

- ✅ 原生代币转账 (BNB/SOL)
- ✅ 代币转账 (BEP20/SPL Token)
- ✅ DEX 交易 (PancakeSwap, Raydium, Orca 等)
- ✅ 实时 WebSocket 推送
- ✅ 交易详情查看

## 🔑 配置 BscScan API Key (必需)

### 1. 注册免费 API Key

BSC 链监控需要 BscScan API Key，完全免费:

1. 访问: https://bscscan.com/register
2. 注册账号并登录
3. 访问: https://bscscan.com/myapikey
4. 点击 "Add" 创建新的 API Key
5. 复制生成的 API Key

### 2. 配置到项目

在后端目录创建 `.env` 文件:

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件，替换 API Key:

```env
# BscScan API Configuration
BSCSCAN_API_KEY=你的API_KEY
```

### 3. 重启后端服务

```bash
cd backend
npm start
```

## 📊 Solana 配置 (可选)

Solana 使用公共 RPC 节点，无需配置。如果你有付费的 RPC 节点，可以修改:

编辑 `backend/services/solanaMonitor.js`:

```javascript
this.rpcUrls = [
  'https://your-premium-rpc-url.com',  // 你的付费节点
  'https://api.mainnet-beta.solana.com'
];
```

## 🚀 使用方法

### 1. 启动应用

确保前后端都已启动:

```bash
# 后端
cd backend
npm start

# 前端 (新终端)
cd frontend
npm start
```

### 2. 访问地址监控页面

1. 打开浏览器访问: http://localhost:3000
2. 点击顶部导航栏的 **"📍 Address Monitor"** 按钮

### 3. 添加监控地址

1. 点击 **"➕ Add Address"** 按钮
2. 填写表单:
   - **Chain**: 选择 BSC 或 Solana
   - **Address**: 输入要监控的钱包地址
     - BSC: `0x...` 格式 (42 位十六进制)
     - Solana: Base58 编码地址 (32-44 位)
   - **Label**: 可选，给地址起个昵称 (如 "我的钱包")
3. 点击 **"Add"** 添加

### 4. 查看实时交易

1. 在左侧面板选择一个地址
2. 右侧会显示该地址的所有交易
3. 新交易会自动实时推送并显示

### 5. 删除监控地址

点击地址卡片上的 **🗑️** 图标即可删除

## 📱 界面说明

### 左侧面板 - 监控地址列表

- 显示所有正在监控的地址
- 可按链类型筛选 (All/BSC/Solana)
- 显示每个地址的交易数量
- 点击地址查看详细交易

### 右侧面板 - 交易列表

- 实时显示所选地址的所有交易
- 交易信息包括:
  - 类型 (IN/OUT/SWAP)
  - 金额和代币
  - 发送方和接收方
  - 时间戳
  - 交易状态
- 点击 "View on Explorer" 查看链上详情

## 🎨 交易类型说明

| 类型 | 图标 | 说明 |
|------|------|------|
| IN | 📥 | 转入交易 (收款) |
| OUT | 📤 | 转出交易 (付款) |
| SWAP | 🔄 | 代币兑换 |
| DEX | 💱 | DEX 交易标记 |

## ⚙️ 监控频率配置

### BSC 链

在 `backend/services/bscMonitor.js` 中配置:

```javascript
this.scanIntervalMs = 10000; // 10秒扫描一次 (默认)
```

**注意**:
- BscScan 免费 API 限制: 5 calls/秒
- 监控地址越多，需要的调用次数越多
- 建议不超过 5 个地址同时监控

### Solana 链

在 `backend/services/solanaMonitor.js` 中配置:

```javascript
this.scanIntervalMs = 10000; // 10秒扫描一次 (默认)
```

## 🔍 DEX 识别

### BSC DEX 支持

自动识别以下 DEX 交易:

- PancakeSwap (Router V1 & V2)
- SushiSwap
- BiSwap
- BakerySwap

### Solana DEX 支持

自动识别以下 DEX 交易:

- Raydium
- Orca & Orca Whirlpool
- Jupiter Aggregator

## 💡 使用技巧

### 1. 监控鲸鱼地址

监控知名交易者的地址，及时了解大额交易:

```
BSC 示例: 0x8894e0a0c962cb723c1976a4421c95949be2d4e3
Solana 示例: 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1
```

### 2. 监控项目方地址

监控代币项目方的钱包，了解代币流动:

- 查看项目方转账记录
- 监控代币增发/销毁
- 跟踪流动性操作

### 3. 监控自己的地址

实时监控自己的钱包安全:

- 及时发现异常交易
- 跟踪收款到账情况
- 记录交易历史

## ⚠️ 注意事项

### API 限制

1. **BscScan 免费 API**:
   - 5 calls/秒
   - 100,000 calls/天
   - 建议监控 3-5 个地址

2. **Solana 公共 RPC**:
   - 可能有限流
   - 建议使用付费 RPC 节点提高稳定性

### 数据说明

1. **交易延迟**:
   - BSC: 10-30秒延迟 (取决于扫描间隔)
   - Solana: 10-30秒延迟

2. **历史数据**:
   - 不保存历史数据
   - 仅显示监控期间的交易
   - 重启后清空所有数据

3. **代币信息**:
   - Solana 代币符号可能显示为 "TOKEN"
   - 可以点击链接到浏览器查看完整信息

## 🐛 常见问题

### 1. BSC 地址没有新交易显示

**可能原因**:
- API Key 未配置或无效
- 该地址确实没有新交易
- API 限流

**解决方法**:
```bash
# 检查后端日志
cd backend
npm start

# 查看是否有报错信息
# 如果看到 "401" 或 "403"，说明 API Key 有问题
```

### 2. Solana 交易信息不完整

**可能原因**:
- 公共 RPC 节点限流
- 交易类型无法解析

**解决方法**:
- 使用付费 RPC 节点
- 点击 "View on Explorer" 查看完整信息

### 3. 添加地址后没有反应

**可能原因**:
- 地址格式错误
- WebSocket 连接断开

**解决方法**:
- 检查地址格式是否正确
- 刷新页面重新连接
- 查看右上角连接状态

### 4. 内存占用过高

**解决方法**:

编辑 `backend/services/addressMonitor.js`:

```javascript
this.maxTransactionsPerAddress = 50; // 减少到 50 条
```

## 📈 性能优化建议

### 1. 减少监控地址数量

同时监控不超过 5 个地址，避免 API 限流

### 2. 调整扫描间隔

如果不需要秒级实时性，可以增加扫描间隔:

```javascript
// BSC
this.scanIntervalMs = 30000; // 改为 30 秒

// Solana
this.scanIntervalMs = 30000; // 改为 30 秒
```

### 3. 使用付费 API

- BscScan: 升级到付费 API 提高限制
- Solana: 使用 Helius、QuickNode 等付费 RPC

## 🔒 安全建议

1. **不要泄露 API Key**:
   - 不要提交 `.env` 文件到 Git
   - 不要在前端暴露 API Key

2. **只监控公开地址**:
   - 不要输入包含私钥的内容
   - 只需要钱包地址，不需要私钥

3. **谨慎对待链接**:
   - 交易链接会跳转到区块链浏览器
   - 确认 URL 正确后再访问

## 📞 技术支持

如遇问题:

1. 查看后端日志输出
2. 查看浏览器控制台 (F12)
3. 检查 API 配置是否正确
4. 参考本文档的常见问题部分

---

**祝你监控顺利! 🎉**
