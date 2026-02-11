const axios = require('axios');
const redisManager = require('../utils/redis');

class DexScreenerService {
  constructor() {
    this.baseURL = 'https://api.dexscreener.com/latest/dex';
    this.chains = ['bsc', 'solana'];
    this.inMemoryCache = new Map(); // 内存缓存备份（当Redis不可用时）
  }

  // 获取链上最新的交易对数据
  async fetchChainData(chain) {
    try {
      // DexScreener API: 获取链上交易量最高的交易对
      const response = await axios.get(`${this.baseURL}/search/?q=${chain}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (response.data && response.data.pairs) {
        return response.data.pairs;
      }

      return [];
    } catch (error) {
      console.error(`❌ Error fetching ${chain} data:`, error.message);
      return [];
    }
  }

  // 处理交易数据并存储
  async processAndStore(pairs, chain) {
    const timestamp = Date.now();
    const tokenStats = new Map();

    // 聚合同一代币的数据
    for (const pair of pairs) {
      if (!pair.baseToken || !pair.volume) continue;

      const tokenAddress = pair.baseToken.address;
      const volume24h = parseFloat(pair.volume?.h24 || 0);
      const txns24h = parseInt(pair.txns?.h24?.buys || 0) + parseInt(pair.txns?.h24?.sells || 0);

      if (!tokenStats.has(tokenAddress)) {
        tokenStats.set(tokenAddress, {
          address: tokenAddress,
          symbol: pair.baseToken.symbol,
          name: pair.baseToken.name,
          volume: volume24h,
          txnCount: txns24h,
          priceUsd: parseFloat(pair.priceUsd || 0),
          priceChange: parseFloat(pair.priceChange?.h24 || 0),
          liquidity: parseFloat(pair.liquidity?.usd || 0),
          fdv: parseFloat(pair.fdv || 0),
          pairAddress: pair.pairAddress,
          dexId: pair.dexId,
          url: pair.url
        });
      } else {
        // 累加多个交易对的数据
        const existing = tokenStats.get(tokenAddress);
        existing.volume += volume24h;
        existing.txnCount += txns24h;
      }
    }

    // 存储到Redis或内存
    for (const [address, stats] of tokenStats) {
      await redisManager.addTrade(chain, address, stats.volume, timestamp);

      // 同时存储到内存缓存
      const key = `${chain}:${address}`;
      if (!this.inMemoryCache.has(key)) {
        this.inMemoryCache.set(key, []);
      }

      const cache = this.inMemoryCache.get(key);
      cache.push({ ...stats, timestamp });

      // 只保留30分钟内的数据
      const thirtyMinutesAgo = timestamp - (30 * 60 * 1000);
      this.inMemoryCache.set(
        key,
        cache.filter(item => item.timestamp > thirtyMinutesAgo)
      );
    }

    return tokenStats;
  }

  // 计算Top 10代币
  async calculateTop10(chain) {
    const tokenStats = new Map();

    // 优先使用Redis数据
    if (redisManager.isConnected) {
      const keys = await redisManager.getAllTokenKeys(chain);

      for (const key of keys) {
        const tokenAddress = key.split(':')[2];
        const trades = await redisManager.getTradesInWindow(chain, tokenAddress);

        if (trades.length > 0) {
          const totalVolume = trades.reduce((sum, t) => sum + t.volume, 0);
          const txnCount = trades.length;

          // 获取最新的代币信息（从内存缓存）
          const cacheKey = `${chain}:${tokenAddress}`;
          const cached = this.inMemoryCache.get(cacheKey) || [];
          const latest = cached[cached.length - 1] || {};

          tokenStats.set(tokenAddress, {
            address: tokenAddress,
            symbol: latest.symbol || 'UNKNOWN',
            name: latest.name || 'Unknown Token',
            volume: totalVolume,
            txnCount: txnCount,
            priceUsd: latest.priceUsd || 0,
            priceChange: latest.priceChange || 0,
            liquidity: latest.liquidity || 0,
            fdv: latest.fdv || 0,
            pairAddress: latest.pairAddress || '',
            dexId: latest.dexId || '',
            url: latest.url || ''
          });
        }
      }
    } else {
      // 使用内存缓存
      for (const [key, trades] of this.inMemoryCache) {
        if (!key.startsWith(chain)) continue;

        const tokenAddress = key.split(':')[1];
        const totalVolume = trades.reduce((sum, t) => sum + t.volume, 0);
        const latest = trades[trades.length - 1] || {};

        tokenStats.set(tokenAddress, {
          address: tokenAddress,
          symbol: latest.symbol || 'UNKNOWN',
          name: latest.name || 'Unknown Token',
          volume: totalVolume,
          txnCount: trades.length,
          priceUsd: latest.priceUsd || 0,
          priceChange: latest.priceChange || 0,
          liquidity: latest.liquidity || 0,
          fdv: latest.fdv || 0,
          pairAddress: latest.pairAddress || '',
          dexId: latest.dexId || '',
          url: latest.url || ''
        });
      }
    }

    // 转换为数组并排序
    const tokens = Array.from(tokenStats.values());

    // 按交易量排序
    const topByVolume = [...tokens]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    // 按交易笔数排序
    const topByTxns = [...tokens]
      .sort((a, b) => b.txnCount - a.txnCount)
      .slice(0, 10);

    return {
      topByVolume,
      topByTxns,
      totalTokens: tokens.length
    };
  }

  // 清理内存缓存
  cleanMemoryCache() {
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);

    for (const [key, trades] of this.inMemoryCache) {
      const filtered = trades.filter(t => t.timestamp > thirtyMinutesAgo);

      if (filtered.length === 0) {
        this.inMemoryCache.delete(key);
      } else {
        this.inMemoryCache.set(key, filtered);
      }
    }
  }
}

module.exports = new DexScreenerService();
