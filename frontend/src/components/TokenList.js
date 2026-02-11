import React from 'react';
import './TokenList.css';

function TokenList({ tokens, sortBy, chain }) {
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  const formatCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count;
  };

  if (!tokens || tokens.length === 0) {
    return (
      <div className="token-list-container">
        <div className="empty-state">
          <div className="loader"></div>
          <p>Loading token data...</p>
          <p className="hint">Fetching data from {chain.toUpperCase()} chain</p>
        </div>
      </div>
    );
  }

  return (
    <div className="token-list-container">
      <div className="token-list-header">
        <h2>🏆 Top 10 Tokens by {sortBy === 'volume' ? 'Volume' : 'Transactions'}</h2>
      </div>

      <div className="token-list">
        {tokens.map((token, index) => (
          <div key={token.address} className="token-card">
            <div className="token-rank">#{index + 1}</div>

            <div className="token-info">
              <div className="token-header">
                <h3 className="token-symbol">{token.symbol}</h3>
                <span className="token-name">{token.name}</span>
              </div>

              <div className="token-address">
                {token.address.slice(0, 6)}...{token.address.slice(-4)}
              </div>

              {token.dexId && (
                <div className="token-dex">
                  DEX: {token.dexId}
                </div>
              )}
            </div>

            <div className="token-stats">
              <div className="stat">
                <span className="stat-label">Volume (30min)</span>
                <span className="stat-value highlight-volume">
                  {formatNumber(token.volume)}
                </span>
              </div>

              <div className="stat">
                <span className="stat-label">Transactions</span>
                <span className="stat-value highlight-txn">
                  {formatCount(token.txnCount)}
                </span>
              </div>

              {token.priceUsd > 0 && (
                <div className="stat">
                  <span className="stat-label">Price</span>
                  <span className="stat-value">
                    {token.priceUsd < 0.01
                      ? `$${token.priceUsd.toFixed(8)}`
                      : formatNumber(token.priceUsd)
                    }
                  </span>
                </div>
              )}

              {token.priceChange !== undefined && (
                <div className="stat">
                  <span className="stat-label">24h Change</span>
                  <span className={`stat-value ${token.priceChange >= 0 ? 'positive' : 'negative'}`}>
                    {token.priceChange >= 0 ? '+' : ''}{token.priceChange.toFixed(2)}%
                  </span>
                </div>
              )}

              {token.liquidity > 0 && (
                <div className="stat">
                  <span className="stat-label">Liquidity</span>
                  <span className="stat-value">
                    {formatNumber(token.liquidity)}
                  </span>
                </div>
              )}
            </div>

            {token.url && (
              <div className="token-actions">
                <a
                  href={token.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-button"
                >
                  View on DEXScreener →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TokenList;
