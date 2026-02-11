require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const redisManager = require('./utils/redis');
const dexScreenerService = require('./services/dexscreener');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// 全局状态
let isRunning = false;
let dataFetchInterval = null;
let rankingInterval = null;
let connectedClients = 0;

// Socket.io连接处理
io.on('connection', (socket) => {
  connectedClients++;
  console.log(`✅ Client connected (Total: ${connectedClients})`);

  // 发送当前数据
  sendCurrentRankings(socket);

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`❌ Client disconnected (Total: ${connectedClients})`);
  });

  socket.on('request-update', async () => {
    await sendCurrentRankings(socket);
  });
});

// 发送当前排名数据
async function sendCurrentRankings(socket = null) {
  try {
    const bscData = await dexScreenerService.calculateTop10('bsc');
    const solanaData = await dexScreenerService.calculateTop10('solana');

    const data = {
      timestamp: Date.now(),
      bsc: bscData,
      solana: solanaData
    };

    if (socket) {
      socket.emit('rankings-update', data);
    } else {
      io.emit('rankings-update', data);
    }
  } catch (error) {
    console.error('Error sending rankings:', error);
  }
}

// 数据采集任务
async function fetchData() {
  console.log(`🔄 Fetching data... (${new Date().toLocaleTimeString()})`);

  try {
    // 同时获取BSC和Solana数据
    const [bscPairs, solanaPairs] = await Promise.all([
      dexScreenerService.fetchChainData('bsc'),
      dexScreenerService.fetchChainData('solana')
    ]);

    console.log(`📊 BSC pairs: ${bscPairs.length}, Solana pairs: ${solanaPairs.length}`);

    // 处理并存储数据
    await Promise.all([
      dexScreenerService.processAndStore(bscPairs, 'bsc'),
      dexScreenerService.processAndStore(solanaPairs, 'solana')
    ]);

    console.log('✅ Data processed and stored');
  } catch (error) {
    console.error('❌ Error in fetchData:', error);
  }
}

// 排名计算和推送任务
async function calculateAndPushRankings() {
  console.log(`📈 Calculating rankings... (${new Date().toLocaleTimeString()})`);

  try {
    await sendCurrentRankings();
    console.log('✅ Rankings pushed to clients');
  } catch (error) {
    console.error('❌ Error in calculateAndPushRankings:', error);
  }
}

// 清理过期数据任务
function cleanupOldData() {
  console.log('🧹 Cleaning up old data...');
  dexScreenerService.cleanMemoryCache();
}

// 启动定时任务
function startScheduledTasks() {
  if (isRunning) {
    console.log('⚠️  Tasks already running');
    return;
  }

  console.log('🚀 Starting scheduled tasks...');
  isRunning = true;

  // 立即执行一次
  fetchData();

  // 每10秒获取一次数据
  dataFetchInterval = setInterval(fetchData, 10000);

  // 每5秒计算并推送一次排名
  rankingInterval = setInterval(calculateAndPushRankings, 5000);

  // 每5分钟清理一次过期数据
  setInterval(cleanupOldData, 5 * 60 * 1000);

  console.log('✅ Scheduled tasks started');
  console.log('   - Data fetch: every 10 seconds');
  console.log('   - Rankings push: every 5 seconds');
  console.log('   - Cleanup: every 5 minutes');
}

// 停止定时任务
function stopScheduledTasks() {
  if (!isRunning) {
    console.log('⚠️  Tasks not running');
    return;
  }

  console.log('🛑 Stopping scheduled tasks...');

  if (dataFetchInterval) clearInterval(dataFetchInterval);
  if (rankingInterval) clearInterval(rankingInterval);

  isRunning = false;
  console.log('✅ Scheduled tasks stopped');
}

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    redis: redisManager.isConnected ? 'connected' : 'disconnected',
    clients: connectedClients,
    tasksRunning: isRunning
  });
});

app.get('/api/rankings/:chain', async (req, res) => {
  try {
    const { chain } = req.params;

    if (!['bsc', 'solana'].includes(chain)) {
      return res.status(400).json({ error: 'Invalid chain. Use bsc or solana' });
    }

    const data = await dexScreenerService.calculateTop10(chain);
    res.json(data);
  } catch (error) {
    console.error('Error getting rankings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 启动服务器
async function startServer() {
  try {
    // 连接Redis（可选）
    await redisManager.connect();

    // 启动定时任务
    startScheduledTasks();

    // 启动HTTP服务器
    server.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🎯 Crypto Monitor Backend Server');
      console.log('='.repeat(50));
      console.log(`🌐 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`💾 Redis: ${redisManager.isConnected ? 'Connected' : 'Memory-only mode'}`);
      console.log('='.repeat(50) + '\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  stopScheduledTasks();
  await redisManager.disconnect();

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// 启动
startServer();
