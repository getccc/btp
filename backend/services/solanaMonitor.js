const axios = require('axios');
const addressMonitor = require('./addressMonitor');

class SolanaMonitor {
  constructor() {
    // 使用公共RPC节点（可以替换为付费节点获得更好性能）
    this.rpcUrls = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
    ];
    this.currentRpcIndex = 0;
    this.scanInterval = null;
    this.scanIntervalMs = 10000; // 10秒扫描一次
    this.lastSignatures = new Map(); // 记录每个地址最后的交易签名
  }

  /**
   * 获取当前RPC URL
   */
  getRpcUrl() {
    return this.rpcUrls[this.currentRpcIndex];
  }

  /**
   * 切换到下一个RPC节点
   */
  switchRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    console.log(`🔄 Switched to RPC: ${this.getRpcUrl()}`);
  }

  /**
   * 启动监控
   */
  start() {
    if (this.scanInterval) {
      console.log('⚠️  Solana Monitor already running');
      return;
    }

    console.log('🚀 Starting Solana address monitor...');
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
      console.log('🛑 Solana address monitor stopped');
    }
  }

  /**
   * 扫描所有Solana地址的交易
   */
  async scanAddresses() {
    const addresses = addressMonitor.getMonitoredAddresses('solana');

    if (addresses.length === 0) {
      return;
    }

    console.log(`🔍 Scanning ${addresses.length} Solana addresses...`);

    for (const addressInfo of addresses) {
      await this.scanAddress(addressInfo.address);
      // 添加延迟避免限流
      await this.sleep(200);
    }
  }

  /**
   * 扫描单个地址的交易
   */
  async scanAddress(address) {
    try {
      // 获取最近的交易签名
      const signatures = await this.getSignaturesForAddress(address);

      if (signatures.length === 0) {
        return;
      }

      // 过滤新交易
      const lastSignature = this.lastSignatures.get(address);
      let newSignatures = signatures;

      if (lastSignature) {
        const lastIndex = signatures.findIndex(sig => sig.signature === lastSignature);
        if (lastIndex > 0) {
          newSignatures = signatures.slice(0, lastIndex);
        } else if (lastIndex === 0) {
          newSignatures = [];
        }
      }

      if (newSignatures.length > 0) {
        // 更新最后签名
        this.lastSignatures.set(address, signatures[0].signature);

        // 获取交易详情
        for (const sig of newSignatures.slice(0, 10)) { // 最多处理10条新交易
          const txDetail = await this.getTransactionDetail(sig.signature);

          if (txDetail) {
            const formattedTxs = this.formatTransaction(txDetail, address, sig.signature);

            // 一个交易可能有多个转账操作
            for (const tx of formattedTxs) {
              addressMonitor.addTransaction(address, 'solana', tx);
            }
          }

          await this.sleep(100);
        }

        console.log(`✨ Found ${newSignatures.length} new transactions for Solana:${address.slice(0, 8)}`);
      }
    } catch (error) {
      console.error(`Error scanning Solana address ${address}:`, error.message);

      // 如果RPC失败，尝试切换
      if (error.message.includes('429') || error.message.includes('timeout')) {
        this.switchRpc();
      }
    }
  }

  /**
   * 获取地址的交易签名列表
   */
  async getSignaturesForAddress(address, limit = 20) {
    try {
      const response = await axios.post(
        this.getRpcUrl(),
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [
            address,
            { limit: limit }
          ]
        },
        { timeout: 10000 }
      );

      if (response.data.result) {
        return response.data.result;
      }

      return [];
    } catch (error) {
      console.error('Error fetching Solana signatures:', error.message);
      return [];
    }
  }

  /**
   * 获取交易详情
   */
  async getTransactionDetail(signature) {
    try {
      const response = await axios.post(
        this.getRpcUrl(),
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [
            signature,
            {
              encoding: 'jsonParsed',
              maxSupportedTransactionVersion: 0
            }
          ]
        },
        { timeout: 10000 }
      );

      if (response.data.result) {
        return response.data.result;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching transaction ${signature}:`, error.message);
      return null;
    }
  }

  /**
   * 格式化交易数据
   */
  formatTransaction(txDetail, monitoredAddress, signature) {
    const transactions = [];

    try {
      const { blockTime, meta, transaction } = txDetail;
      const instructions = transaction.message.instructions || [];

      // 分析每个指令
      for (const instruction of instructions) {
        if (!instruction.parsed) continue;

        const { type, info } = instruction.parsed;

        // 处理转账交易
        if (type === 'transfer' && info) {
          const isIncoming = info.destination === monitoredAddress;
          const amount = info.lamports / 1e9; // 转换为SOL

          transactions.push({
            hash: signature,
            blockTime: blockTime * 1000,
            timeStamp: blockTime * 1000,
            from: info.source,
            to: info.destination,
            value: amount,
            tokenSymbol: 'SOL',
            tokenName: 'Solana',
            tokenAddress: 'native',
            type: isIncoming ? 'IN' : 'OUT',
            txType: 'TRANSFER',
            status: meta.err ? 'failed' : 'success',
            fee: (meta.fee || 0) / 1e9,
            chain: 'solana',
            explorerUrl: `https://solscan.io/tx/${signature}`
          });
        }

        // 处理代币转账
        if ((type === 'transferChecked' || type === 'transfer') && instruction.program === 'spl-token') {
          if (!info) continue;

          const isIncoming = info.destination === monitoredAddress ||
                           (info.authority === monitoredAddress && type !== 'transfer');

          const decimals = info.decimals || 0;
          const amount = info.tokenAmount
            ? parseFloat(info.tokenAmount.uiAmountString || 0)
            : (info.amount / Math.pow(10, decimals));

          transactions.push({
            hash: signature,
            blockTime: blockTime * 1000,
            timeStamp: blockTime * 1000,
            from: info.source || info.authority,
            to: info.destination,
            value: amount,
            tokenSymbol: info.mint ? this.getTokenSymbol(info.mint) : 'TOKEN',
            tokenName: 'SPL Token',
            tokenAddress: info.mint || 'unknown',
            type: isIncoming ? 'IN' : 'OUT',
            txType: 'TRANSFER',
            status: meta.err ? 'failed' : 'success',
            fee: (meta.fee || 0) / 1e9,
            chain: 'solana',
            explorerUrl: `https://solscan.io/tx/${signature}`
          });
        }

        // 检测DEX交易（Raydium, Orca等）
        if (this.isDexInstruction(instruction)) {
          transactions.push({
            hash: signature,
            blockTime: blockTime * 1000,
            timeStamp: blockTime * 1000,
            from: monitoredAddress,
            to: instruction.programId,
            value: 0,
            tokenSymbol: 'DEX',
            tokenName: 'DEX Swap',
            tokenAddress: instruction.programId,
            type: 'SWAP',
            txType: 'DEX',
            status: meta.err ? 'failed' : 'success',
            fee: (meta.fee || 0) / 1e9,
            chain: 'solana',
            explorerUrl: `https://solscan.io/tx/${signature}`
          });
        }
      }

      // 如果没有识别出任何交易，返回基础信息
      if (transactions.length === 0) {
        transactions.push({
          hash: signature,
          blockTime: blockTime * 1000,
          timeStamp: blockTime * 1000,
          from: transaction.message.accountKeys[0]?.pubkey || 'unknown',
          to: monitoredAddress,
          value: 0,
          tokenSymbol: 'SOL',
          tokenName: 'Solana',
          tokenAddress: 'native',
          type: 'OTHER',
          txType: 'OTHER',
          status: meta.err ? 'failed' : 'success',
          fee: (meta.fee || 0) / 1e9,
          chain: 'solana',
          explorerUrl: `https://solscan.io/tx/${signature}`
        });
      }
    } catch (error) {
      console.error('Error formatting Solana transaction:', error);
    }

    return transactions;
  }

  /**
   * 判断是否是DEX指令
   */
  isDexInstruction(instruction) {
    const dexPrograms = [
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
      '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP', // Orca
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',  // Jupiter
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'   // Orca Whirlpool
    ];

    return dexPrograms.includes(instruction.programId);
  }

  /**
   * 获取代币符号（简化版本，可以扩展为查询链上数据）
   */
  getTokenSymbol(mintAddress) {
    const knownTokens = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'So11111111111111111111111111111111111111112': 'SOL',
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
    };

    return knownTokens[mintAddress] || 'TOKEN';
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SolanaMonitor();
