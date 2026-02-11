const EventEmitter = require('events');
const copyTradingManager = require('./copyTradingManager');

/**
 * 跟单执行引擎
 * 监听目标地址交易并自动执行跟单
 */
class CopyTradingExecutor extends EventEmitter {
  constructor() {
    super();
    this.pendingCopies = new Map(); // Map<copyId, copyData>
    this.copyIdCounter = 1;
  }

  /**
   * 处理新交易 - 检查是否需要跟单
   */
  async handleNewTransaction(transaction) {
    const { address, chain, type } = transaction;

    // 只处理 swap 交易
    if (type !== 'swap' && type !== 'dex') {
      return;
    }

    console.log(`🔍 Checking if should copy trade for ${address} on ${chain}`);

    // 查找跟踪这个地址的配置
    const configs = copyTradingManager.getConfigsByTargetAddress(address, chain);

    if (configs.length === 0) {
      return;
    }

    console.log(`📋 Found ${configs.length} copy trading configs for this address`);

    // 为每个配置处理跟单
    for (const config of configs) {
      await this.processCopyTrade(config, transaction);
    }
  }

  /**
   * 处理单个跟单
   */
  async processCopyTrade(config, transaction) {
    try {
      // 检查是否应该跟单
      const { should, reason } = copyTradingManager.shouldCopyTrade(config, transaction);

      if (!should) {
        console.log(`⏭️  Skip copy trade for ${config.configId}: ${reason}`);
        return;
      }

      // 计算跟单金额
      const copyAmount = copyTradingManager.calculateCopyAmount(
        config,
        transaction.fromAmount || transaction.amount
      );

      console.log(`💰 Copy amount calculated: ${copyAmount}`);

      // 准备跟单数据
      const copyData = await this.prepareCopyTrade(config, transaction, copyAmount);

      if (config.autoExecute) {
        // 自动执行模式：直接发送给前端等待钱包确认
        this.emit('copyTradeReady', copyData);
        console.log(`✅ Copy trade ready for auto-execution: ${copyData.copyId}`);
      } else {
        // 手动确认模式：需要用户确认
        this.pendingCopies.set(copyData.copyId, copyData);
        this.emit('copyTradeRequiresConfirmation', copyData);
        console.log(`⏳ Copy trade requires user confirmation: ${copyData.copyId}`);
      }
    } catch (error) {
      console.error(`Error processing copy trade for ${config.configId}:`, error);
      this.recordFailure(config.configId, transaction, error);
    }
  }

  /**
   * 准备跟单交易参数
   */
  async prepareCopyTrade(config, transaction, copyAmount) {
    const copyId = `copy-${Date.now()}-${this.copyIdCounter++}`;

    const copyData = {
      copyId,
      configId: config.configId,
      userAddress: config.userAddress,
      targetAddress: config.targetAddress,
      chain: config.chain,
      originalTransaction: {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
        fromToken: transaction.fromToken,
        toToken: transaction.toToken,
        fromAmount: transaction.fromAmount || transaction.amount,
        timestamp: transaction.timestamp
      },
      copyTrade: {
        fromToken: transaction.fromToken,
        toToken: transaction.toToken,
        fromAmount: copyAmount,
        slippage: config.slippage,
        timestamp: Date.now()
      },
      status: 'pending', // pending, confirmed, failed
      requiresConfirmation: !config.autoExecute
    };

    // 根据链准备特定参数
    if (config.chain === 'bsc') {
      copyData.params = await this.prepareBSCCopyTrade(copyData);
    } else if (config.chain === 'solana') {
      copyData.params = await this.prepareSolanaCopyTrade(copyData);
    }

    return copyData;
  }

  /**
   * 准备 BSC 跟单参数
   */
  async prepareBSCCopyTrade(copyData) {
    const { fromToken, toToken, fromAmount, slippage } = copyData.copyTrade;

    // PancakeSwap Router 地址
    const routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

    // WBNB 地址
    const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

    // 构建交易路径
    const path = [];

    // 简化处理：假设通过 WBNB 中转
    if (fromToken === 'BNB' || fromToken.toLowerCase().includes('bnb')) {
      path.push(WBNB);
    } else {
      path.push(fromToken);
      path.push(WBNB);
    }

    if (toToken === 'BNB' || toToken.toLowerCase().includes('bnb')) {
      path.push(WBNB);
    } else {
      path.push(toToken);
    }

    // Deadline (20分钟后)
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

    return {
      routerAddress,
      path,
      amountIn: fromAmount.toString(),
      slippageBps: Math.floor(slippage * 100),
      deadline,
      to: copyData.userAddress
    };
  }

