const EventEmitter = require('events');

class AddressMonitor extends EventEmitter {
  constructor() {
    super();
    this.monitoredAddresses = new Map(); // Map<address, {chain, label, addedAt}>
    this.transactions = new Map(); // Map<address, Array<transaction>>
    this.maxTransactionsPerAddress = 100; // 每个地址最多保存100条交易
  }

  /**
   * 添加监控地址
   */
  addAddress(address, chain, label = '') {
    const key = `${chain}:${address}`.toLowerCase();

    if (this.monitoredAddresses.has(key)) {
      return { success: false, message: 'Address already being monitored' };
    }

    this.monitoredAddresses.set(key, {
      address: address,
      chain: chain,
      label: label || address.slice(0, 8),
      addedAt: Date.now()
    });

    // 初始化交易列表
    if (!this.transactions.has(key)) {
      this.transactions.set(key, []);
    }

    console.log(`✅ Added ${chain.toUpperCase()} address to monitor: ${address}`);

    return {
      success: true,
      message: 'Address added successfully',
      data: this.monitoredAddresses.get(key)
    };
  }

  /**
   * 移除监控地址
   */
  removeAddress(address, chain) {
    const key = `${chain}:${address}`.toLowerCase();

    if (!this.monitoredAddresses.has(key)) {
      return { success: false, message: 'Address not found' };
    }

    this.monitoredAddresses.delete(key);
    this.transactions.delete(key);

    console.log(`❌ Removed ${chain.toUpperCase()} address from monitor: ${address}`);

    return { success: true, message: 'Address removed successfully' };
  }

  /**
   * 获取所有监控的地址
   */
  getMonitoredAddresses(chain = null) {
    const addresses = Array.from(this.monitoredAddresses.values());

    if (chain) {
      return addresses.filter(addr => addr.chain === chain);
    }

    return addresses;
  }

  /**
   * 检查地址是否被监控
   */
  isMonitored(address, chain) {
    const key = `${chain}:${address}`.toLowerCase();
    return this.monitoredAddresses.has(key);
  }

  /**
   * 添加交易记录
   */
  addTransaction(address, chain, transaction) {
    const key = `${chain}:${address}`.toLowerCase();

    if (!this.monitoredAddresses.has(key)) {
      return false;
    }

    const txList = this.transactions.get(key) || [];

    // 检查是否已存在（防止重复）
    const exists = txList.some(tx => tx.hash === transaction.hash);
    if (exists) {
      return false;
    }

    // 添加到列表开头
    txList.unshift({
      ...transaction,
      receivedAt: Date.now()
    });

    // 限制列表长度
    if (txList.length > this.maxTransactionsPerAddress) {
      txList.pop();
    }

    this.transactions.set(key, txList);

    // 触发新交易事件
    this.emit('newTransaction', {
      address,
      chain,
      transaction: txList[0]
    });

    console.log(`📝 New transaction for ${chain}:${address.slice(0, 8)}: ${transaction.hash.slice(0, 10)}...`);

    return true;
  }

  /**
   * 获取地址的交易列表
   */
  getTransactions(address, chain, limit = 50) {
    const key = `${chain}:${address}`.toLowerCase();
    const txList = this.transactions.get(key) || [];

    return txList.slice(0, limit);
  }

  /**
   * 获取所有地址的交易统计
   */
  getStats() {
    const stats = {
      totalAddresses: this.monitoredAddresses.size,
      totalTransactions: 0,
      byChain: {
        bsc: { addresses: 0, transactions: 0 },
        solana: { addresses: 0, transactions: 0 }
      }
    };

    for (const [key, addressInfo] of this.monitoredAddresses) {
      const chain = addressInfo.chain;
      const txCount = (this.transactions.get(key) || []).length;

      stats.byChain[chain].addresses++;
      stats.byChain[chain].transactions += txCount;
      stats.totalTransactions += txCount;
    }

    return stats;
  }

  /**
   * 清空某个地址的交易记录
   */
  clearTransactions(address, chain) {
    const key = `${chain}:${address}`.toLowerCase();

    if (this.transactions.has(key)) {
      this.transactions.set(key, []);
      return true;
    }

    return false;
  }

  /**
   * 清空所有数据
   */
  clear() {
    this.monitoredAddresses.clear();
    this.transactions.clear();
    console.log('🧹 Cleared all monitored addresses and transactions');
  }
}

module.exports = new AddressMonitor();
