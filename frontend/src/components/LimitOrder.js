import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './LimitOrder.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
let socket = null;

function LimitOrder({ fromToken, toToken, chain, userAddress }) {
  const [orderType, setOrderType] = useState('limit'); // 'limit' or 'stop'
  const [buyAmount, setBuyAmount] = useState('');
  const [price, setPrice] = useState('');
  const [expiryTime, setExpiryTime] = useState('24'); // hours
  const [slippage, setSlippage] = useState('0.5');
  const [orders, setOrders] = useState([]);
  const [pendingExecutions, setPendingExecutions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

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

      // 监听订单事件
      socket.on('order-created', (order) => {
        console.log('Order created:', order);
        loadUserOrders();
      });

      socket.on('order-cancelled', (order) => {
        console.log('Order cancelled:', order);
        loadUserOrders();
      });

      socket.on('order-updated', (order) => {
        console.log('Order updated:', order);
        loadUserOrders();
      });

      // 监听执行事件
      socket.on('execution-ready', (execution) => {
        console.log('Execution ready:', execution);
        setPendingExecutions(prev => [...prev, execution]);
        alert(`🎯 Price target reached for your ${execution.order.fromToken.symbol}/${execution.order.toToken.symbol} order!\nClick to confirm execution.`);
      });

      socket.on('execution-confirmed', (execution) => {
        console.log('Execution confirmed:', execution);
        setPendingExecutions(prev => prev.filter(e => e.orderId !== execution.orderId));
        loadUserOrders();
      });

      socket.on('execution-failed', (execution) => {
        console.log('Execution failed:', execution);
        setPendingExecutions(prev => prev.filter(e => e.orderId !== execution.orderId));
        alert(`❌ Execution failed: ${execution.error}`);
      });

      socket.on('order-error', (data) => {
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

  // 加载用户订单
  useEffect(() => {
    if (userAddress && chain && isConnected) {
      loadUserOrders();
    }
  }, [userAddress, chain, isConnected]);

  const loadUserOrders = async () => {
    if (!userAddress || !chain) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/limit-orders/user/${userAddress}?chain=${chain}`);
      const data = await response.json();

      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const handleCreateOrder = () => {
    if (!buyAmount || !price) {
      alert('Please fill in all fields');
      return;
    }

    if (!userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    const orderData = {
      userAddress,
      chain,
      fromToken: {
        symbol: fromToken.symbol,
        address: fromToken.address,
        decimals: fromToken.decimals
      },
      toToken: {
        symbol: toToken.symbol,
        address: toToken.address,
        decimals: toToken.decimals
      },
      fromAmount: parseFloat(buyAmount) * parseFloat(price), // Total amount to spend
      targetPrice: parseFloat(price),
      slippage: parseFloat(slippage),
      orderType: orderType,
      expiryTime: Date.now() + parseInt(expiryTime) * 3600000
    };

    socket.emit('create-limit-order', orderData);
    setBuyAmount('');
    setPrice('');
  };

  const handleCancelOrder = (orderId) => {
    socket.emit('cancel-limit-order', { orderId });
  };

  const handleConfirmExecution = (execution, txHash) => {
    if (!txHash) {
      txHash = prompt('Please enter the transaction hash:');
      if (!txHash) return;
    }

    socket.emit('confirm-execution', { orderId: execution.orderId, txHash });
  };

  const handleCancelExecution = (execution) => {
    socket.emit('cancel-execution', { orderId: execution.orderId });
    setPendingExecutions(prev => prev.filter(e => e.orderId !== execution.orderId));
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!fromToken || !toToken) {
    return null;
  }

  return (
    <div className="limit-order-container">
      <div className="limit-order-header">
        <h3>📋 Limit Orders {isConnected ? '🟢' : '🔴'}</h3>
        <p className="warning-note">
          {isConnected
            ? '✅ Connected to backend - Full functionality enabled'
            : '⚠️ Connecting to backend...'}
        </p>
      </div>

      {/* 待执行订单提示 */}
      {pendingExecutions.length > 0 && (
        <div className="pending-executions">
          <h4>⏳ Pending Executions</h4>
          {pendingExecutions.map(execution => (
            <div key={execution.orderId} className="execution-item">
              <div className="execution-info">
                <div className="execution-pair">
                  🎯 {execution.order.fromToken.symbol} → {execution.order.toToken.symbol}
                </div>
                <div className="execution-details">
                  <span>Target Price: {execution.order.targetPrice}</span>
                  <span>Current Price: {execution.currentPrice.toFixed(6)}</span>
                  <span>Expected Output: {execution.expectedOutput.toFixed(6)} {execution.order.toToken.symbol}</span>
                </div>
              </div>
              <div className="execution-actions">
                <button
                  className="confirm-exec-btn"
                  onClick={() => handleConfirmExecution(execution)}
                >
                  Confirm & Execute
                </button>
                <button
                  className="cancel-exec-btn"
                  onClick={() => handleCancelExecution(execution)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="order-form">
        <div className="order-type-selector">
          <button
            className={`type-btn ${orderType === 'limit' ? 'active' : ''}`}
            onClick={() => setOrderType('limit')}
          >
            Limit Order
          </button>
          <button
            className={`type-btn ${orderType === 'stop' ? 'active' : ''}`}
            onClick={() => setOrderType('stop')}
            disabled
          >
            Stop Loss (Coming Soon)
          </button>
        </div>

        <div className="form-group">
          <label>
            Buy {toToken.symbol}
          </label>
          <input
            type="number"
            placeholder="0.0"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>
            At Price ({fromToken.symbol}/{toToken.symbol})
          </label>
          <input
            type="number"
            placeholder="0.0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        {buyAmount && price && (
          <div className="total-display">
            Total: {(parseFloat(buyAmount) * parseFloat(price)).toFixed(6)} {fromToken.symbol}
          </div>
        )}

        <div className="form-group">
          <label>Slippage Tolerance (%)</label>
          <input
            type="number"
            placeholder="0.5"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Expires In</label>
          <select value={expiryTime} onChange={(e) => setExpiryTime(e.target.value)}>
            <option value="1">1 Hour</option>
            <option value="4">4 Hours</option>
            <option value="24">24 Hours</option>
            <option value="168">7 Days</option>
            <option value="720">30 Days</option>
          </select>
        </div>

        <button
          className="create-order-btn"
          onClick={handleCreateOrder}
          disabled={!isConnected || !userAddress}
        >
          {!userAddress
            ? 'Connect Wallet'
            : !isConnected
            ? 'Connecting...'
            : `Create ${orderType === 'limit' ? 'Limit' : 'Stop'} Order`}
        </button>
      </div>

      {orders.length > 0 && (
        <div className="active-orders">
          <h4>Active Orders</h4>
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.orderId} className="order-item">
                <div className="order-info">
                  <div className="order-pair">
                    {order.fromToken.symbol} → {order.toToken.symbol}
                  </div>
                  <div className="order-details">
                    <span>Target Price: {order.targetPrice}</span>
                    <span>Amount: {order.fromAmount} {order.fromToken.symbol}</span>
                    <span>Type: {order.orderType}</span>
                  </div>
                  <div className="order-meta">
                    <span className={`status ${order.status}`}>{order.status}</span>
                    <span className="expiry">Expires: {formatTime(order.expiryTime)}</span>
                    {order.attempts > 0 && (
                      <span className="attempts">Attempts: {order.attempts}/{order.maxAttempts}</span>
                    )}
                  </div>
                </div>
                {order.status === 'active' && (
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancelOrder(order.orderId)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LimitOrder;
