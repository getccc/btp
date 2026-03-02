import { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Form,
  Slider,
  InputNumber,
  Input,
  Checkbox,
  Button,
  Spin,
  App,
  Typography,
} from 'antd';
import { getSystemConfig, updateSystemConfig } from '../../services/api';

const { Text } = Typography;

/* ── Scoring Weights ─────────────────────────────────── */

const WEIGHT_KEYS = [
  'kol',
  'smart_money',
  'social',
  'onchain',
  'liquidity',
  'price_momentum',
] as const;

function ScoringWeightsCard() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sum, setSum] = useState(0);

  const recalcSum = () => {
    const vals = form.getFieldsValue();
    const total = WEIGHT_KEYS.reduce((s, k) => s + (Number(vals[k]) || 0), 0);
    setSum(parseFloat(total.toFixed(2)));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await getSystemConfig('scoring_weights');
      const v = cfg.value ?? {};
      const fields: Record<string, number> = {};
      for (const k of WEIGHT_KEYS) fields[k] = v[k] ?? 0;
      form.setFieldsValue(fields);
      recalcSum();
    } catch {
      message.error('Failed to load scoring weights');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, message]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      const values = form.getFieldsValue();
      setSaving(true);
      await updateSystemConfig('scoring_weights', values);
      message.success('Scoring weights saved');
    } catch {
      message.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Scoring Weights" className="config-card">
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onValuesChange={recalcSum}>
          <Row gutter={24}>
            {WEIGHT_KEYS.map((k) => (
              <Col span={12} key={k}>
                <Form.Item
                  name={k}
                  label={k.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                >
                  <Slider min={0} max={1} step={0.01} />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Sum: {sum}</Text>
            {sum !== 1 && (
              <Text type="warning" style={{ marginLeft: 12 }}>
                ⚠ Weights should sum to 1.0
              </Text>
            )}
          </div>
          <Button type="primary" loading={saving} onClick={save}>
            Save Weights
          </Button>
        </Form>
      </Spin>
    </Card>
  );
}

/* ── Notification Rules ──────────────────────────────── */

const CHANNEL_OPTIONS = [
  { label: 'Telegram', value: 'telegram' },
  { label: 'Web', value: 'web' },
];

function NotificationRulesCard() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await getSystemConfig('notification_rules');
      const v = cfg.value ?? {};
      form.setFieldsValue({
        min_score: v.min_score ?? 60,
        channels: v.channels ?? ['telegram'],
        cooldown_minutes: v.cooldown_minutes ?? 5,
      });
    } catch {
      message.error('Failed to load notification rules');
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      const values = form.getFieldsValue();
      setSaving(true);
      await updateSystemConfig('notification_rules', values);
      message.success('Notification rules saved');
    } catch {
      message.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Notification Rules" className="config-card">
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="min_score" label="Min Score (0–100)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="channels" label="Channels">
                <Checkbox.Group options={CHANNEL_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cooldown_minutes" label="Cooldown (minutes)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" loading={saving} onClick={save}>
            Save Rules
          </Button>
        </Form>
      </Spin>
    </Card>
  );
}

/* ── Collector Intervals ─────────────────────────────── */

const INTERVAL_KEYS = [
  { key: 'x_kol', label: 'X / KOL' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'onchain_bsc', label: 'On-chain BSC' },
  { key: 'onchain_sol', label: 'On-chain Solana' },
  { key: 'price_quote', label: 'Price Quote' },
] as const;

function CollectorIntervalsCard() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await getSystemConfig('collector_intervals');
      const v = cfg.value ?? {};
      const fields: Record<string, number> = {};
      for (const { key } of INTERVAL_KEYS) fields[key] = v[key] ?? 60;
      form.setFieldsValue(fields);
    } catch {
      message.error('Failed to load collector intervals');
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      const values = form.getFieldsValue();
      setSaving(true);
      await updateSystemConfig('collector_intervals', values);
      message.success('Collector intervals saved');
    } catch {
      message.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Collector Intervals" className="config-card">
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Row gutter={24}>
            {INTERVAL_KEYS.map(({ key, label }) => (
              <Col span={8} key={key}>
                <Form.Item name={key} label={`${label} (seconds)`}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <Button type="primary" loading={saving} onClick={save}>
            Save Intervals
          </Button>
        </Form>
      </Spin>
    </Card>
  );
}

/* ── LLM Config ──────────────────────────────────────── */

function LlmConfigCard() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await getSystemConfig('llm_config');
      const v = cfg.value ?? {};
      form.setFieldsValue({
        model: v.model ?? '',
        batch_interval: v.batch_interval ?? 30,
        max_tokens: v.max_tokens ?? 4096,
      });
    } catch {
      message.error('Failed to load LLM config');
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    try {
      const values = form.getFieldsValue();
      setSaving(true);
      await updateSystemConfig('llm_config', values);
      message.success('LLM config saved');
    } catch {
      message.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="LLM Config" className="config-card">
      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="model" label="Model">
                <Input placeholder="e.g. gpt-4o-mini" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="batch_interval" label="Batch Interval (seconds)">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="max_tokens" label="Max Tokens">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" loading={saving} onClick={save}>
            Save LLM Config
          </Button>
        </Form>
      </Spin>
    </Card>
  );
}

/* ── Page ─────────────────────────────────────────────── */

export default function SystemConfig() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>System Settings</h2>
      </div>
      <ScoringWeightsCard />
      <NotificationRulesCard />
      <CollectorIntervalsCard />
      <LlmConfigCard />
    </div>
  );
}
