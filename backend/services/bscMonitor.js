const axios = require('axios');
const addressMonitor = require('./addressMonitor');

class BscMonitor {
  constructor() {
    this.apiKey = process.env.BSCSCAN_API_KEY || 'YourApiKeyToken'; // 用户需要替换
    this.baseURL = 'https://api.bscscan.com/api';
    this.scanInterval = null;
    this.scanIntervalMs = 10000; // 10秒扫描一次
    this.lastScannedBlock = new Map(); // 记录每个地址最后扫描的区块
  }

  /**
   * 启动监控
   */
  start() {
    if (this.scanInterval) {
      console.log('⚠️  BSC Monitor already running');
      return;
    }

    console.log('🚀 Starting BSC address monitor...');
    this.scanInterval = setInterval(() => this.scanAddresses(), this.scanIntervalMs);

    // 立即执行一次
    this.scanAddresses();
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      console.log('🛑 BSC address monitor stopped');
    }
  }

  /**
   * 扫描所有BSC地址的交易
   */
  async scanAddresses() {
    const addresses = addressMonitor.getMonitoredAddresses('bsc');

    if (addresses.length === 0) {
      return;
    }

    console.log(`🔍 Scanning ${addresses.length} BSC addresses...`);

    for (const addressInfo of addresses) {
      await this.scanAddress(addressInfo.address);
      // 添加延迟避免API限流
      await this.sleep(300);
    }
  }

  /**
   * 扫描单个地址的交易
   */
  async scanAddress(address) {
    try {
      // 获取BNB交易
      const bnbTxs = await this.getBNBTransactions(address);

      // 获取BEP20代币交易
      const tokenTxs = await this.getTokenTransactions(address);

      // 合并并排序
      const allTxs = [...bnbTxs, ...tokenTxs]
        .sort((a, b) => b.timeStamp - a.timeStamp)
        .slice(0, 20); // 只取最新20条

      // 过滤新交易（在最后扫描区块之后的）
      const lastBlock = this.lastScannedBlock.get(address) || 0;
      const newTxs = allTxs.filter(tx => parseInt(tx.blockNumber) > lastBlock);

      if (newTxs.length > 0) {
        // 更新最后扫描区块
        const latestBlock = Math.max(...allTxs.map(tx => parseInt(tx.blockNumber)));
        this.lastScannedBlock.set(address, latestBlock);

        // 添加新交易
        for (const tx of newTxs) {
          const formattedTx = this.formatTransaction(tx, address);
          addressMonitor.addTransaction(address, 'bsc', formattedTx);
        }

        console.log(`✨ Found ${newTxs.length} new transactions for BSC:${address.slice(0, 8)}`);
      }
    } catch (error) {
      console.error(`Error scanning BSC address ${address}:`, error.message);
    }
  }

  /**
   * 获取BNB交易
   */
  async getBNBTransactions(address) {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          module: 'account',
          action: 'txlist',
          address: address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: 20,
          sort: 'desc',
          apikey: this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && response.data.result) {
        return response.data.result.map(tx => ({
          ...tx,
          tokenSymbol: 'BNB',
          tokenName: 'Binance Coin',
          tokenDecimal: '18',
          type: 'native'
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching BNB transactions:', error.message);
      return [];
    }
  }

  /**
   * 获取BEP20代币交易
   */
  async getTokenTransactions(address) {
    try {
      const response = await axios.get(this.baseURL, {
        params: {
          module: 'account',
          action: 'tokentx',
          address: address,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: 20,
          sort: 'desc',
          apikey: this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && response.data.result) {
        return response.data.result.map(tx => ({
          ...tx,
          type: 'token'
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching token transactions:', error.message);
      return [];
    }
  }

  /**
   * 格式化交易数据
   */
  formatTransaction(tx, monitoredAddress) {
    const isIncoming = tx.to.toLowerCase() === monitoredAddress.toLowerCase();
    const value = tx.value / Math.pow(10, parseInt(tx.tokenDecimal || 18));

    // 判断是否是DEX交易
    const isDex = this.isDexTransaction(tx);

    return {
      hash: tx.hash,
      blockNumber: parseInt(tx.blockNumber),
      timeStamp: parseInt(tx.timeStamp) * 1000,
      from: tx.from,
      to: tx.to,
      value: value,
      tokenSymbol: tx.tokenSymbol || 'BNB',
      tokenName: tx.tokenName || 'Binance Coin',
      tokenAddress: tx.contractAddress || 'native',
      type: isIncoming ? 'IN' : 'OUT',
      txType: isDex ? 'DEX' : 'TRANSFER',
      gasUsed: tx.gasUsed,
      gasPrice: tx.gasPrice,
      status: tx.txreceipt_status === '1' || tx.isError === '0' ? 'success' : 'failed',
      chain: 'bsc',
      explorerUrl: `https://bscscan.com/tx/${tx.hash}`
    };
  }

  /**
   * 判断是否是DEX交易
   */
  isDexTransaction(tx) {
    // 常见的BSC DEX合约地址
    const dexContracts = [
      '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap Router
      '0x05ff2b0db69458a0750badebc4f9e13add608c7f', // PancakeSwap Router V1
      '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506', // SushiSwap Router
      '0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8', // BiSwap Router
      '0x327dd3208f0bcf590a66110acb6e5e6941a4efa0', // BakerySwap Router
    ];

    const toAddress = tx.to.toLowerCase();
    return dexContracts.some(dex => toAddress === dex.toLowerCase());
  }

  /**
   * 设置API Key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    console.log('✅ BSC API Key updated');
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new BscMonitor();
