import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import TokenList from './components/TokenList';
import AddressMonitor from './pages/AddressMonitor';
import SwapPage from './pages/SwapPageEnhanced';
import CopyTradingPage from './pages/CopyTradingPage';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState('rankings'); // 'rankings', 'monitor', 'swap', or 'copy-trading'
  const [selectedChain, setSelectedChain] = useState('bsc');
  const [sortBy, setSortBy] = useState('volume');
  const [data, setData] = useState({
    bsc: { topByVolume: [], topByTxns: [], totalTokens: 0 },
    solana: { topByVolume: [], topByTxns: [], totalTokens: 0 }
  });
  const [lastUpdate, setLastUpdate] = useState(null);

  // 初始化WebSocket连接
  useEffect(() => {
    console.log('Connecting to backend:', BACKEND_URL);
    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      console.log('✅ Connected to backend');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from backend');
      setConnected(false);
    });

    newSocket.on('rankings-update', (newData) => {
      console.log('📊 Received rankings update:', newData);
      setData({
        bsc: newData.bsc || { topByVolume: [], topByTxns: [], totalTokens: 0 },
        solana: newData.solana || { topByVolume: [], topByTxns: [], totalTokens: 0 }
      });
      setLastUpdate(new Date(newData.timestamp));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleRefresh = () => {
    if (socket && connected) {
      socket.emit('request-update');
    }
  };

  const currentData = data[selectedChain];
  const tokens = sortBy === 'volume' ? currentData.topByVolume : currentData.topByTxns;

  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <h1>🚀 Crypto Monitor</h1>
          <p className="subtitle">Real-time Trading Data & Address Monitoring</p>
        </div>

        <nav className="navigation">
          <button
            className={`nav-button ${currentPage === 'rankings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('rankings')}
          >
            📊 Token Rankings
          </button>
          <button
            className={`nav-button ${currentPage === 'monitor' ? 'active' : ''}`}
            onClick={() => setCurrentPage('monitor')}
          >
            📍 Address Monitor
          </button>
          <button
            className={`nav-button ${currentPage === 'swap' ? 'active' : ''}`}
            onClick={() => setCurrentPage('swap')}
          >
            💱 Swap
          </button>
          <button
            className={`nav-button ${currentPage === 'copy-trading' ? 'active' : ''}`}
            onClick={() => setCurrentPage('copy-trading')}
          >
            🤖 Copy Trading
          </button>
        </nav>

        <div className="status-bar">
          <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          {currentPage === 'rankings' && lastUpdate && (
            <div className="last-update">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </header>

      {currentPage === 'rankings' ? (
        <main className="main-content">
          <div className="controls">
            <div className="control-group">
              <label>Chain:</label>
              <div className="button-group">
                <button
                  className={selectedChain === 'bsc' ? 'active' : ''}
                  onClick={() => setSelectedChain('bsc')}
                >
                  BSC
                </button>
                <button
                  className={selectedChain === 'solana' ? 'active' : ''}
                  onClick={() => setSelectedChain('solana')}
                >
                  Solana
                </button>
              </div>
            </div>

            <div className="control-group">
              <label>Sort by:</label>
              <div className="button-group">
                <button
                  className={sortBy === 'volume' ? 'active' : ''}
                  onClick={() => setSortBy('volume')}
                >
                  Volume
                </button>
                <button
                  className={sortBy === 'txns' ? 'active' : ''}
                  onClick={() => setSortBy('txns')}
                >
                  Transactions
                </button>
              </div>
            </div>

            <button className="refresh-button" onClick={handleRefresh} disabled={!connected}>
              🔄 Refresh
            </button>
          </div>

          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-label">Total Tokens Tracked:</span>
              <span className="stat-value">{currentData.totalTokens}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Chain:</span>
              <span className="stat-value">{selectedChain.toUpperCase()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Sort:</span>
              <span className="stat-value">{sortBy === 'volume' ? 'Volume' : 'Transactions'}</span>
            </div>
          </div>

          <TokenList tokens={tokens} sortBy={sortBy} chain={selectedChain} />
        </main>
      ) : currentPage === 'monitor' ? (
        <AddressMonitor socket={socket} connected={connected} />
      ) : currentPage === 'swap' ? (
        <SwapPage />
      ) : (
        <CopyTradingPage />
      )}

      <footer className="footer">
        <p>
          {currentPage === 'rankings'
            ? 'Data provided by DEXScreener API | Updates every 5 seconds'
            : currentPage === 'monitor'
            ? 'Real-time address transaction monitoring'
            : currentPage === 'swap'
            ? 'Swap tokens on BSC via PancakeSwap and Solana via Jupiter'
            : 'Automatically copy trades from successful wallets'}
        </p>
      </footer>
    </div>
  );
}

export default App;
