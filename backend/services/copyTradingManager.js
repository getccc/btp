const EventEmitter = require('events');

/**
 * 跟单配置管理器
 * 管理跟单配置、状态和历史记录
 */
class CopyTradingManager extends EventEmitter {
  constructor() {
    super();
    this.configs = new Map(); // Map<configId, config>
    this.copyHistory = []; // 跟单历史
    this.maxHistorySize = 200;
    this.configIdCounter = 1;
  }

  /**
   * 创建跟单配置
   */
  createConfig(configData) {
    const {
      userAddress,
      targetAddress,
      chain,
      label,
      amountMode, // 'fixed' or 'percentage'
      fixedAmount,
      percentage,
      maxAmount,
      slippage,
      autoExecute,
      whitelistTokens, // 可选：只跟单特定代币
      blacklistTokens  // 可选：不跟单特定代币
    } = configData;

    // 验证参数
    if (!userAddress || !targetAddress || !chain) {
      throw new Error('userAddress, targetAddress and chain are required');
    }

    if (!['bsc', 'solana'].includes(chain)) {
      throw new Error('Invalid chain. Use bsc or solana');
    }

    if (!['fixed', 'percentage'].includes(amountMode)) {
      throw new Error('Invalid amountMode. Use fixed or percentage');
    }

    if (amountMode === 'fixed' && (!fixedAmount || fixedAmount <= 0)) {
      throw new Error('fixedAmount must be greater than 0 for fixed mode');
    }

    if (amountMode === 'percentage' && (!percentage || percentage <= 0 || percentage > 100)) {
      throw new Error('percentage must be between 0 and 100 for percentage mode');
    }

    const configId = `${chain}-${this.configIdCounter++}`;

    const config = {
      configId,
      userAddress: userAddress.toLowerCase(),
      targetAddress: targetAddress.toLowerCase(),
      chain,
      label: label || `Copy ${targetAddress.substring(0, 6)}...`,
      amountMode,
      fixedAmount: fixedAmount || 0,
      percentage: percentage || 0,
      maxAmount: maxAmount || Infinity,
      slippage: slippage || 1.0,
      autoExecute: autoExecute !== undefined ? autoExecute : true,
      whitelistTokens: whitelistTokens || [],
      blacklistTokens: blacklistTokens || [],
      status: 'active', // 'active', 'paused', 'stopped'
      createdAt: Date.now(),
      stats: {
        totalCopied: 0,
        successfulCopies: 0,
        failedCopies: 0,
        totalVolume: 0
      }
    };

    this.configs.set(configId, config);
    this.emit('configCreated', config);

    console.log(`✅ Copy trading config created: ${configId}`);

    return config;
  }

