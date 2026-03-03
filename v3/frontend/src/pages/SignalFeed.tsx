import { useState, useEffect, useCallback } from 'react';
import { Tabs, Table, Card, Typography, Tag, Space, Spin, Empty } from 'antd';
import {
  MessageOutlined,
  SwapOutlined,
  UserOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getTweets, getOnchainEvents } from '../services/api';
import type { KolTweet, OnchainEvent } from '../services/types';
import { wsService } from '../services/ws';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;

/* ── Tweets Tab ─────────────────────────────────────── */

function TweetList({ tweets, loading }: { tweets: KolTweet[]; loading: boolean }) {
  if (loading && tweets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (tweets.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No tweets collected yet" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tweets.map((tweet) => {
        const time = dayjs(tweet.tweet_time);
        return (
          <Card
            key={tweet.id}
            size="small"
            style={{
              borderRadius: 8,
              border: '1px solid #f0f0f0',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            hoverable
            styles={{ body: { padding: '14px 18px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {tweet.username.charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Space size={4}>
                    <UserOutlined style={{ fontSize: 12, color: '#1677ff' }} />
                    <Text strong style={{ fontSize: 13 }}>@{tweet.username}</Text>
                  </Space>
                  {tweet.is_analyzed && (
                    <Tag
                      icon={<CheckCircleOutlined />}
                      color="processing"
                      style={{ fontSize: 11, lineHeight: '18px', margin: 0 }}
                    >
                      Analyzed
                    </Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {time.fromNow()}
                  </Text>
                </div>

                <Paragraph
                  style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#262626' }}
                  ellipsis={{ rows: 3, expandable: 'collapsible' }}
                >
                  {tweet.content}
                </Paragraph>

                {tweet.tweet_id && (
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={`https://x.com/i/status/${tweet.tweet_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      <LinkOutlined style={{ marginRight: 4 }} />
                      View on X
                    </a>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Onchain Tab ────────────────────────────────────── */

const CHAIN_TAG: Record<string, { color: string; className?: string }> = {
  bsc: { color: 'gold', className: 'chain-bsc' },
  solana: { color: 'purple', className: 'chain-solana' },
};

function OnchainTable({ events, loading }: { events: OnchainEvent[]; loading: boolean }) {
  const columns: ColumnsType<OnchainEvent> = [
    {
      title: 'Chain',
      dataIndex: 'chain',
      key: 'chain',
      width: 100,
      render: (chain: string) => {
        const cfg = CHAIN_TAG[chain.toLowerCase()] ?? { color: 'default' };
        return (
          <Tag color={cfg.color} className={cfg.className} style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 11 }}>
            {chain}
          </Tag>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 120,
      render: (type: string) => (
        <Tag style={{ borderRadius: 4, fontSize: 12 }}>{type}</Tag>
      ),
    },
    {
      title: 'Wallet',
      dataIndex: 'wallet_address',
      key: 'wallet_address',
      width: 180,
      ellipsis: true,
      render: (addr: string) => (
        <Text className="address-mono" copyable={{ text: addr }}>
          {addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '–'}
        </Text>
      ),
    },
    {
      title: 'From',
      key: 'from',
      width: 160,
      render: (_: unknown, record: OnchainEvent) => (
        <Space size={4}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>
            {record.from_amount ? Number(record.from_amount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '–'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.from_token || '–'}</Text>
        </Space>
      ),
    },
    {
      title: '',
      key: 'arrow',
      width: 40,
      render: () => <SwapOutlined style={{ color: '#8c8c8c' }} />,
    },
    {
      title: 'To',
      key: 'to',
      width: 160,
      render: (_: unknown, record: OnchainEvent) => (
        <Space size={4}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>
            {record.to_amount ? Number(record.to_amount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '–'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.to_token || '–'}</Text>
        </Space>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'event_time',
      key: 'event_time',
      width: 150,
      render: (time: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {time ? dayjs(time).fromNow() : '–'}
        </Text>
      ),
      defaultSortOrder: 'descend',
      sorter: (a: OnchainEvent, b: OnchainEvent) => dayjs(a.event_time).unix() - dayjs(b.event_time).unix(),
    },
  ];

  return (
    <Table<OnchainEvent>
      columns={columns}
      dataSource={events}
      rowKey="id"
      loading={loading && events.length === 0}
      size="small"
      pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `${total} events` }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No onchain events collected yet" /> }}
    />
  );
}

/* ── Main Page ──────────────────────────────────────── */

export default function SignalFeed() {
  const [tweets, setTweets] = useState<KolTweet[]>([]);
  const [events, setEvents] = useState<OnchainEvent[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [activeTab, setActiveTab] = useState('tweets');

  const fetchTweets = useCallback(async () => {
    try {
      const data = await getTweets();
      setTweets(data);
    } catch {
      // silently retry on next interval
    } finally {
      setLoadingTweets(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await getOnchainEvents();
      setEvents(data);
    } catch {
      // silently retry on next interval
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchTweets();
    fetchEvents();
    const interval = setInterval(() => {
      fetchTweets();
      fetchEvents();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchTweets, fetchEvents]);

  // Listen to real-time WS events
  useEffect(() => {
    const offTweet = wsService.on('new_tweet', (data: KolTweet) => {
      setTweets((prev) => [data, ...prev]);
      setLoadingTweets(false);
    });
    const offOnchain = wsService.on('new_onchain', (data: OnchainEvent) => {
      setEvents((prev) => [data, ...prev]);
      setLoadingEvents(false);
    });
    return () => {
      offTweet();
      offOnchain();
    };
  }, []);

  const tabItems = [
    {
      key: 'tweets',
      label: (
        <span>
          <MessageOutlined style={{ marginRight: 6 }} />
          KOL Tweets
          {tweets.length > 0 && (
            <Tag style={{ marginLeft: 8, borderRadius: 10, fontSize: 11 }}>{tweets.length}</Tag>
          )}
        </span>
      ),
      children: <TweetList tweets={tweets} loading={loadingTweets} />,
    },
    {
      key: 'onchain',
      label: (
        <span>
          <SwapOutlined style={{ marginRight: 6 }} />
          Onchain Events
          {events.length > 0 && (
            <Tag style={{ marginLeft: 8, borderRadius: 10, fontSize: 11 }}>{events.length}</Tag>
          )}
        </span>
      ),
      children: <OnchainTable events={events} loading={loadingEvents} />,
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Signal Feed</h2>
        <Text type="secondary" style={{ fontSize: 13 }}>Auto-refreshes every 10s</Text>
      </div>

      <Card styles={{ body: { padding: '8px 16px 16px' } }} style={{ borderRadius: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="middle"
        />
      </Card>
    </div>
  );
}
