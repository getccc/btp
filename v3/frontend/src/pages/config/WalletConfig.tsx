import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Slider,
  Switch,
  Space,
  Popconfirm,
  Tag,
  Tooltip,
  App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { WalletConfig as WalletType } from '../../services/types';
import { getWallets, createWallet, updateWallet, deleteWallet } from '../../services/api';

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const CHAIN_COLORS: Record<string, string> = {
  bsc: '#F0B90B',
  solana: '#9945FF',
};

const TYPE_COLORS: Record<string, string> = {
  smart_money: 'green',
  whale: 'blue',
  insider: 'red',
};

export default function WalletConfig() {
  const { message } = App.useApp();
  const [data, setData] = useState<WalletType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WalletType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getWallets();
      setData(list);
    } catch {
      message.error('Failed to load wallets');
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
    form.setFieldsValue({ chain: 'bsc', wallet_type: 'smart_money', reliability: 0.5 });
    setModalOpen(true);
  };

  const openEdit = (record: WalletType) => {
    setEditing(record);
    form.setFieldsValue({
      address: record.address,
      chain: record.chain,
      label: record.label,
      wallet_type: record.wallet_type,
      reliability: record.reliability,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await updateWallet(editing.id, values);
        message.success('Wallet updated');
      } else {
        await createWallet(values);
        message.success('Wallet added');
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
      await deleteWallet(id);
      message.success('Wallet deleted');
      fetchData();
    } catch {
      message.error('Delete failed');
    }
  };

  const handleToggle = async (record: WalletType, checked: boolean) => {
    try {
      await updateWallet(record.id, { is_active: checked });
      setData((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, is_active: checked } : r)),
      );
    } catch {
      message.error('Toggle failed');
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    message.success('Address copied');
  };

  const columns: ColumnsType<WalletType> = [
    {
      title: 'Address',
      dataIndex: 'address',
      render: (v: string) => (
        <Space size={4}>
          <Tooltip title={v}>
            <span className="address-mono">{truncateAddress(v)}</span>
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyAddress(v)}
            style={{ color: '#8c8c8c' }}
          />
        </Space>
      ),
    },
    {
      title: 'Chain',
      dataIndex: 'chain',
      width: 100,
      render: (v: string) => (
        <Tag color={CHAIN_COLORS[v] || 'default'}>{v.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Label',
      dataIndex: 'label',
      render: (v: string | null) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Type',
      dataIndex: 'wallet_type',
      width: 120,
      render: (v: string) => (
        <Tag color={TYPE_COLORS[v] || 'default'}>{v.replace('_', ' ')}</Tag>
      ),
    },
    {
      title: 'Reliability',
      dataIndex: 'reliability',
      width: 100,
      render: (v: number) => {
        const color = v >= 0.7 ? '#52c41a' : v >= 0.4 ? '#faad14' : '#ff4d4f';
        return <span style={{ color, fontWeight: 600 }}>{v.toFixed(1)}</span>;
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
            title="Delete this wallet?"
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

  const validateAddress = (_: any, value: string) => {
    const chain = form.getFieldValue('chain');
    if (!value) return Promise.reject('Address is required');
    if (chain === 'bsc') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return Promise.reject('BSC address must start with 0x and be 42 chars');
      }
    } else if (chain === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
        return Promise.reject('Invalid Solana address (base58, 32-44 chars)');
      }
    }
    return Promise.resolve();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Smart Money Wallets</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Wallet
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
        title={editing ? 'Edit Wallet' : 'Add Wallet'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="address"
            label="Address"
            rules={[{ validator: validateAddress }]}
          >
            <Input placeholder="0x... or Solana address" className="address-mono" />
          </Form.Item>
          <Form.Item name="chain" label="Chain" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'BSC', value: 'bsc' },
                { label: 'Solana', value: 'solana' },
              ]}
            />
          </Form.Item>
          <Form.Item name="label" label="Label">
            <Input placeholder="e.g. Wintermute, Jump Trading" />
          </Form.Item>
          <Form.Item name="wallet_type" label="Wallet Type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Smart Money', value: 'smart_money' },
                { label: 'Whale', value: 'whale' },
                { label: 'Insider', value: 'insider' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reliability" label="Reliability" initialValue={0.5}>
            <Slider min={0} max={1} step={0.1} marks={{ 0: '0', 0.5: '0.5', 1: '1.0' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