  /**
   * 更新跟单配置
   */
  updateConfig(configId, updates) {
    const config = this.configs.get(configId);

    if (!config) {
      throw new Error('Config not found');
    }

    // 允许更新的字段
    const allowedFields = [
      'label', 'amountMode', 'fixedAmount', 'percentage',
      'maxAmount', 'slippage', 'autoExecute',
      'whitelistTokens', 'blacklistTokens'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        config[field] = updates[field];
      }
    });

    config.updatedAt = Date.now();

    this.emit('configUpdated', config);

    console.log(`📝 Copy trading config updated: ${configId}`);

    return config;
  }

  /**
   * 更新配置状态
   */
  updateConfigStatus(configId, status) {
    const config = this.configs.get(configId);

    if (!config) {
      throw new Error('Config not found');
    }

    if (!['active', 'paused', 'stopped'].includes(status)) {
      throw new Error('Invalid status. Use active, paused, or stopped');
    }

    config.status = status;
    config.updatedAt = Date.now();

    this.emit('configStatusChanged', config);

    console.log(`🔄 Copy trading config status changed: ${configId} -> ${status}`);

    return config;
  }

  /**
   * 删除跟单配置
   */
  deleteConfig(configId) {
    const config = this.configs.get(configId);

    if (!config) {
      throw new Error('Config not found');
    }

    this.configs.delete(configId);
    this.emit('configDeleted', config);

    console.log(`🗑️  Copy trading config deleted: ${configId}`);

    return config;
  }

  /**
   * 获取单个配置
   */
  getConfig(configId) {
    return this.configs.get(configId);
  }

  /**
   * 获取用户的所有配置
   */
  getUserConfigs(userAddress, chain = null) {
    const configs = Array.from(this.configs.values());

    return configs.filter(config => {
      const matchUser = config.userAddress.toLowerCase() === userAddress.toLowerCase();
      const matchChain = !chain || config.chain === chain;
      return matchUser && matchChain;
    });
  }

  /**
   * 获取活跃的配置
   */
  getActiveConfigs(chain = null) {
    const configs = Array.from(this.configs.values());

    return configs.filter(config => {
      const isActive = config.status === 'active';
      const matchChain = !chain || config.chain === chain;
      return isActive && matchChain;
    });
  }

  /**
   * 根据目标地址获取配置
   */
  getConfigsByTargetAddress(targetAddress, chain) {
    const configs = Array.from(this.configs.values());

    return configs.filter(config => {
      return config.targetAddress.toLowerCase() === targetAddress.toLowerCase() &&
             config.chain === chain &&
             config.status === 'active';
    });
  }

  /**
   * 检查是否应该跟单这个交易
   */
  shouldCopyTrade(config, transaction) {
    // 检查配置状态
    if (config.status !== 'active') {
      return { should: false, reason: 'Config is not active' };
    }

    // 检查白名单
    if (config.whitelistTokens.length > 0) {
      const fromTokenInWhitelist = config.whitelistTokens.includes(transaction.fromToken);
      const toTokenInWhitelist = config.whitelistTokens.includes(transaction.toToken);

      if (!fromTokenInWhitelist && !toTokenInWhitelist) {
        return { should: false, reason: 'Token not in whitelist' };
      }
    }

    // 检查黑名单
    if (config.blacklistTokens.length > 0) {
      const fromTokenInBlacklist = config.blacklistTokens.includes(transaction.fromToken);
      const toTokenInBlacklist = config.blacklistTokens.includes(transaction.toToken);

      if (fromTokenInBlacklist || toTokenInBlacklist) {
        return { should: false, reason: 'Token in blacklist' };
      }
    }

    return { should: true };
  }

  /**
   * 计算跟单金额
   */
  calculateCopyAmount(config, originalAmount) {
    let copyAmount;

    if (config.amountMode === 'fixed') {
      copyAmount = config.fixedAmount;
    } else {
      // percentage mode
      copyAmount = originalAmount * (config.percentage / 100);
    }

    // 应用最大金额限制
    if (copyAmount > config.maxAmount) {
      copyAmount = config.maxAmount;
    }

    return copyAmount;
  }

  /**
   * 记录跟单结果
   */
  recordCopyResult(configId, copyData) {
    const config = this.configs.get(configId);

    if (!config) {
      console.error(`Config not found: ${configId}`);
      return;
    }

    // 更新统计
    config.stats.totalCopied++;

    if (copyData.status === 'success') {
      config.stats.successfulCopies++;
      config.stats.totalVolume += copyData.amount;
    } else {
      config.stats.failedCopies++;
    }

    // 添加到历史
    this.addToHistory({
      configId,
      ...copyData,
      timestamp: Date.now()
    });

    this.emit('copyExecuted', { config, copyData });
  }

  /**
   * 添加到历史记录
   */
  addToHistory(copyData) {
    this.copyHistory.unshift(copyData);

    // 限制历史大小
    if (this.copyHistory.length > this.maxHistorySize) {
      this.copyHistory = this.copyHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * 获取跟单历史
   */
  getCopyHistory(configId = null, limit = 50) {
    let history = this.copyHistory;

    if (configId) {
      history = history.filter(item => item.configId === configId);
    }

    return history.slice(0, limit);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const allConfigs = Array.from(this.configs.values());

    return {
      totalConfigs: this.configs.size,
      activeConfigs: allConfigs.filter(c => c.status === 'active').length,
      pausedConfigs: allConfigs.filter(c => c.status === 'paused').length,
      stoppedConfigs: allConfigs.filter(c => c.status === 'stopped').length,
      totalCopied: allConfigs.reduce((sum, c) => sum + c.stats.totalCopied, 0),
      successfulCopies: allConfigs.reduce((sum, c) => sum + c.stats.successfulCopies, 0),
      failedCopies: allConfigs.reduce((sum, c) => sum + c.stats.failedCopies, 0),
      historySize: this.copyHistory.length
    };
  }

  /**
   * 获取所有配置（管理用）
   */
  getAllConfigs() {
    return Array.from(this.configs.values());
  }
}

module.exports = new CopyTradingManager();
