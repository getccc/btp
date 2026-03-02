import { useState, useEffect, useCallback } from 'react'
import { Row, Col, Card, Statistic, Typography, Space, Tag, Spin } from 'antd'
import {
  DashboardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { getHealth, getCollectors } from '../services/api'
import type { HealthResponse, CollectorStatus } from '../services/types'

dayjs.extend(relativeTime)

const { Text } = Typography

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  running: {
    color: '#389e0d',
    bg: 'rgba(56, 158, 13, 0.08)',
    border: 'rgba(56, 158, 13, 0.25)',
    icon: <SyncOutlined spin style={{ color: '#389e0d' }} />,
    label: 'Running',
  },
  idle: {
    color: '#d48806',
    bg: 'rgba(212, 136, 6, 0.08)',
    border: 'rgba(212, 136, 6, 0.25)',
    icon: <ClockCircleOutlined style={{ color: '#d48806' }} />,
    label: 'Idle',
  },
  error: {
    color: '#cf1322',
    bg: 'rgba(207, 19, 34, 0.08)',
    border: 'rgba(207, 19, 34, 0.25)',
    icon: <WarningOutlined style={{ color: '#cf1322' }} />,
    label: 'Error',
  },
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.idle
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [collectors, setCollectors] = useState<CollectorStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [h, c] = await Promise.allSettled([getHealth(), getCollectors()])
      if (h.status === 'fulfilled') {
        setHealth(h.value)
        setError(false)
      } else {
        setError(true)
      }
      if (c.status === 'fulfilled') {
        setCollectors(c.value)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const runningCount = collectors.filter((c) => c.status === 'running').length
  const totalCount = collectors.length

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Dashboard</h2>
        {health ? (
          <Space>
            <Tag icon={<CheckCircleOutlined />} color="success">
              Backend {health.status}
            </Tag>
            <Tag color={health.db === 'connected' ? 'green' : 'red'}>
              DB: {health.db}
            </Tag>
            <Tag color={health.redis === 'connected' ? 'green' : 'red'}>
              Redis: {health.redis}
            </Tag>
          </Space>
        ) : error ? (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Backend Offline
          </Tag>
        ) : null}
      </div>

      {/* Summary stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="Collectors Active"
              value={runningCount}
              suffix={`/ ${totalCount || '–'}`}
              prefix={<DashboardOutlined />}
              valueStyle={{ color: runningCount > 0 ? '#389e0d' : '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="System Status"
              value={health ? 'Online' : 'Offline'}
              prefix={health ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              valueStyle={{ color: health ? '#389e0d' : '#cf1322', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="Last Refresh"
              value={health ? dayjs(health.timestamp).format('HH:mm:ss') : '–'}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#595959', fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Collector grid */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 15 }}>Collector Status</Text>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>Auto-refreshes every 5s</Text>
      </div>

      {loading && collectors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : collectors.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
            <DashboardOutlined style={{ fontSize: 36, marginBottom: 12, display: 'block', opacity: 0.4 }} />
            <Text type="secondary">No collectors registered yet</Text>
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {collectors.map((collector) => {
            const cfg = getStatusConfig(collector.status)
            const lastRun = collector.last_run ? dayjs(collector.last_run) : null
            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={collector.name}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${cfg.border}`,
                    background: cfg.bg,
                    transition: 'all 0.3s ease',
                  }}
                  styles={{ body: { padding: '16px 20px' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text strong style={{ fontSize: 14 }}>{collector.name}</Text>
                    {cfg.icon}
                  </div>

                  <Tag
                    color={cfg.color}
                    style={{
                      borderRadius: 4,
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {cfg.label}
                  </Tag>

                  {collector.error && collector.status === 'error' && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="danger" style={{ fontSize: 12 }} ellipsis={{ tooltip: collector.error }}>
                        {collector.error}
                      </Text>
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {lastRun ? `Last run ${lastRun.fromNow()}` : 'Never run'}
                    </Text>
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </div>
  )
}
