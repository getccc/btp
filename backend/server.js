require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const redisManager = require('./utils/redis');
const dexScreenerService = require('./services/dexscreener');
const addressMonitor = require('./services/addressMonitor');
const bscMonitor = require('./services/bscMonitor');
const solanaMonitor = require('./services/solanaMonitor');
const limitOrderManager = require('./services/limitOrderManager');
const priceMonitor = require('./services/priceMonitor');
const orderExecutor = require('./services/orderExecutor');
const copyTradingManager = require('./services/copyTradingManager');
const copyTradingExecutor = require('./services/copyTradingExecutor');

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

  // 地址监控事件
  socket.on('add-address', (data) => {
    const { address, chain, label } = data;
    const result = addressMonitor.addAddress(address, chain, label);
    socket.emit('address-added', result);
  });

  socket.on('remove-address', (data) => {
    const { address, chain } = data;
    const result = addressMonitor.removeAddress(address, chain);
    socket.emit('address-removed', result);
  });

  socket.on('request-transactions', (data) => {
    const { address, chain } = data;
    const transactions = addressMonitor.getTransactions(address, chain);
    socket.emit('transactions-update', { address, chain, transactions });
  });

  socket.on('request-monitored-addresses', () => {
    const addresses = addressMonitor.getMonitoredAddresses();
    socket.emit('monitored-addresses', addresses);
  });

  // 限价单事件
  socket.on('create-limit-order', (data) => {
    try {
      const order = limitOrderManager.createOrder(data);
      socket.emit('order-created', { success: true, order });
    } catch (error) {
      socket.emit('order-error', { error: error.message });
    }
  });

  socket.on('cancel-limit-order', (data) => {
    try {
      const { orderId } = data;
      const order = limitOrderManager.cancelOrder(orderId);
      socket.emit('order-cancelled', { success: true, order });
    } catch (error) {
      socket.emit('order-error', { error: error.message });
    }
  });

  socket.on('request-user-orders', (data) => {
    const { userAddress, chain } = data;
    const orders = limitOrderManager.getUserOrders(userAddress, chain);
    socket.emit('user-orders', { userAddress, chain, orders });
  });

  socket.on('confirm-execution', (data) => {
    try {
      const { orderId, txHash } = data;
      orderExecutor.confirmExecution(orderId, txHash);
      socket.emit('execution-confirmed', { success: true, orderId, txHash });
    } catch (error) {
      socket.emit('execution-error', { error: error.message });
    }
  });

  socket.on('cancel-execution', (data) => {
    try {
      const { orderId } = data;
      orderExecutor.cancelExecution(orderId);
      socket.emit('execution-cancelled', { success: true, orderId });
    } catch (error) {
      socket.emit('execution-error', { error: error.message });
    }
  });

  // 跟单事件
  socket.on('create-copy-config', (data) => {
    try {
      const config = copyTradingManager.createConfig(data);
      socket.emit('copy-config-created', { success: true, config });
    } catch (error) {
      socket.emit('copy-config-error', { error: error.message });
    }
  });

  socket.on('update-copy-config', (data) => {
    try {
      const { configId, updates } = data;
      const config = copyTradingManager.updateConfig(configId, updates);
      socket.emit('copy-config-updated', { success: true, config });
    } catch (error) {
      socket.emit('copy-config-error', { error: error.message });
    }
  });

  socket.on('update-copy-config-status', (data) => {
    try {
      const { configId, status } = data;
      const config = copyTradingManager.updateConfigStatus(configId, status);
      socket.emit('copy-config-status-updated', { success: true, config });
    } catch (error) {
      socket.emit('copy-config-error', { error: error.message });
    }
  });

  socket.on('delete-copy-config', (data) => {
    try {
      const { configId } = data;
      const config = copyTradingManager.deleteConfig(configId);
      socket.emit('copy-config-deleted', { success: true, config });
    } catch (error) {
      socket.emit('copy-config-error', { error: error.message });
    }
  });

  socket.on('request-user-copy-configs', (data) => {
    const { userAddress, chain } = data;
    const configs = copyTradingManager.getUserConfigs(userAddress, chain);
    socket.emit('user-copy-configs', { userAddress, chain, configs });
  });

  socket.on('confirm-copy-trade', (data) => {
    try {
      const { copyId, txHash } = data;
      copyTradingExecutor.confirmCopyTrade(copyId, txHash);
      socket.emit('copy-trade-confirmed', { success: true, copyId, txHash });
    } catch (error) {
      socket.emit('copy-trade-error', { error: error.message });
    }
  });

  socket.on('cancel-copy-trade', (data) => {
    try {
      const { copyId } = data;
      copyTradingExecutor.cancelCopyTrade(copyId);
      socket.emit('copy-trade-cancelled', { success: true, copyId });
    } catch (error) {
      socket.emit('copy-trade-error', { error: error.message });
    }
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

// 地址监控 API
app.post('/api/monitor/add', (req, res) => {
  const { address, chain, label } = req.body;

  if (!address || !chain) {
    return res.status(400).json({ error: 'Address and chain are required' });
  }

  if (!['bsc', 'solana'].includes(chain)) {
    return res.status(400).json({ error: 'Invalid chain. Use bsc or solana' });
  }

  const result = addressMonitor.addAddress(address, chain, label);
  res.json(result);
});

app.post('/api/monitor/remove', (req, res) => {
  const { address, chain } = req.body;

  if (!address || !chain) {
    return res.status(400).json({ error: 'Address and chain are required' });
  }

  const result = addressMonitor.removeAddress(address, chain);
  res.json(result);
});

app.get('/api/monitor/addresses', (req, res) => {
  const { chain } = req.query;
  const addresses = addressMonitor.getMonitoredAddresses(chain || null);
  res.json({ addresses });
});

app.get('/api/monitor/transactions/:chain/:address', (req, res) => {
  const { chain, address } = req.params;
  const { limit } = req.query;

  const transactions = addressMonitor.getTransactions(
    address,
    chain,
    limit ? parseInt(limit) : 50
  );

  res.json({ transactions });
});

app.get('/api/monitor/stats', (req, res) => {
  const stats = addressMonitor.getStats();
  res.json(stats);
});

// 限价单 API
app.post('/api/limit-orders/create', (req, res) => {
  try {
    const orderData = req.body;

    if (!orderData.userAddress || !orderData.chain) {
      return res.status(400).json({ error: 'userAddress and chain are required' });
    }

    if (!['bsc', 'solana'].includes(orderData.chain)) {
      return res.status(400).json({ error: 'Invalid chain. Use bsc or solana' });
    }

    const order = limitOrderManager.createOrder(orderData);
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error creating limit order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/limit-orders/:orderId/cancel', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = limitOrderManager.cancelOrder(orderId);
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/limit-orders/user/:address', (req, res) => {
  try {
    const { address } = req.params;
    const { chain, status } = req.query;

    let orders = limitOrderManager.getUserOrders(address, chain || null);

    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error getting user orders:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/limit-orders/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = limitOrderManager.getOrder(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/limit-orders/stats', (req, res) => {
  try {
    const stats = limitOrderManager.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/limit-orders/execution/pending', (req, res) => {
  try {
    const pendingExecutions = orderExecutor.getAllPendingExecutions();
    res.json({ success: true, pendingExecutions });
  } catch (error) {
    console.error('Error getting pending executions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/limit-orders/execution/history', (req, res) => {
  try {
    const { limit } = req.query;
    const history = orderExecutor.getExecutionHistory(limit ? parseInt(limit) : 50);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error getting execution history:', error);
    res.status(500).json({ error: error.message });
  }
});

// 跟单 API
app.post('/api/copy-trading/config/create', (req, res) => {
  try {
    const configData = req.body;

    if (!configData.userAddress || !configData.targetAddress || !configData.chain) {
      return res.status(400).json({ error: 'userAddress, targetAddress and chain are required' });
    }

    const config = copyTradingManager.createConfig(configData);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error creating copy trading config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/copy-trading/config/:configId', (req, res) => {
  try {
    const { configId } = req.params;
    const updates = req.body;

    const config = copyTradingManager.updateConfig(configId, updates);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating copy trading config:', error);
    res.status(404).json({ error: error.message });
  }
});

app.put('/api/copy-trading/config/:configId/status', (req, res) => {
  try {
    const { configId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const config = copyTradingManager.updateConfigStatus(configId, status);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating config status:', error);
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/copy-trading/config/:configId', (req, res) => {
  try {
    const { configId } = req.params;
    const config = copyTradingManager.deleteConfig(configId);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error deleting config:', error);
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/copy-trading/config/:configId', (req, res) => {
  try {
    const { configId } = req.params;
    const config = copyTradingManager.getConfig(configId);

    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/copy-trading/user/:address', (req, res) => {
  try {
    const { address } = req.params;
    const { chain } = req.query;

    const configs = copyTradingManager.getUserConfigs(address, chain || null);
    res.json({ success: true, configs });
  } catch (error) {
    console.error('Error getting user configs:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/copy-trading/history/:configId?', (req, res) => {
  try {
    const { configId } = req.params;
    const { limit } = req.query;

    const history = copyTradingManager.getCopyHistory(
      configId || null,
      limit ? parseInt(limit) : 50
    );

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error getting copy history:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/copy-trading/stats', (req, res) => {
  try {
    const stats = copyTradingManager.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting copy trading stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/copy-trading/pending', (req, res) => {
  try {
    const pendingCopies = copyTradingExecutor.getPendingCopies();
    res.json({ success: true, pendingCopies });
  } catch (error) {
    console.error('Error getting pending copies:', error);
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
async function startServer() {
  try {
    // 连接Redis（可选）
    await redisManager.connect();

    // 启动定时任务
    startScheduledTasks();

    // 启动地址监控服务
    startAddressMonitoring();

    // 启动限价单监控服务
    startLimitOrderMonitoring();

    // 启动跟单监控服务
    startCopyTradingMonitoring();

    // 启动HTTP服务器
    server.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🎯 Crypto Monitor Backend Server');
      console.log('='.repeat(50));
      console.log(`🌐 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`💾 Redis: ${redisManager.isConnected ? 'Connected' : 'Memory-only mode'}`);
      console.log(`👁️  Address monitoring: Active`);
      console.log(`📋 Limit order monitoring: Active`);
      console.log(`🤖 Copy trading monitoring: Active`);
      console.log('='.repeat(50) + '\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 启动地址监控
function startAddressMonitoring() {
  console.log('🚀 Starting address monitoring...');

  // 启动BSC监控
  bscMonitor.start();

  // 启动Solana监控
  solanaMonitor.start();

  // 监听新交易事件并推送给客户端
  addressMonitor.on('newTransaction', (data) => {
    io.emit('new-transaction', data);
    console.log(`📨 Pushed new transaction to ${connectedClients} clients`);

    // 检查是否需要跟单
    copyTradingExecutor.handleNewTransaction(data);
  });

  console.log('✅ Address monitoring started');
}

// 启动跟单监控
function startCopyTradingMonitoring() {
  console.log('🚀 Starting copy trading monitoring...');

  // 监听配置创建事件
  copyTradingManager.on('configCreated', (config) => {
    io.emit('copy-config-created', config);
    console.log(`📋 Copy trading config created: ${config.configId}`);

    // 自动添加目标地址到地址监控
    const result = addressMonitor.addAddress(
      config.targetAddress,
      config.chain,
      `Copy Trading: ${config.label}`
    );

    if (result.success) {
      console.log(`👁️  Added target address to monitoring: ${config.targetAddress}`);
    }
  });

  // 监听配置删除事件
  copyTradingManager.on('configDeleted', (config) => {
    io.emit('copy-config-deleted', config);
    console.log(`🗑️  Copy trading config deleted: ${config.configId}`);

    // 检查是否还有其他配置使用这个地址
    const otherConfigs = copyTradingManager.getConfigsByTargetAddress(
      config.targetAddress,
      config.chain
    );

    if (otherConfigs.length === 0) {
      // 没有其他配置使用这个地址，从监控中移除
      addressMonitor.removeAddress(config.targetAddress, config.chain);
      console.log(`👁️  Removed target address from monitoring: ${config.targetAddress}`);
    }
  });

  // 监听配置更新事件
  copyTradingManager.on('configUpdated', (config) => {
    io.emit('copy-config-updated', config);
  });

  // 监听配置状态变化事件
  copyTradingManager.on('configStatusChanged', (config) => {
    io.emit('copy-config-status-changed', config);
  });

  // 监听跟单准备好事件
  copyTradingExecutor.on('copyTradeReady', (copyData) => {
    io.emit('copy-trade-ready', copyData);
    console.log(`✅ Copy trade ready: ${copyData.copyId}`);
  });

  // 监听需要确认的跟单
  copyTradingExecutor.on('copyTradeRequiresConfirmation', (copyData) => {
    io.emit('copy-trade-requires-confirmation', copyData);
    console.log(`⏳ Copy trade requires confirmation: ${copyData.copyId}`);
  });

  // 监听跟单确认事件
  copyTradingExecutor.on('copyTradeConfirmed', (copyData) => {
    io.emit('copy-trade-confirmed', copyData);
    console.log(`✅ Copy trade confirmed: ${copyData.copyId}`);
  });

  // 监听跟单失败事件
  copyTradingExecutor.on('copyTradeFailed', (copyData) => {
    io.emit('copy-trade-failed', copyData);
    console.log(`❌ Copy trade failed: ${copyData.copyId}`);
  });

  // 监听跟单取消事件
  copyTradingExecutor.on('copyTradeCancelled', (copyData) => {
    io.emit('copy-trade-cancelled', copyData);
    console.log(`🚫 Copy trade cancelled: ${copyData.copyId}`);
  });

  // 监听跟单执行事件
  copyTradingManager.on('copyExecuted', ({ config, copyData }) => {
    io.emit('copy-executed', { config, copyData });
  });

  // 每30分钟清理过期的待确认跟单
  setInterval(() => {
    const cleaned = copyTradingExecutor.cleanupPendingCopies();
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired pending copy trades`);
    }
  }, 30 * 60 * 1000);

  console.log('✅ Copy trading monitoring started');
}

// 停止跟单监控
function stopCopyTradingMonitoring() {
  console.log('🛑 Stopping copy trading monitoring...');
  console.log('✅ Copy trading monitoring stopped');
}

// 启动限价单监控
function startLimitOrderMonitoring() {
  console.log('🚀 Starting limit order monitoring...');

  // 启动价格监控
  priceMonitor.start();

  // 监听订单创建事件
  limitOrderManager.on('orderCreated', (order) => {
    io.emit('order-created', order);
    console.log(`📋 New limit order created: ${order.orderId}`);
  });

  // 监听订单取消事件
  limitOrderManager.on('orderCancelled', (order) => {
    io.emit('order-cancelled', order);
    console.log(`❌ Order cancelled: ${order.orderId}`);
  });

  // 监听订单更新事件
  limitOrderManager.on('orderUpdated', (order) => {
    io.emit('order-updated', order);
  });

  // 监听价格目标达成事件
  priceMonitor.on('priceTargetReached', async (data) => {
    const { order, currentPrice } = data;
    console.log(`🎯 Price target reached for order ${order.orderId}: ${currentPrice}`);

    try {
      // 准备执行
      const executionData = await orderExecutor.prepareExecution(order, currentPrice);

      // 推送给客户端等待确认
      io.emit('execution-ready', executionData);
      console.log(`⏳ Execution ready for order ${order.orderId}, waiting for user confirmation`);
    } catch (error) {
      console.error(`Error preparing execution for order ${order.orderId}:`, error);
      await orderExecutor.failExecution(order.orderId, error);
    }
  });

  // 监听执行确认事件
  orderExecutor.on('executionConfirmed', (execution) => {
    io.emit('execution-confirmed', execution);
    console.log(`✅ Execution confirmed for order ${execution.orderId}`);
  });

  // 监听执行失败事件
  orderExecutor.on('executionFailed', (execution) => {
    io.emit('execution-failed', execution);
    console.log(`❌ Execution failed for order ${execution.orderId}`);
  });

  // 监听执行取消事件
  orderExecutor.on('executionCancelled', (execution) => {
    io.emit('execution-cancelled', execution);
    console.log(`🚫 Execution cancelled for order ${execution.orderId}`);
  });

  // 每30分钟清理过期的待执行订单
  setInterval(() => {
    const cleaned = orderExecutor.cleanupPendingExecutions();
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired pending executions`);
    }
  }, 30 * 60 * 1000);

  console.log('✅ Limit order monitoring started');
}

// 停止限价单监控
function stopLimitOrderMonitoring() {
  console.log('🛑 Stopping limit order monitoring...');
  priceMonitor.stop();
  console.log('✅ Limit order monitoring stopped');
}

// 停止地址监控
function stopAddressMonitoring() {
  console.log('🛑 Stopping address monitoring...');
  bscMonitor.stop();
  solanaMonitor.stop();
  console.log('✅ Address monitoring stopped');
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');

  stopScheduledTasks();
  stopAddressMonitoring();
  stopLimitOrderMonitoring();
  stopCopyTradingMonitoring();
  await redisManager.disconnect();

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// 启动
startServer();
