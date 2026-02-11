import React, { useState, useEffect } from 'react';
import './TransactionHistory.css';

function TransactionHistory({ chain }) {
  const [transactions, setTransactions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // 从localStorage加载交易历史
  useEffect(() => {
    const loadHistory = () => {
      const history = localStorage.getItem(`tx_history_${chain}`) || '[]';
      try {
        const parsed = JSON.parse(history);
        setTransactions(parsed.slice(0, 20)); // 只显示最近20条
      } catch (error) {
        console.error('Error loading transaction history:', error);
        setTransactions([]);
      }
    };

    loadHistory();

    // 监听storage事件，实时更新
    window.addEventListener('storage', loadHistory);
    return () => window.removeEventListener('storage', loadHistory);
  }, [chain]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const formatAmount = (amount) => {
    if (amount < 0.0001) return amount.toFixed(8);
    if (amount < 1) return amount.toFixed(6);
    return amount.toFixed(4);
  };

  const getExplorerUrl = (tx) => {
    if (chain === 'bsc') {
      return `https://bscscan.com/tx/${tx.hash}`;
    } else {
      return `https://solscan.io/tx/${tx.hash}`;
    }
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear transaction history?')) {
      localStorage.removeItem(`tx_history_${chain}`);
      setTransactions([]);
    }
  };

  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="transaction-history-container">
      <button
        className="history-toggle"
        onClick={() => setShowHistory(!showHistory)}
      >
        📜 Transaction History ({transactions.length})
      </button>

      {showHistory && (
        <div className="history-panel">
          <div className="history-header">
            <h3>Recent Transactions</h3>
            <button onClick={clearHistory} className="clear-btn">
              Clear All
            </button>
          </div>

          <div className="history-list">
            {transactions.map((tx, index) => (
              <div key={`${tx.hash}-${index}`} className="history-item">
                <div className="tx-info">
                  <div className="tx-route">
                    <span className="token-badge">{tx.fromToken}</span>
                    <span className="arrow">→</span>
                    <span className="token-badge">{tx.toToken}</span>
                  </div>
                  <div className="tx-amounts">
                    <span className="amount">
                      {formatAmount(tx.fromAmount)} {tx.fromToken}
                    </span>
                    <span className="arrow">→</span>
                    <span className="amount">
                      {formatAmount(tx.toAmount)} {tx.toToken}
                    </span>
                  </div>
                </div>

                <div className="tx-meta">
                  <span className={`status ${tx.status}`}>
                    {tx.status === 'success' ? '✅' : tx.status === 'failed' ? '❌' : '⏳'}
                    {tx.status}
                  </span>
                  <span className="time">{formatTime(tx.timestamp)}</span>
                </div>

                <a
                  href={getExplorerUrl(tx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-link"
                >
                  View →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 工具函数：添加交易到历史记录
export function addTransactionToHistory(chain, transaction) {
  try {
    const key = `tx_history_${chain}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');

    // 添加到开头
    history.unshift({
      ...transaction,
      timestamp: Date.now()
    });

    // 只保留最近50条
    const trimmed = history.slice(0, 50);

    localStorage.setItem(key, JSON.stringify(trimmed));

    // 触发storage事件
    window.dispatchEvent(new Event('storage'));
  } catch (error) {
    console.error('Error adding transaction to history:', error);
  }
}

export default TransactionHistory;
