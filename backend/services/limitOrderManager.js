const EventEmitter = require('events');

class LimitOrderManager extends EventEmitter {
  constructor() {
    super();
    this.orders = new Map(); // Map<orderId, order>
    this.activeOrders = new Map(); // Map<chain, Array<orderId>>
    this.orderIdCounter = Date.now();
  }

  /**
   * 创建限价单
   */
  createOrder(orderData) {
    const {
      userAddress,
      chain,
      fromToken,
      toToken,
      fromAmount,
      targetPrice,
      slippage = 0.5,
      expiryTime,
      orderType = 'limit' // 'limit' or 'stop-loss'
    } = orderData;

    // 验证必需字段
    if (!userAddress || !chain || !fromToken || !toToken || !fromAmount || !targetPrice) {
      throw new Error('Missing required fields');
    }

    // 创建订单
    const orderId = `${chain}-${this.orderIdCounter++}`;
    const order = {
      orderId,
      userAddress,
      chain,
      fromToken,
      toToken,
      fromAmount: parseFloat(fromAmount),
      targetPrice: parseFloat(targetPrice),
      slippage: parseFloat(slippage),
      orderType,
      status: 'active', // active, filled, cancelled, expired, failed
      createdAt: Date.now(),
      expiryTime: expiryTime || (Date.now() + 24 * 3600000), // 默认24小时
      attempts: 0,
      maxAttempts: 3,
      lastError: null
    };

    // 保存订单
    this.orders.set(orderId, order);

    // 添加到活跃订单列表
    if (!this.activeOrders.has(chain)) {
      this.activeOrders.set(chain, []);
    }
    this.activeOrders.get(chain).push(orderId);

    console.log(`✅ Created limit order ${orderId}: ${fromAmount} ${fromToken.symbol} → ${toToken.symbol} @ ${targetPrice}`);

    // 触发事件
    this.emit('orderCreated', order);

    return order;
  }

  /**
   * 取消订单
   */
  cancelOrder(orderId) {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'active') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    // 更新状态
    order.status = 'cancelled';
    order.cancelledAt = Date.now();

    // 从活跃列表移除
    this.removeFromActiveOrders(orderId, order.chain);

    console.log(`❌ Cancelled limit order ${orderId}`);

    // 触发事件
    this.emit('orderCancelled', order);

    return order;
  }

  /**
   * 更新订单状态
   */
  updateOrderStatus(orderId, status, metadata = {}) {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = Date.now();

    // 合并元数据
    Object.assign(order, metadata);

    // 如果订单不再活跃，从活跃列表移除
    if (status !== 'active') {
      this.removeFromActiveOrders(orderId, order.chain);
    }

    console.log(`🔄 Order ${orderId} status: ${oldStatus} → ${status}`);

    // 触发事件
    this.emit('orderStatusChanged', order);

    return order;
  }

  /**
   * 获取用户的订单
   */
  getUserOrders(userAddress, filters = {}) {
    const orders = Array.from(this.orders.values())
      .filter(order => order.userAddress.toLowerCase() === userAddress.toLowerCase());

    // 应用过滤器
    let filtered = orders;

    if (filters.chain) {
      filtered = filtered.filter(o => o.chain === filters.chain);
    }

    if (filters.status) {
      filtered = filtered.filter(o => o.status === filters.status);
    }

    // 按创建时间降序排序
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    return filtered;
  }

  /**
   * 获取活跃订单
   */
  getActiveOrders(chain = null) {
    if (chain) {
      const orderIds = this.activeOrders.get(chain) || [];
      return orderIds.map(id => this.orders.get(id)).filter(Boolean);
    }

    // 返回所有链的活跃订单
    const allOrders = [];
    for (const orderIds of this.activeOrders.values()) {
      for (const id of orderIds) {
        const order = this.orders.get(id);
        if (order) allOrders.push(order);
      }
    }

    return allOrders;
  }

  /**
   * 获取单个订单
   */
  getOrder(orderId) {
    return this.orders.get(orderId);
  }

  /**
   * 检查并处理过期订单
   */
  checkExpiredOrders() {
    const now = Date.now();
    const expired = [];

    for (const order of this.orders.values()) {
      if (order.status === 'active' && order.expiryTime < now) {
        this.updateOrderStatus(order.orderId, 'expired');
        expired.push(order);
      }
    }

    if (expired.length > 0) {
      console.log(`⏰ Expired ${expired.length} orders`);
    }

    return expired;
  }

  /**
   * 记录执行尝试
   */
  recordAttempt(orderId, error = null) {
    const order = this.orders.get(orderId);

    if (!order) return;

    order.attempts++;
    order.lastAttemptAt = Date.now();

    if (error) {
      order.lastError = error.message || String(error);
    }

    // 如果达到最大尝试次数，标记为失败
    if (order.attempts >= order.maxAttempts) {
      this.updateOrderStatus(orderId, 'failed', {
        failReason: 'Max attempts reached'
      });
    }
  }

  /**
   * 从活跃订单列表移除
   */
  removeFromActiveOrders(orderId, chain) {
    if (this.activeOrders.has(chain)) {
      const orders = this.activeOrders.get(chain);
      const index = orders.indexOf(orderId);
      if (index > -1) {
        orders.splice(index, 1);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const stats = {
      total: this.orders.size,
      active: 0,
      filled: 0,
      cancelled: 0,
      expired: 0,
      failed: 0,
      byChain: {}
    };

    for (const order of this.orders.values()) {
      stats[order.status]++;

      if (!stats.byChain[order.chain]) {
        stats.byChain[order.chain] = { total: 0, active: 0 };
      }
      stats.byChain[order.chain].total++;
      if (order.status === 'active') {
        stats.byChain[order.chain].active++;
      }
    }

    return stats;
  }

  /**
   * 清理旧订单（保留最近的订单）
   */
  cleanup(keepDays = 7) {
    const cutoff = Date.now() - (keepDays * 24 * 3600000);
    let cleaned = 0;

    for (const [orderId, order] of this.orders) {
      if (order.status !== 'active' && order.createdAt < cutoff) {
        this.orders.delete(orderId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old orders`);
    }

    return cleaned;
  }
}

module.exports = new LimitOrderManager();
