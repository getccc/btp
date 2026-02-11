const redis = require('redis');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.client.on('error', (err) => console.error('Redis Client Error', err));
      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      console.log('💡 Running in memory-only mode (no persistence)');
      this.isConnected = false;
    }
  }

  // 添加交易数据
  async addTrade(chain, tokenAddress, volume, timestamp) {
    if (!this.isConnected) return;

    try {
      const key = `trades:${chain}:${tokenAddress}`;
      const value = JSON.stringify({ volume, timestamp });

      // 使用 sorted set 存储，score 为时间戳
      await this.client.zAdd(key, { score: timestamp, value });

      // 设置过期时间为 35 分钟（多留5分钟buffer）
      await this.client.expire(key, 35 * 60);
    } catch (error) {
      console.error('Error adding trade:', error);
    }
  }

  // 获取30分钟内的交易数据
  async getTradesInWindow(chain, tokenAddress, windowMinutes = 30) {
    if (!this.isConnected) return [];

    try {
      const key = `trades:${chain}:${tokenAddress}`;
      const now = Date.now();
      const windowStart = now - (windowMinutes * 60 * 1000);

      // 获取时间窗口内的数据
      const trades = await this.client.zRangeByScore(key, windowStart, now);

      return trades.map(trade => JSON.parse(trade));
    } catch (error) {
      console.error('Error getting trades:', error);
      return [];
    }
  }

  // 清理过期数据
  async cleanOldTrades(chain, tokenAddress, windowMinutes = 30) {
    if (!this.isConnected) return;

    try {
      const key = `trades:${chain}:${tokenAddress}`;
      const now = Date.now();
      const windowStart = now - (windowMinutes * 60 * 1000);

      // 删除30分钟前的数据
      await this.client.zRemRangeByScore(key, 0, windowStart);
    } catch (error) {
      console.error('Error cleaning old trades:', error);
    }
  }

  // 获取所有代币的Key
  async getAllTokenKeys(chain) {
    if (!this.isConnected) return [];

    try {
      const pattern = `trades:${chain}:*`;
      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      console.error('Error getting token keys:', error);
      return [];
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      console.log('Redis disconnected');
    }
  }
}

module.exports = new RedisManager();
