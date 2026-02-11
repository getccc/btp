import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './PriceChart.css';

function PriceChart({ fromToken, toToken, chain }) {
  const [priceData, setPriceData] = useState([]);
  const [timeRange, setTimeRange] = useState('1H'); // 1H, 4H, 24H, 7D
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const canvasRef = useRef(null);

  // 获取价格数据
  useEffect(() => {
    if (!fromToken || !toToken) return;

    const fetchPriceData = async () => {
      try {
        // 这里使用模拟数据，实际应该调用真实的价格API
        // 对于BSC可以使用DexScreener API
        // 对于Solana可以使用Jupiter Price API
        const mockData = generateMockPriceData(timeRange);
        setPriceData(mockData);

        if (mockData.length > 0) {
          const latest = mockData[mockData.length - 1];
          const first = mockData[0];
          setCurrentPrice(latest.price);
          setPriceChange(((latest.price - first.price) / first.price) * 100);
        }
      } catch (error) {
        console.error('Error fetching price data:', error);
      }
    };

    fetchPriceData();

    // 每30秒更新一次
    const interval = setInterval(fetchPriceData, 30000);
    return () => clearInterval(interval);
  }, [fromToken, toToken, timeRange, chain]);

  // 绘制图表
  useEffect(() => {
    if (!canvasRef.current || priceData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 计算价格范围
    const prices = priceData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // 绘制网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 绘制价格线
    ctx.strokeStyle = priceChange >= 0 ? '#4ade80' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();

    priceData.forEach((data, index) => {
      const x = (width / (priceData.length - 1)) * index;
      const y = height - ((data.price - minPrice) / priceRange) * (height - 20) - 10;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // 绘制填充区域
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, priceChange >= 0 ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

  }, [priceData, priceChange]);

  // 生成模拟价格数据
  function generateMockPriceData(range) {
    const dataPoints = {
      '1H': 12,   // 5分钟间隔
      '4H': 24,   // 10分钟间隔
      '24H': 48,  // 30分钟间隔
      '7D': 168   // 1小时间隔
    };

    const points = dataPoints[range] || 24;
    const data = [];
    let basePrice = 100;

    for (let i = 0; i < points; i++) {
      // 随机波动
      const change = (Math.random() - 0.5) * 2;
      basePrice += change;
      data.push({
        time: Date.now() - (points - i) * 60000,
        price: Math.max(0.1, basePrice)
      });
    }

    return data;
  }

  if (!fromToken || !toToken) {
    return null;
  }

  return (
    <div className="price-chart-container">
      <div className="chart-header">
        <div className="chart-info">
          <h4 className="pair-name">
            {fromToken.symbol}/{toToken.symbol}
          </h4>
          {currentPrice && (
            <div className="price-info">
              <span className="current-price">
                {currentPrice.toFixed(6)}
              </span>
              {priceChange !== null && (
                <span className={`price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="time-range-selector">
          {['1H', '4H', '24H', '7D'].map(range => (
            <button
              key={range}
              className={`range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="price-canvas"
        />
      </div>

      <div className="chart-footer">
        <span className="chart-note">
          ℹ️ Price data updates every 30 seconds
        </span>
      </div>
    </div>
  );
}

export default PriceChart;
