import { useState, useEffect, useCallback } from 'react';
import { Table, Typography, Tag, Card, Empty } from 'antd';
import {
  AimOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';
import { getScores } from '../services/api';
import type { OpportunityScore } from '../services/types';

dayjs.extend(relativeTime);

const { Text } = Typography;

/* ── Direction tag presets ────────────────────────────── */

const DIRECTION_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  bullish: { color: 'green', icon: <ArrowUpOutlined /> },
  bearish: { color: 'red', icon: <ArrowDownOutlined /> },
  neutral: { color: 'default', icon: <MinusOutlined /> },
};

/* ── Chain tag presets (matches SignalFeed) ───────────── */

const CHAIN_TAG: Record<string, { color: string; className?: string }> = {
  bsc: { color: 'gold', className: 'chain-bsc' },
  solana: { color: 'purple', className: 'chain-solana' },
};

/* ── Page ─────────────────────────────────────────────── */

export default function OpportunityList() {
  const [scores, setScores] = useState<OpportunityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchScores = useCallback(async () => {
    try {
      const data = await getScores();
      setScores(data);
    } catch {
      // silently retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 30000);
    return () => clearInterval(interval);
  }, [fetchScores]);

  const columns: ColumnsType<OpportunityScore> = [
    {
      title: '#',
      key: 'rank',
      width: 56,
      render: (_: unknown, __: OpportunityScore, index: number) => (
        <Text strong style={{ fontSize: 13, color: index < 3 ? '#1677ff' : '#8c8c8c' }}>
          {index + 1}
        </Text>
      ),
    },
    {
      title: 'Token',
      dataIndex: 'token_symbol',
      key: 'token_symbol',
      width: 120,
      render: (symbol: string) => (
        <Text strong style={{ fontSize: 13 }}>{symbol}</Text>
      ),
    },
    {
      title: 'Chain',
      dataIndex: 'chain',
      key: 'chain',
      width: 100,
      render: (chain: string) => {
        const cfg = CHAIN_TAG[chain?.toLowerCase()] ?? { color: 'default' };
        return (
          <Tag
            color={cfg.color}
            className={cfg.className}
            style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 11 }}
          >
            {chain}
          </Tag>
        );
      },
    },
    {
      title: 'Total Score',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 140,
      sorter: (a, b) => a.total_score - b.total_score,
      defaultSortOrder: 'descend',
      render: (score: number) => {
        const pct = Math.min(Math.abs(score), 100);
        const color = score >= 70 ? '#389e0d' : score >= 40 ? '#d48806' : '#8c8c8c';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong style={{ fontSize: 14, color, minWidth: 32 }}>{score}</Text>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#f0f0f0', maxWidth: 60 }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      },
    },
    {
      title: 'Direction',
      dataIndex: 'direction',
      key: 'direction',
      width: 110,
      filters: [
        { text: 'Bullish', value: 'bullish' },
        { text: 'Bearish', value: 'bearish' },
        { text: 'Neutral', value: 'neutral' },
      ],
      onFilter: (value, record) => record.direction?.toLowerCase() === value,
      render: (direction: string) => {
        const cfg = DIRECTION_CONFIG[direction?.toLowerCase()] ?? DIRECTION_CONFIG.neutral;
        return (
          <Tag
            icon={cfg.icon}
            color={cfg.color}
            style={{ borderRadius: 4, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}
          >
            {direction}
          </Tag>
        );
      },
    },
    {
      title: 'Regime',
      dataIndex: 'regime',
      key: 'regime',
      width: 120,
      render: (regime: string) => (
        <Tag style={{ borderRadius: 4, fontSize: 12 }}>{regime || '–'}</Tag>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'scored_at',
      key: 'scored_at',
      width: 150,
      sorter: (a, b) => dayjs(a.scored_at).unix() - dayjs(b.scored_at).unix(),
      render: (time: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {time ? dayjs(time).fromNow() : '–'}
        </Text>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Opportunities</h2>
        <Text type="secondary" style={{ fontSize: 13 }}>Auto-refreshes every 30s</Text>
      </div>

      <Card styles={{ body: { padding: '8px 0' } }} style={{ borderRadius: 8 }}>
        <Table<OpportunityScore>
          columns={columns}
          dataSource={scores}
          rowKey="id"
          loading={loading && scores.length === 0}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} opportunities` }}
          onRow={(record) => ({
            onClick: () => navigate(`/token/${record.token_symbol}`),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <Empty
                image={<AimOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />}
                description="No scored opportunities yet"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}
