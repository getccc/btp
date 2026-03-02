import { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Typography, Space, Tag, Result } from 'antd'
import {
  DashboardOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { getHealth } from '../services/api'
import type { HealthResponse } from '../services/types'

const { Text } = Typography

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    getHealth()
      .then((data) => mounted && setHealth(data))
      .catch(() => mounted && setError(true))
    return () => { mounted = false }
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Dashboard</h2>
        {health ? (
          <Space>
            <Tag
              icon={<CheckCircleOutlined />}
              color="success"
            >
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

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="Collectors Active"
              value={0}
              suffix="/ 5"
              prefix={<DashboardOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="Signals Today"
              value={0}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic
              title="Analysis Runs"
              value={0}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Result
          status="info"
          title="Dashboard — Coming in Phase 2"
          subTitle="Real-time signal feed, scoring charts, and collector status will appear here."
          extra={
            <Text type="secondary">
              Configure your KOLs, wallets, and Telegram groups in the Config section to get started.
            </Text>
          }
        />
      </Card>
    </div>
  )
}
