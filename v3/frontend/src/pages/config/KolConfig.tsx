import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Slider,
  Switch,
  Space,
  Popconfirm,
  Tag,
  Progress,
  App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { KolConfig as KolType } from '../../services/types';
import { getKols, createKol, updateKol, deleteKol } from '../../services/api';

export default function KolConfig() {
  const { message } = App.useApp();
  const [data, setData] = useState<KolType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KolType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getKols();
      setData(list);
    } catch {
      message.error('Failed to load KOL list');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ reliability: 0.5 });
    setModalOpen(true);
  };

  const openEdit = (record: KolType) => {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      label: record.label,
      reliability: record.reliability,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await updateKol(editing.id, values);
        message.success('KOL updated');
      } else {
        await createKol(values);
        message.success('KOL added');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteKol(id);
      message.success('KOL deleted');
      fetchData();
    } catch {
      message.error('Delete failed');
    }
  };

  const handleToggle = async (record: KolType, checked: boolean) => {
    try {
      await updateKol(record.id, { is_active: checked });
      setData((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, is_active: checked } : r)),
      );
    } catch {
      message.error('Toggle failed');
    }
  };

  const columns: ColumnsType<KolType> = [
    {
      title: 'Username',
      dataIndex: 'username',
      render: (v: string) => (
        <span style={{ fontWeight: 500 }}>@{v.replace(/^@/, '')}</span>
      ),
    },
    {
      title: 'Platform',
      dataIndex: 'platform',
      width: 100,
      render: (v: string) => <Tag color="blue">{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Label',
      dataIndex: 'label',
      render: (v: string | null) =>
        v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Reliability',
      dataIndex: 'reliability',
      width: 160,
      render: (v: number) => {
        const pct = Math.round(v * 100);
        const color = v >= 0.7 ? '#52c41a' : v >= 0.4 ? '#faad14' : '#ff4d4f';
        return <Progress percent={pct} size="small" strokeColor={color} />;
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean, record) => (
        <Switch size="small" checked={v} onChange={(c) => handleToggle(record, c)} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title="Delete this KOL?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>KOL Watchlist</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add KOL
        </Button>
      </div>

      <Table
        rowKey="id"
        dataSource={data}
        columns={columns}
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      <Modal
        title={editing ? 'Edit KOL' : 'Add KOL'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Username is required' }]}
          >
            <Input placeholder="@handle" />
          </Form.Item>
          <Form.Item name="label" label="Label">
            <Input placeholder="e.g. Alpha Caller, Analyst" />
          </Form.Item>
          <Form.Item name="reliability" label="Reliability" initialValue={0.5}>
            <Slider min={0} max={1} step={0.1} marks={{ 0: '0', 0.5: '0.5', 1: '1.0' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
