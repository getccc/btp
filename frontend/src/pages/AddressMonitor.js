import React, { useState, useEffect } from 'react';
import './AddressMonitor.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function AddressMonitor({ socket, connected }) {
  const [addresses, setAddresses] = useState([]);
  const [transactions, setTransactions] = useState({});
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    address: '',
    chain: 'bsc',
    label: ''
  });
  const [filter, setFilter] = useState('all'); // all, bsc, solana

  // 加载监控的地址列表
  useEffect(() => {
    if (socket && connected) {
      // 请求监控的地址列表
      socket.emit('request-monitored-addresses');

      // 监听地址列表更新
      socket.on('monitored-addresses', (addressList) => {
        setAddresses(addressList);
        console.log('Received monitored addresses:', addressList);
      });

      // 监听新交易
      socket.on('new-transaction', (data) => {
        const { address, chain, transaction } = data;
        const key = `${chain}:${address}`;

        setTransactions(prev => {
          const existing = prev[key] || [];
          return {
            ...prev,
            [key]: [transaction, ...existing].slice(0, 100) // 最多保留100条
          };
        });

        console.log('New transaction:', data);
      });

      // 监听地址添加结果
      socket.on('address-added', (result) => {
        if (result.success) {
          console.log('Address added successfully');
          socket.emit('request-monitored-addresses');
          setShowAddForm(false);
          setFormData({ address: '', chain: 'bsc', label: '' });
        } else {
          alert(result.message);
        }
      });

      // 监听地址移除结果
      socket.on('address-removed', (result) => {
        if (result.success) {
          console.log('Address removed successfully');
          socket.emit('request-monitored-addresses');
          if (selectedAddress &&
              `${selectedAddress.chain}:${selectedAddress.address}` ===
              `${result.chain}:${result.address}`) {
            setSelectedAddress(null);
          }
        }
      });

      // 监听交易更新
      socket.on('transactions-update', (data) => {
        const { address, chain, transactions: txList } = data;
        const key = `${chain}:${address}`;
        setTransactions(prev => ({
          ...prev,
          [key]: txList
        }));
      });

      return () => {
        socket.off('monitored-addresses');
        socket.off('new-transaction');
        socket.off('address-added');
        socket.off('address-removed');
        socket.off('transactions-update');
      };
    }
  }, [socket, connected, selectedAddress]);

  // 添加地址
  const handleAddAddress = (e) => {
    e.preventDefault();

    if (!formData.address.trim()) {
      alert('Please enter an address');
      return;
    }

    if (socket && connected) {
      socket.emit('add-address', formData);
    }
  };

  // 删除地址
  const handleRemoveAddress = (address, chain) => {
    if (window.confirm(`Are you sure you want to stop monitoring this address?`)) {
      if (socket && connected) {
        socket.emit('remove-address', { address, chain });
      }
    }
  };

  // 选择地址查看交易
  const handleSelectAddress = (addressInfo) => {
    setSelectedAddress(addressInfo);

    // 请求该地址的交易历史
    if (socket && connected) {
      socket.emit('request-transactions', {
        address: addressInfo.address,
        chain: addressInfo.chain
      });
    }
  };

  // 过滤地址
  const filteredAddresses = filter === 'all'
    ? addresses
    : addresses.filter(addr => addr.chain === filter);

  // 获取当前选中地址的交易
  const currentTransactions = selectedAddress
    ? transactions[`${selectedAddress.chain}:${selectedAddress.address}`] || []
    : [];

  // 格式化地址
  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // 格式化数量
  const formatAmount = (value) => {
    if (value === 0) return '0';
    if (value < 0.0001) return value.toFixed(8);
    if (value < 1) return value.toFixed(6);
    return value.toFixed(4);
  };

  return (
    <div className="address-monitor">
      <div className="monitor-header">
        <h1>📍 Address Monitor</h1>
        <p className="subtitle">Real-time monitoring of wallet transactions</p>

        <div className="header-actions">
          <button
            className="add-address-btn"
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={!connected}
          >
            ➕ Add Address
          </button>

          <div className="connection-status">
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="add-address-form">
          <h3>Add New Address</h3>
          <form onSubmit={handleAddAddress}>
            <div className="form-group">
              <label>Chain:</label>
              <select
                value={formData.chain}
                onChange={(e) => setFormData({ ...formData, chain: e.target.value })}
              >
                <option value="bsc">BSC</option>
                <option value="solana">Solana</option>
              </select>
            </div>

            <div className="form-group">
              <label>Address:</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={formData.chain === 'bsc' ? '0x...' : 'Base58 address'}
              />
            </div>

            <div className="form-group">
              <label>Label (optional):</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="My Wallet"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">Add</button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="monitor-content">
        <div className="addresses-panel">
          <div className="panel-header">
            <h3>Monitored Addresses ({filteredAddresses.length})</h3>
            <div className="filter-buttons">
              <button
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={filter === 'bsc' ? 'active' : ''}
                onClick={() => setFilter('bsc')}
              >
                BSC
              </button>
              <button
                className={filter === 'solana' ? 'active' : ''}
                onClick={() => setFilter('solana')}
              >
                Solana
              </button>
            </div>
          </div>

          <div className="addresses-list">
            {filteredAddresses.length === 0 ? (
              <div className="empty-state">
                <p>No addresses being monitored</p>
                <p className="hint">Click "Add Address" to start monitoring</p>
              </div>
            ) : (
              filteredAddresses.map((addr) => {
                const key = `${addr.chain}:${addr.address}`;
                const txCount = (transactions[key] || []).length;
                const isSelected = selectedAddress &&
                  `${selectedAddress.chain}:${selectedAddress.address}` === key;

                return (
                  <div
                    key={key}
                    className={`address-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectAddress(addr)}
                  >
                    <div className="address-info">
                      <div className="address-chain">{addr.chain.toUpperCase()}</div>
                      <div className="address-label">{addr.label}</div>
                      <div className="address-value">{formatAddress(addr.address)}</div>
                      <div className="address-stats">{txCount} transactions</div>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAddress(addr.address, addr.chain);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="transactions-panel">
          <div className="panel-header">
            <h3>
              {selectedAddress
                ? `Transactions for ${selectedAddress.label}`
                : 'Select an address to view transactions'
              }
            </h3>
            {selectedAddress && (
              <div className="address-detail">
                <span className="chain-badge">{selectedAddress.chain.toUpperCase()}</span>
                <span className="address-full">{selectedAddress.address}</span>
              </div>
            )}
          </div>

          <div className="transactions-list">
            {!selectedAddress ? (
              <div className="empty-state">
                <p>👈 Select an address from the left panel</p>
              </div>
            ) : currentTransactions.length === 0 ? (
              <div className="empty-state">
                <div className="loader"></div>
                <p>Waiting for transactions...</p>
                <p className="hint">New transactions will appear here in real-time</p>
              </div>
            ) : (
              currentTransactions.map((tx, index) => (
                <div key={`${tx.hash}-${index}`} className="transaction-item">
                  <div className="tx-header">
                    <span className={`tx-type ${tx.type.toLowerCase()}`}>
                      {tx.type === 'IN' ? '📥' : tx.type === 'OUT' ? '📤' : '🔄'} {tx.type}
                    </span>
                    <span className={`tx-category ${tx.txType.toLowerCase()}`}>
                      {tx.txType}
                    </span>
                    <span className="tx-time">{formatTime(tx.timeStamp)}</span>
                  </div>

                  <div className="tx-details">
                    <div className="tx-amount">
                      <span className="amount">{formatAmount(tx.value)}</span>
                      <span className="token">{tx.tokenSymbol}</span>
                    </div>

                    <div className="tx-addresses">
                      <div className="tx-from">
                        From: <span>{formatAddress(tx.from)}</span>
                      </div>
                      <div className="tx-to">
                        To: <span>{formatAddress(tx.to)}</span>
                      </div>
                    </div>

                    <div className="tx-hash">
                      <a
                        href={tx.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  </div>

                  <div className={`tx-status ${tx.status}`}>
                    {tx.status === 'success' ? '✅' : '❌'} {tx.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddressMonitor;
