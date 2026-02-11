# 🚀 快速启动指南

## 一键安装所有依赖

### Windows
```bash
# 安装后端依赖
cd backend && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

### Mac/Linux
```bash
# 一次性安装所有依赖
cd backend && npm install && cd .. && cd frontend && npm install && cd ..

# 或者使用 && 连接
(cd backend && npm install) && (cd frontend && npm install)
```

## 最简启动（无 Redis）

### 1. 启动后端
```bash
cd backend
node server.js
```

看到以下输出表示启动成功:
```
==================================================
🎯 Crypto Monitor Backend Server
==================================================
🌐 Server running on http://localhost:5000
📡 WebSocket server ready
💾 Redis: Memory-only mode
==================================================
```

### 2. 启动前端（新终端窗口）
```bash
cd frontend
npm start
```

浏览器会自动打开 http://localhost:3000

## ⚡ 验证运行状态

### 检查后端
访问: http://localhost:5000/api/health

应该看到:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "redis": "disconnected",
  "clients": 0,
  "tasksRunning": true
}
```

### 检查前端
1. 打开 http://localhost:3000
2. 查看右上角连接状态是否显示 "Connected"
3. 等待 10-15 秒，应该会看到代币列表

## 🔍 调试技巧

### 后端日志
后端会输出以下日志:
```
🔄 Fetching data... (12:34:56)
📊 BSC pairs: 100, Solana pairs: 80
✅ Data processed and stored
📈 Calculating rankings... (12:34:58)
✅ Rankings pushed to clients
```

### 前端控制台
打开浏览器开发者工具 (F12)，查看:
- `✅ Connected to backend` - 连接成功
- `📊 Received rankings update` - 收到数据更新

## 🎯 常用端口

- 后端: http://localhost:5000
- 前端: http://localhost:3000
- Redis (可选): localhost:6379

## 💡 提示

1. **首次运行**: 需要等待 10-15 秒才能看到数据
2. **无数据**: 检查网络连接，确保能访问 DEXScreener API
3. **端口冲突**: 修改 `backend/.env` 中的 `PORT` 配置
4. **停止服务**: 在终端按 `Ctrl+C`

## 📱 移动端访问

如果想在手机上访问:

1. 确保手机和电脑在同一 Wi-Fi 网络
2. 查看电脑 IP 地址 (如: 192.168.1.100)
3. 修改 `frontend/.env`:
   ```
   REACT_APP_BACKEND_URL=http://192.168.1.100:5000
   ```
4. 在手机浏览器访问: http://192.168.1.100:3000

---

**现在开始监控加密货币吧! 🎉**
