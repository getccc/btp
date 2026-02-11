const axios = require('axios');
const EventEmitter = require('events');
const limitOrderManager = require('./limitOrderManager');

class PriceMonitor extends EventEmitter {
  constructor() {
    super();
    this.prices = new Map(); // Map<tokenPair, price>
    this.monitorInterval = null;
    this.checkInterval = 10000; // 10秒检查一次
    this.isRunning = false;

    // API 端点
    this.apis = {
      bsc: 'https://api.dexscreener.com/latest/dex',
      solana: 'https://price.jup.ag/v4/price'
    };
  }

  /**
   * 启动价格监控
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Price monitor already running');
      return;
    }

    console.log('🚀 Starting price monitor...');
    this.isRunning = true;

    // 立即执行一次
    this.checkPrices();

    // 定期检查
    this.monitorInterval = setInterval(() => {
      this.checkPrices();
    }, this.checkInterval);

    console.log(`✅ Price monitor started (interval: ${this.checkInterval}ms)`);
  }

  /**
   * 停止价格监控
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping price monitor...');

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    this.isRunning = false;
    console.log('✅ Price monitor stopped');
  }

  /**
   * 检查所有活跃订单的价格
   */
  async checkPrices() {
    try {
      // 检查过期订单
      limitOrderManager.checkExpiredOrders();

      // 获取所有活跃订单
      const activeOrders = limitOrderManager.getActiveOrders();

      if (activeOrders.length === 0) {
        return;
      }

      console.log(`💹 Checking prices for ${activeOrders.length} active orders...`);

      // 按链分组
      const ordersByChain = this.groupOrdersByChain(activeOrders);

      // 并行检查所有链
      await Promise.all([
        this.checkBSCOrders(ordersByChain.bsc || []),
        this.checkSolanaOrders(ordersByChain.solana || [])
      ]);

    } catch (error) {
      console.error('Error checking prices:', error);
    }
  }

  /**
   * 检查 BSC 订单
   */
  async checkBSCOrders(orders) {
    if (orders.length === 0) return;

    try {
      for (const order of orders) {
        const currentPrice = await this.getBSCPrice(order.fromToken, order.toToken);

        if (currentPrice === null) {
          continue;
        }

        // 保存价格
        const pairKey = `bsc:${order.fromToken.address}-${order.toToken.address}`;
        this.prices.set(pairKey, {
          price: currentPrice,
          timestamp: Date.now()
        });

        // 检查是否达到目标价格
        if (this.shouldExecuteOrder(order, currentPrice)) {
          console.log(`🎯 Price target reached for order ${order.orderId}`);
          console.log(`   Current: ${currentPrice}, Target: ${order.targetPrice}`);

          // 触发执行事件
          this.emit('priceTargetReached', order, currentPrice);
        }
      }
    } catch (error) {
      console.error('Error checking BSC orders:', error);
    }
  }

  /**
   * 检查 Solana 订单
   */
  async checkSolanaOrders(orders) {
    if (orders.length === 0) return;

    try {
      for (const order of orders) {
        const currentPrice = await this.getSolanaPrice(order.fromToken, order.toToken);

        if (currentPrice === null) {
          continue;
        }

        // 保存价格
        const pairKey = `solana:${order.fromToken.address}-${order.toToken.address}`;
        this.prices.set(pairKey, {
          price: currentPrice,
          timestamp: Date.now()
        });

        // 检查是否达到目标价格
        if (this.shouldExecuteOrder(order, currentPrice)) {
          console.log(`🎯 Price target reached for order ${order.orderId}`);
          console.log(`   Current: ${currentPrice}, Target: ${order.targetPrice}`);

          // 触发执行事件
          this.emit('priceTargetReached', order, currentPrice);
        }
      }
    } catch (error) {
      console.error('Error checking Solana orders:', error);
    }
  }