  /**
   * 准备 Solana 跟单参数
   */
  async prepareSolanaCopyTrade(copyData) {
    const { fromToken, toToken, fromAmount, slippage } = copyData.copyTrade;

    return {
      inputMint: fromToken,
      outputMint: toToken,
      amount: Math.floor(fromAmount * 1e9), // 转换为 lamports
      slippageBps: Math.floor(slippage * 100),
      userPublicKey: copyData.userAddress,
      wrapAndUnwrapSol: true
    };
  }

  /**
   * 确认跟单执行
   */
  confirmCopyTrade(copyId, txHash) {
    const copyData = this.pendingCopies.get(copyId);

    if (!copyData) {
      throw new Error('Copy trade not found');
    }

    copyData.status = 'confirmed';
    copyData.txHash = txHash;
    copyData.confirmedAt = Date.now();

    // 记录成功
    copyTradingManager.recordCopyResult(copyData.configId, {
      copyId,
      originalTxHash: copyData.originalTransaction.hash,
      copyTxHash: txHash,
      fromToken: copyData.copyTrade.fromToken,
      toToken: copyData.copyTrade.toToken,
      amount: copyData.copyTrade.fromAmount,
      status: 'success'
    });

    this.pendingCopies.delete(copyId);
    this.emit('copyTradeConfirmed', copyData);

    console.log(`✅ Copy trade confirmed: ${copyId}`);

    return copyData;
  }

  /**
   * 跟单执行失败
   */
  failCopyTrade(copyId, error) {
    const copyData = this.pendingCopies.get(copyId);

    if (!copyData) {
      return;
    }

    copyData.status = 'failed';
    copyData.error = error.message;
    copyData.failedAt = Date.now();

    // 记录失败
    copyTradingManager.recordCopyResult(copyData.configId, {
      copyId,
      originalTxHash: copyData.originalTransaction.hash,
      fromToken: copyData.copyTrade.fromToken,
      toToken: copyData.copyTrade.toToken,
      amount: copyData.copyTrade.fromAmount,
      status: 'failed',
      error: error.message
    });

    this.pendingCopies.delete(copyId);
    this.emit('copyTradeFailed', copyData);

    console.error(`❌ Copy trade failed: ${copyId}`, error);
  }

  /**
   * 取消跟单
   */
  cancelCopyTrade(copyId) {
    const copyData = this.pendingCopies.get(copyId);

    if (!copyData) {
      throw new Error('Copy trade not found');
    }

    this.pendingCopies.delete(copyId);
    this.emit('copyTradeCancelled', copyData);

    console.log(`🚫 Copy trade cancelled: ${copyId}`);

    return copyData;
  }

  /**
   * 记录失败（没有 copyData 的情况）
   */
  recordFailure(configId, transaction, error) {
    copyTradingManager.recordCopyResult(configId, {
      copyId: `failed-${Date.now()}`,
      originalTxHash: transaction.hash,
      fromToken: transaction.fromToken,
      toToken: transaction.toToken,
      amount: 0,
      status: 'failed',
      error: error.message
    });
  }

  /**
   * 获取待确认的跟单
   */
  getPendingCopies() {
    return Array.from(this.pendingCopies.values());
  }

  /**
   * 清理过期的待确认跟单
   */
  cleanupPendingCopies() {
    const timeout = 10 * 60 * 1000; // 10分钟超时
    const now = Date.now();
    let cleaned = 0;

    for (const [copyId, copyData] of this.pendingCopies) {
      if (now - copyData.copyTrade.timestamp > timeout) {
        this.pendingCopies.delete(copyId);
        cleaned++;
        console.log(`⏰ Cleaned expired pending copy trade: ${copyId}`);
      }
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      pendingCopies: this.pendingCopies.size
    };
  }
}

module.exports = new CopyTradingExecutor();
