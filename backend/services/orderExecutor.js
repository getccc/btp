const EventEmitter = require('events');
const limitOrderManager = require('./limitOrderManager');

class OrderExecutor extends EventEmitter {
  constructor() {
    super();
    this.pendingExecutions = new Map(); // Map<orderId, executionData>
    this.executionHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 准备执行订单
   * 注意：实际执行需要用户授权和私钥，这里只是准备执行参数
   */
  async prepareExecution(order, currentPrice) {
    try {
      console.log(`🔧 Preparing execution for order ${order.orderId}`);

      // 检查订单状态
      if (order.status !== 'active') {
        throw new Error(`Order is not active: ${order.status}`);
      }

      // 计算输出金额（基于当前价格）
      const expectedOutput = order.fromAmount * currentPrice;
      const minOutput = expectedOutput * (1 - order.slippage / 100);

      // 准备执行数据
      const executionData = {
        orderId: order.orderId,
        order: order,
        currentPrice,
        expectedOutput,
        minOutput,
        timestamp: Date.now(),
        status: 'pending', // pending, confirmed, failed
        requiresUserConfirmation: true // 需要用户确认
      };

      // 根据链准备特定参数
      if (order.chain === 'bsc') {
        executionData.params = await this.prepareBSCExecution(order, minOutput);
      } else if (order.chain === 'solana') {
        executionData.params = await this.prepareSolanaExecution(order, minOutput);
      }

      // 保存待执行
      this.pendingExecutions.set(order.orderId, executionData);

      console.log(`✅ Execution prepared for order ${order.orderId}`);
      console.log(`   Expected output: ${expectedOutput.toFixed(6)} ${order.toToken.symbol}`);
      console.log(`   Min output: ${minOutput.toFixed(6)} ${order.toToken.symbol}`);

      // 触发事件，通知前端
      this.emit('executionReady', executionData);

      return executionData;
    } catch (error) {
      console.error(`Error preparing execution for order ${order.orderId}:`, error);

      // 记录尝试
      limitOrderManager.recordAttempt(order.orderId, error);

      throw error;
    }
  }

  /**
   * 准备 BSC 交易参数
   */
  async prepareBSCExecution(order, minOutput) {
    const { fromToken, toToken, fromAmount, slippage } = order;

    // PancakeSwap Router 地址
    const routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

    // 构建交易路径
    const path = [];

    if (fromToken.symbol === 'BNB') {
      // BNB -> Token
      path.push('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'); // WBNB
      path.push(toToken.address);
    } else if (toToken.symbol === 'BNB') {
      // Token -> BNB
      path.push(fromToken.address);
      path.push('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'); // WBNB
    } else {
      // Token -> Token (通过 WBNB)
      path.push(fromToken.address);
      path.push('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'); // WBNB
      path.push(toToken.address);
    }

    // 计算金额（考虑 decimals）
    const amountIn = BigInt(Math.floor(fromAmount * Math.pow(10, fromToken.decimals)));
    const amountOutMin = BigInt(Math.floor(minOutput * Math.pow(10, toToken.decimals)));

    // Deadline (20分钟后)
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

    return {
      routerAddress,
      path,
      amountIn: amountIn.toString(),
      amountOutMin: amountOutMin.toString(),
      deadline,
      to: order.userAddress,
      value: fromToken.symbol === 'BNB' ? amountIn.toString() : '0'
    };
  }

  /**
   * 准备 Solana 交易参数
   */
  async prepareSolanaExecution(order, minOutput) {
    const { fromToken, toToken, fromAmount, slippage } = order;

    // 计算金额（lamports）
    const amountIn = Math.floor(fromAmount * Math.pow(10, fromToken.decimals));
    const amountOutMin = Math.floor(minOutput * Math.pow(10, toToken.decimals));
    const slippageBps = Math.floor(slippage * 100);

    return {
      inputMint: fromToken.address,
      outputMint: toToken.address,
      amount: amountIn,
      slippageBps,
      userPublicKey: order.userAddress,
      wrapAndUnwrapSol: true
    };
  }

  /**
   * 确认执行（用户通过前端确认后调用）
   */
  async confirmExecution(orderId, txHash) {
    const execution = this.pendingExecutions.get(orderId);

    if (!execution) {
      throw new Error('Execution not found');
    }

    try {
      console.log(`✅ Execution confirmed for order ${orderId}`);
      console.log(`   Transaction hash: ${txHash}`);

      // 更新执行状态
      execution.status = 'confirmed';
      execution.txHash = txHash;
      execution.confirmedAt = Date.now();

      // 更新订单状态为已成交
      limitOrderManager.updateOrderStatus(orderId, 'filled', {
        filledAt: Date.now(),
        filledPrice: execution.currentPrice,
        txHash: txHash
      });

      // 添加到历史
      this.addToHistory(execution);

      // 从待执行移除
      this.pendingExecutions.delete(orderId);

      // 触发事件
      this.emit('executionConfirmed', execution);

      return execution;
    } catch (error) {
      console.error(`Error confirming execution for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 执行失败
   */
  async failExecution(orderId, error) {
    const execution = this.pendingExecutions.get(orderId);

    if (!execution) {
      return;
    }

    console.error(`❌ Execution failed for order ${orderId}:`, error.message);

    // 更新执行状态
    execution.status = 'failed';
    execution.error = error.message;
    execution.failedAt = Date.now();

    // 记录尝试
    limitOrderManager.recordAttempt(orderId, error);

    // 添加到历史
    this.addToHistory(execution);

    // 从待执行移除
    this.pendingExecutions.delete(orderId);

    // 触发事件
    this.emit('executionFailed', execution);
  }

  /**
   * 取消执行
   */
  cancelExecution(orderId) {
    const execution = this.pendingExecutions.get(orderId);

    if (!execution) {
      throw new Error('Execution not found');
    }

    console.log(`❌ Execution cancelled for order ${orderId}`);

    // 从待执行移除
    this.pendingExecutions.delete(orderId);

    // 触发事件
    this.emit('executionCancelled', execution);

    return execution;
  }

  /**
   * 获取待执行的订单
   */
  getPendingExecution(orderId) {
    return this.pendingExecutions.get(orderId);
  }

  /**
   * 获取所有待执行订单
   */
  getAllPendingExecutions() {
    return Array.from(this.pendingExecutions.values());
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(limit = 50) {
    return this.executionHistory.slice(0, limit);
  }

  /**
   * 添加到历史
   */
  addToHistory(execution) {
    this.executionHistory.unshift({
      ...execution,
      order: {
        orderId: execution.order.orderId,
        fromToken: execution.order.fromToken.symbol,
        toToken: execution.order.toToken.symbol,
        fromAmount: execution.order.fromAmount,
        targetPrice: execution.order.targetPrice
      }
    });

    // 限制历史大小
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * 清理过期的待执行订单
   */
  cleanupPendingExecutions() {
    const timeout = 5 * 60 * 1000; // 5分钟超时
    const now = Date.now();
    let cleaned = 0;

    for (const [orderId, execution] of this.pendingExecutions) {
      if (now - execution.timestamp > timeout) {
        this.pendingExecutions.delete(orderId);
        cleaned++;

        console.log(`⏰ Cleaned expired pending execution for order ${orderId}`);
      }
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      pendingExecutions: this.pendingExecutions.size,
      historySize: this.executionHistory.length,
      successfulExecutions: this.executionHistory.filter(e => e.status === 'confirmed').length,
      failedExecutions: this.executionHistory.filter(e => e.status === 'failed').length
    };
  }
}

module.exports = new OrderExecutor();
