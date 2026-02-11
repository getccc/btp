import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useWallet } from '../hooks/useWallet';
import { useSolanaWallet } from '../hooks/useSolanaWallet';
import './CopyTradingPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
let socket = null;

function CopyTradingPage() {
  // BSC钱包
  const {
    account: bscAccount,
    isConnected: bscConnected,
    connect: connectBSC
  } = useWallet();

  // Solana钱包
  const {
    publicKey: solanaPublicKey,
    isConnected: solanaConnected,
    connect: connectSolana
  } = useSolanaWallet();

  const [selectedChain, setSelectedChain] = useState('bsc');
  const [isConnected, setIsConnected] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // 表单状态
  const [formData, setFormData] = useState({
    targetAddress: '',
    label: '',
    amountMode: 'fixed',
    fixedAmount: '',
    percentage: '',
    maxAmount: '',
    slippage: '1.0',
    autoExecute: true,
    whitelistTokens: '',
    blacklistTokens: ''
  });

  // 配置和历史
  const [configs, setConfigs] = useState([]);
  const [copyHistory, setCopyHistory] = useState([]);
  const [pendingCopies, setPendingCopies] = useState([]);
  const [stats, setStats] = useState(null);

  // 当前钱包状态
  const isWalletConnected = selectedChain === 'bsc' ? bscConnected : solanaConnected;
  const currentAccount = selectedChain === 'bsc' ? bscAccount : solanaPublicKey;

  // WebSocket连接
  useEffect(() => {
    if (!socket) {
      socket = io(BACKEND_URL);

      socket.on('connect', () => {
        console.log('Connected to backend');
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from backend');
        setIsConnected(false);
      });

      // 监听配置事件
      socket.on('copy-config-created', () => {
        loadUserConfigs();
        loadStats();
      });

      socket.on('copy-config-updated', () => {
        loadUserConfigs();
      });

      socket.on('copy-config-status-changed', () => {
        loadUserConfigs();
      });

      socket.on('copy-config-deleted', () => {
        loadUserConfigs();
        loadStats();
      });

      // 监听跟单事件
      socket.on('copy-trade-ready', (copyData) => {
        console.log('Copy trade ready:', copyData);
        alert(`🤖 New copy trade detected!\n${copyData.copyTrade.fromToken} → ${copyData.copyTrade.toToken}\nAmount: ${copyData.copyTrade.fromAmount}`);
        setPendingCopies(prev => [...prev, copyData]);
      });

      socket.on('copy-trade-requires-confirmation', (copyData) => {
        console.log('Copy trade requires confirmation:', copyData);
        alert(`⏳ Copy trade requires your confirmation!\n${copyData.copyTrade.fromToken} → ${copyData.copyTrade.toToken}\nAmount: ${copyData.copyTrade.fromAmount}`);
        setPendingCopies(prev => [...prev, copyData]);
      });

      socket.on('copy-trade-confirmed', () => {
        loadUserConfigs();
        loadCopyHistory();
        setPendingCopies([]);
      });

      socket.on('copy-trade-failed', (copyData) => {
        alert(`❌ Copy trade failed: ${copyData.error}`);
        setPendingCopies(prev => prev.filter(c => c.copyId !== copyData.copyId));
      });

      socket.on('copy-executed', () => {
        loadCopyHistory();
        loadUserConfigs();
      });

      socket.on('copy-config-error', (data) => {
        alert(`Error: ${data.error}`);
      });

      socket.on('copy-trade-error', (data) => {
        alert(`Error: ${data.error}`);
      });
    }

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  // 加载用户配置
  useEffect(() => {
    if (currentAccount && selectedChain && isConnected) {
      loadUserConfigs();
      loadCopyHistory();
      loadStats();
    }
  }, [currentAccount, selectedChain, isConnected]);

  const loadUserConfigs = async () => {
    if (!currentAccount) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/copy-trading/user/${currentAccount}?chain=${selectedChain}`);
      const data = await response.json();

      if (data.success) {
        setConfigs(data.configs);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    }
  };

  const loadCopyHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/copy-trading/history?limit=20`);
      const data = await response.json();

      if (data.success) {
        setCopyHistory(data.history);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/copy-trading/stats`);
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreateConfig = (e) => {
    e.preventDefault();

    if (!currentAccount) {
      alert('Please connect your wallet first');
      return;
    }

    if (!formData.targetAddress) {
      alert('Please enter target address');
      return;
    }

    if (formData.amountMode === 'fixed' && !formData.fixedAmount) {
      alert('Please enter fixed amount');
      return;
    }

    if (formData.amountMode === 'percentage' && !formData.percentage) {
      alert('Please enter percentage');
      return;
    }

    const configData = {
      userAddress: currentAccount,
      targetAddress: formData.targetAddress,
      chain: selectedChain,
      label: formData.label || `Copy ${formData.targetAddress.substring(0, 6)}...`,
      amountMode: formData.amountMode,
      fixedAmount: parseFloat(formData.fixedAmount) || 0,
      percentage: parseFloat(formData.percentage) || 0,
      maxAmount: parseFloat(formData.maxAmount) || Infinity,
      slippage: parseFloat(formData.slippage),
      autoExecute: formData.autoExecute,
      whitelistTokens: formData.whitelistTokens.split(',').map(t => t.trim()).filter(t => t),
      blacklistTokens: formData.blacklistTokens.split(',').map(t => t.trim()).filter(t => t)
    };

    socket.emit('create-copy-config', configData);

    // 重置表单
    setFormData({
      targetAddress: '',
      label: '',
      amountMode: 'fixed',
      fixedAmount: '',
      percentage: '',
      maxAmount: '',
      slippage: '1.0',
      autoExecute: true,
      whitelistTokens: '',
      blacklistTokens: ''
    });
    setShowCreateForm(false);
  };

  const handleUpdateStatus = (configId, status) => {
    socket.emit('update-copy-config-status', { configId, status });
  };

  const handleDeleteConfig = (configId) => {
    if (window.confirm('Are you sure you want to delete this copy trading config?')) {
      socket.emit('delete-copy-config', { configId });
    }
  };

  const handleConfirmCopy = (copyData, txHash) => {
    if (!txHash) {
      txHash = prompt('Please enter the transaction hash:');
      if (!txHash) return;
    }

    socket.emit('confirm-copy-trade', { copyId: copyData.copyId, txHash });
  };

  const handleCancelCopy = (copyData) => {
    socket.emit('cancel-copy-trade', { copyId: copyData.copyId });
    setPendingCopies(prev => prev.filter(c => c.copyId !== copyData.copyId));
  };

  const handleConnectWallet = () => {
    if (selectedChain === 'bsc') {
      connectBSC();
    } else {
      connectSolana();
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'status-active';
      case 'paused': return 'status-paused';
      case 'stopped': return 'status-stopped';
      default: return '';
    }
  };

  return (
    <div className="copy-trading-page">
      <div className="copy-trading-container">
        <div className="page-header">
          <h2>🤖 Copy Trading Bot</h2>
          <p className="subtitle">Automatically copy trades from successful wallets</p>
          <div className="connection-status">
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>

        {/* Chain Selector */}
        <div className="chain-selector">
          <button
            className={`chain-btn ${selectedChain === 'bsc' ? 'active' : ''}`}
            onClick={() => setSelectedChain('bsc')}
          >
            BSC
          </button>
          <button
            className={`chain-btn ${selectedChain === 'solana' ? 'active' : ''}`}
            onClick={() => setSelectedChain('solana')}
          >
            Solana
          </button>
        </div>

        {!isWalletConnected ? (
          <div className="wallet-connect-prompt">
            <button className="connect-wallet-btn" onClick={handleConnectWallet}>
              Connect {selectedChain === 'bsc' ? 'MetaMask' : 'Phantom'}
            </button>
            <p>Connect your wallet to start copy trading</p>
          </div>
        ) : (
          <>
            {/* Statistics */}
            {stats && (
              <div className="stats-section">
                <div className="stat-card">
                  <div className="stat-value">{stats.totalConfigs}</div>
                  <div className="stat-label">Total Configs</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.activeConfigs}</div>
                  <div className="stat-label">Active</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.successfulCopies}</div>
                  <div className="stat-label">Successful</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.failedCopies}</div>
                  <div className="stat-label">Failed</div>
                </div>
              </div>
            )}

            {/* Pending Copies */}
            {pendingCopies.length > 0 && (
              <div className="pending-copies-section">
                <h3>⏳ Pending Copy Trades</h3>
                {pendingCopies.map(copy => (
                  <div key={copy.copyId} className="pending-copy-card">
                    <div className="copy-info">
                      <div className="copy-pair">
                        {copy.copyTrade.fromToken} → {copy.copyTrade.toToken}
                      </div>
                      <div className="copy-details">
                        <span>Amount: {copy.copyTrade.fromAmount}</span>
                        <span>Target: {formatAddress(copy.targetAddress)}</span>
                        <span>Original Tx: {formatAddress(copy.originalTransaction.hash)}</span>
                      </div>
                    </div>
                    <div className="copy-actions">
                      <button
                        className="confirm-copy-btn"
                        onClick={() => handleConfirmCopy(copy)}
                      >
                        Confirm
                      </button>
                      <button
                        className="cancel-copy-btn"
                        onClick={() => handleCancelCopy(copy)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Config Button */}
            <div className="create-config-section">
              <button
                className="create-config-btn"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                {showCreateForm ? '− Cancel' : '+ New Copy Trading Config'}
              </button>
            </div>

            {/* Create Config Form */}
            {showCreateForm && (
              <div className="create-form">
                <h3>Create Copy Trading Config</h3>
                <form onSubmit={handleCreateConfig}>
                  <div className="form-group">
                    <label>Target Address *</label>
                    <input
                      type="text"
                      placeholder="0x... or wallet address"
                      value={formData.targetAddress}
                      onChange={(e) => setFormData({ ...formData, targetAddress: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Label (Optional)</label>
                    <input
                      type="text"
                      placeholder="My favorite trader"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Amount Mode</label>
                    <div className="radio-group">
                      <label>
                        <input
                          type="radio"
                          value="fixed"
                          checked={formData.amountMode === 'fixed'}
                          onChange={(e) => setFormData({ ...formData, amountMode: e.target.value })}
                        />
                        Fixed Amount
                      </label>
                      <label>
                        <input
                          type="radio"
                          value="percentage"
                          checked={formData.amountMode === 'percentage'}
                          onChange={(e) => setFormData({ ...formData, amountMode: e.target.value })}
                        />
                        Percentage
                      </label>
                    </div>
                  </div>

                  {formData.amountMode === 'fixed' ? (
                    <div className="form-group">
                      <label>Fixed Amount *</label>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="0.1"
                        value={formData.fixedAmount}
                        onChange={(e) => setFormData({ ...formData, fixedAmount: e.target.value })}
                        required
                      />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Percentage (%) *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="10"
                        value={formData.percentage}
                        onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                        required
                      />
                      <small>Copy X% of target's trade amount</small>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Max Amount (Optional)</label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="1.0"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                    />
                    <small>Maximum amount per copy trade</small>
                  </div>

                  <div className="form-group">
                    <label>Slippage Tolerance (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={formData.slippage}
                      onChange={(e) => setFormData({ ...formData, slippage: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.autoExecute}
                        onChange={(e) => setFormData({ ...formData, autoExecute: e.target.checked })}
                      />
                      Auto Execute (no manual confirmation)
                    </label>
                  </div>

                  <div className="form-group">
                    <label>Whitelist Tokens (Optional)</label>
                    <input
                      type="text"
                      placeholder="USDT, BNB, ETH (comma separated)"
                      value={formData.whitelistTokens}
                      onChange={(e) => setFormData({ ...formData, whitelistTokens: e.target.value })}
                    />
                    <small>Only copy trades with these tokens</small>
                  </div>

                  <div className="form-group">
                    <label>Blacklist Tokens (Optional)</label>
                    <input
                      type="text"
                      placeholder="SCAM, FAKE (comma separated)"
                      value={formData.blacklistTokens}
                      onChange={(e) => setFormData({ ...formData, blacklistTokens: e.target.value })}
                    />
                    <small>Never copy trades with these tokens</small>
                  </div>

                  <button type="submit" className="submit-btn">
                    Create Config
                  </button>
                </form>
              </div>
            )}

            {/* Configs List */}
            <div className="configs-section">
              <h3>My Copy Trading Configs</h3>
              {configs.length === 0 ? (
                <div className="empty-state">
                  No copy trading configs yet. Create one to start!
                </div>
              ) : (
                <div className="configs-list">
                  {configs.map(config => (
                    <div key={config.configId} className="config-card">
                      <div className="config-header">
                        <div className="config-label">{config.label}</div>
                        <span className={`status-badge ${getStatusColor(config.status)}`}>
                          {config.status}
                        </span>
                      </div>
                      <div className="config-details">
                        <div className="detail-row">
                          <span className="detail-label">Target:</span>
                          <span className="detail-value">{formatAddress(config.targetAddress)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Amount:</span>
                          <span className="detail-value">
                            {config.amountMode === 'fixed'
                              ? `${config.fixedAmount} (Fixed)`
                              : `${config.percentage}% (Percentage)`}
                          </span>
                        </div>
                        {config.maxAmount && config.maxAmount !== Infinity && (
                          <div className="detail-row">
                            <span className="detail-label">Max:</span>
                            <span className="detail-value">{config.maxAmount}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="detail-label">Slippage:</span>
                          <span className="detail-value">{config.slippage}%</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Auto Execute:</span>
                          <span className="detail-value">{config.autoExecute ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                      <div className="config-stats">
                        <div className="stat-item">
                          <div className="stat-num">{config.stats.totalCopied}</div>
                          <div className="stat-text">Total</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-num">{config.stats.successfulCopies}</div>
                          <div className="stat-text">Success</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-num">{config.stats.failedCopies}</div>
                          <div className="stat-text">Failed</div>
                        </div>
                      </div>
                      <div className="config-actions">
                        {config.status === 'active' && (
                          <button
                            className="action-btn pause-btn"
                            onClick={() => handleUpdateStatus(config.configId, 'paused')}
                          >
                            Pause
                          </button>
                        )}
                        {config.status === 'paused' && (
                          <button
                            className="action-btn resume-btn"
                            onClick={() => handleUpdateStatus(config.configId, 'active')}
                          >
                            Resume
                          </button>
                        )}
                        <button
                          className="action-btn stop-btn"
                          onClick={() => handleUpdateStatus(config.configId, 'stopped')}
                        >
                          Stop
                        </button>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteConfig(config.configId)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Copy History */}
            <div className="history-section">
              <h3>📜 Copy Trading History</h3>
              {copyHistory.length === 0 ? (
                <div className="empty-state">No copy trades yet</div>
              ) : (
                <div className="history-list">
                  {copyHistory.map((item, index) => (
                    <div key={index} className="history-item">
                      <div className="history-info">
                        <div className="history-pair">
                          {item.fromToken} → {item.toToken}
                        </div>
                        <div className="history-details">
                          <span>Amount: {item.amount}</span>
                          <span>Time: {formatTime(item.timestamp)}</span>
                          {item.copyTxHash && (
                            <span>Tx: {formatAddress(item.copyTxHash)}</span>
                          )}
                        </div>
                      </div>
                      <span className={`history-status status-${item.status}`}>
                        {item.status === 'success' ? '✅' : '❌'} {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CopyTradingPage;
