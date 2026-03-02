import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  Popconfirm,
  Tag,
  App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TelegramGroupConfig as TgType } from '../../services/types';
import {
  getTelegramGroups,
  createTelegramGroup,
  updateTelegramGroup,
  deleteTelegramGroup,
} from '../../services/api';

const TYPE_COLORS: Record<string, string> = {
  group: 'blue',
  channel: 'green',
  supergroup: 'purple',
};

export default function TelegramConfig() {
  const { message } = App.useApp();
  const [data, setData] = useState<TgType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TgType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getTelegramGroups();
      setData(list);
    } catch {
      message.error('Failed to load Telegram groups');
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
    form.setFieldsValue({ group_type: 'group' });
    setModalOpen(true);
  };

  const openEdit = (record: TgType) => {
    setEditing(record);
    form.setFieldsValue({
      group_link: record.group_link,
      label: record.label,
      group_type: record.group_type,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await updateTelegramGroup(editing.id, values);
        message.success('Group updated');
      } else {
        await createTelegramGroup(values);
        message.success('Group added');
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
      await deleteTelegramGroup(id);
      message.success('Group deleted');
      fetchData();
    } catch {
      message.error('Delete failed');
    }
  };

  const handleToggle = async (record: TgType, checked: boolean) => {
    try {
      await updateTelegramGroup(record.id, { is_active: checked });
      setData((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, is_active: checked } : r)),
      );
    } catch {
      message.error('Toggle failed');
    }
  };

  const columns: ColumnsType<TgType> = [
    {
      title: 'Group Link',
      dataIndex: 'group_link',
      render: (v: string) => (
        <span style={{ fontWeight: 500 }}>{v}</span>
      ),
    },
    {
      title: 'Group Name',
      dataIndex: 'group_name',
      render: (v: string | null) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Type',
      dataIndex: 'group_type',
      width: 120,
      render: (v: string) => (
        <Tag color={TYPE_COLORS[v] || 'default'}>{v}</Tag>
      ),
    },
    {
      title: 'Label',
      dataIndex: 'label',
      render: (v: string | null) =>
        v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
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
            title="Delete this group?"
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
        <h2>Telegram Groups</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Group
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
        title={editing ? 'Edit Group' : 'Add Group'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="group_link"
            label="Group Link"
            rules={[{ required: true, message: 'Group link is required' }]}
          >
            <Input placeholder="t.me/xxx or @xxx" />
          </Form.Item>
          <Form.Item name="label" label="Label">
            <Input placeholder="e.g. Alpha Calls, News Feed" />
          </Form.Item>
          <Form.Item name="group_type" label="Group Type">
            <Select
              options={[
                { label: 'Group', value: 'group' },
                { label: 'Channel', value: 'channel' },
                { label: 'Supergroup', value: 'supergroup' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