  /**
   * 获取 BSC 代币对价格
   */
  async getBSCPrice(fromToken, toToken) {
    try {
      // 使用 DexScreener API
      const pairAddress = this.getBSCPairAddress(fromToken, toToken);

      if (!pairAddress) {
        // 如果没有配对地址，尝试通过搜索获取
        return await this.getBSCPriceBySearch(fromToken, toToken);
      }

      const response = await axios.get(`${this.apis.bsc}/pairs/bsc/${pairAddress}`, {
        timeout: 5000
      });

      if (response.data && response.data.pair) {
        return parseFloat(response.data.pair.priceNative) || null;
      }

      return null;
    } catch (error) {
      console.error(`Error getting BSC price for ${fromToken.symbol}/${toToken.symbol}:`, error.message);
      return null;
    }
  }

  /**
   * 通过搜索获取 BSC 价格
   */
  async getBSCPriceBySearch(fromToken, toToken) {
    try {
      const response = await axios.get(`${this.apis.bsc}/search`, {
        params: {
          q: `${fromToken.symbol}/${toToken.symbol} BSC`
        },
        timeout: 5000
      });

      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        // 取流动性最高的交易对
        const pair = response.data.pairs
          .filter(p => p.chainId === 'bsc')
          .sort((a, b) => parseFloat(b.liquidity?.usd || 0) - parseFloat(a.liquidity?.usd || 0))[0];

        if (pair) {
          return parseFloat(pair.priceNative) || parseFloat(pair.priceUsd) || null;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取 Solana 代币对价格
   */
  async getSolanaPrice(fromToken, toToken) {
    try {
      // 使用 Jupiter Price API
      const response = await axios.get(this.apis.solana, {
        params: {
          ids: fromToken.address
        },
        timeout: 5000
      });

      if (response.data && response.data.data && response.data.data[fromToken.address]) {
        const fromPrice = response.data.data[fromToken.address].price;

        // 如果 toToken 是 SOL，直接返回
        if (toToken.symbol === 'SOL') {
          return fromPrice;
        }

        // 获取 toToken 价格
        const toResponse = await axios.get(this.apis.solana, {
          params: {
            ids: toToken.address
          },
          timeout: 5000
        });

        if (toResponse.data && toResponse.data.data && toResponse.data.data[toToken.address]) {
          const toPrice = toResponse.data.data[toToken.address].price;
          return fromPrice / toPrice;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error getting Solana price for ${fromToken.symbol}/${toToken.symbol}:`, error.message);
      return null;
    }
  }

  /**
   * 判断是否应该执行订单
   */
  shouldExecuteOrder(order, currentPrice) {
    if (order.orderType === 'limit') {
      // 限价单：当前价格 >= 目标价格时执行
      return currentPrice >= order.targetPrice;
    } else if (order.orderType === 'stop-loss') {
      // 止损单：当前价格 <= 目标价格时执行
      return currentPrice <= order.targetPrice;
    }

    return false;
  }

  /**
   * 获取 BSC 交易对地址（简化版）
   */
  getBSCPairAddress(fromToken, toToken) {
    // 这里可以预配置常见交易对的地址
    // 或者通过合约调用获取
    // 简化起见，返回 null，使用搜索方式
    return null;
  }

  /**
   * 按链分组订单
   */
  groupOrdersByChain(orders) {
    const grouped = {};

    for (const order of orders) {
      if (!grouped[order.chain]) {
        grouped[order.chain] = [];
      }
      grouped[order.chain].push(order);
    }

    return grouped;
  }

  /**
   * 获取缓存的价格
   */
  getCachedPrice(chain, fromToken, toToken) {
    const pairKey = `${chain}:${fromToken.address}-${toToken.address}`;
    const cached = this.prices.get(pairKey);

    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.price;
    }

    return null;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      cachedPrices: this.prices.size,
      activeOrders: limitOrderManager.getActiveOrders().length
    };
  }
}

module.exports = new PriceMonitor();
