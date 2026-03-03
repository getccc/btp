import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Tag, Tabs, Spin, Empty, Button, Space } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  LineChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import { getTokenScores } from '../services/api';
import type { OpportunityScore } from '../services/types';

const { Title, Text, Paragraph } = Typography;

/* ── Direction config ─────────────────────────────────── */

const DIRECTION_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  bullish: { color: 'green', icon: <ArrowUpOutlined />, label: 'Bullish' },
  bearish: { color: 'red', icon: <ArrowDownOutlined />, label: 'Bearish' },
  neutral: { color: 'default', icon: <MinusOutlined />, label: 'Neutral' },
};

const CHAIN_TAG: Record<string, { color: string; className?: string }> = {
  bsc: { color: 'gold', className: 'chain-bsc' },
  solana: { color: 'purple', className: 'chain-solana' },
};

/* ── Page ─────────────────────────────────────────────── */

export default function TokenDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [scores, setScores] = useState<OpportunityScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!symbol) return;
    try {
      const data = await getTokenScores(symbol);
      setScores(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const latest = scores.length > 0 ? scores[0] : null;

  /* Chart data — reverse for chronological order */
  const chartData = [...scores].reverse().map((s) => ({
    time: dayjs(s.scored_at).format('MM/DD HH:mm'),
    score: s.total_score,
  }));

  /* Find latest reasoning */
  const reasoning = scores.find((s) => s.reasoning)?.reasoning ?? null;

  /* ── Loading state ──────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  /* ── Empty state ────────────────────────────────────── */

  if (!latest) {
    return (
      <div className="page-container">
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate('/opportunities')}
          style={{ marginBottom: 16 }}
        >
          Back to Opportunities
        </Button>
        <Empty description={`No score data for ${symbol ?? 'unknown token'}`} />
      </div>
    );
  }

  const dirCfg = DIRECTION_CONFIG[latest.direction?.toLowerCase()] ?? DIRECTION_CONFIG.neutral;
  const chainCfg = CHAIN_TAG[latest.chain?.toLowerCase()] ?? { color: 'default' };
  const scoreColor = latest.total_score >= 70 ? '#389e0d' : latest.total_score >= 40 ? '#d48806' : '#8c8c8c';

  /* ── Tab items ──────────────────────────────────────── */

  const tabItems = [
    {
      key: 'history',
      label: (
        <span>
          <LineChartOutlined style={{ marginRight: 6 }} />
          Score History
        </span>
      ),
      children:
        chartData.length > 1 ? (
          <div style={{ padding: '16px 0' }}>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12, fill: '#8c8c8c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#f0f0f0' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#8c8c8c' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    fontSize: 13,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#1677ff"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#1677ff', strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: '#1677ff', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Not enough data points for a chart"
            style={{ padding: '60px 0' }}
          />
        ),
    },
    {
      key: 'reasoning',
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 6 }} />
          Reasoning
        </span>
      ),
      children: reasoning ? (
        <div
          style={{
            padding: '20px 24px',
            background: '#fafafa',
            borderRadius: 6,
            border: '1px solid #f0f0f0',
            marginTop: 8,
          }}
        >
          <Paragraph style={{ margin: 0, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {reasoning}
          </Paragraph>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No reasoning data available"
          style={{ padding: '60px 0' }}
        />
      ),
    },
  ];

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="page-container">
      <Button
        icon={<ArrowLeftOutlined />}
        type="text"
        onClick={() => navigate('/opportunities')}
        style={{ marginBottom: 16 }}
      >
        Back to Opportunities
      </Button>

      {/* Token Header */}
      <Card style={{ borderRadius: 8, marginBottom: 24 }} styles={{ body: { padding: '20px 24px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {symbol?.charAt(0).toUpperCase()}
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>{symbol}</Title>
            <Space size={8} style={{ marginTop: 6 }}>
              <Text strong style={{ fontSize: 22, color: scoreColor }}>{latest.total_score}</Text>
              <Tag
                icon={dirCfg.icon}
                color={dirCfg.color}
                style={{ borderRadius: 4, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}
              >
                {dirCfg.label}
              </Tag>
              {latest.chain && (
                <Tag
                  color={chainCfg.color}
                  className={chainCfg.className}
                  style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 11 }}
                >
                  {latest.chain}
                </Tag>
              )}
              {latest.regime && (
                <Tag style={{ borderRadius: 4, fontSize: 12 }}>{latest.regime}</Tag>
              )}
            </Space>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card styles={{ body: { padding: '8px 16px 16px' } }} style={{ borderRadius: 8 }}>
        <Tabs items={tabItems} size="middle" />
      </Card>
    </div>
  );
}
