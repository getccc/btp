import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Space } from 'antd';
import {
  DashboardOutlined,
  RadarChartOutlined,
  AimOutlined,
  SettingOutlined,
  UserOutlined,
  WalletOutlined,
  MessageOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { getHealth } from '../services/api';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/signals',
    icon: <RadarChartOutlined />,
    label: 'Signal Feed',
  },
  {
    key: '/opportunities',
    icon: <AimOutlined />,
    label: 'Opportunities',
  },
  { type: 'divider' as const },
  {
    key: 'config',
    icon: <SettingOutlined />,
    label: 'Config',
    children: [
      { key: '/config/kols', icon: <UserOutlined />, label: 'KOL List' },
      { key: '/config/wallets', icon: <WalletOutlined />, label: 'Smart Money' },
      { key: '/config/telegram', icon: <MessageOutlined />, label: 'Telegram Groups' },
      { key: '/config/system', icon: <ToolOutlined />, label: 'System Settings' },
    ],
  },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    const check = () => {
      getHealth()
        .then(() => mounted && setBackendOnline(true))
        .catch(() => mounted && setBackendOnline(false));
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Determine which menu keys to highlight
  const selectedKeys = [location.pathname];
  const openKeys = location.pathname.startsWith('/config') ? ['config'] : [];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={220}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">V3</div>
          {!collapsed && <h1>Signal Platform</h1>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header className="app-header" style={{ height: 52, lineHeight: '52px' }}>
          <Text strong style={{ fontSize: 15 }}>V3 Signal Platform</Text>
          <Space size={4} align="center">
            <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
            <Text type="secondary" style={{ fontSize: 13 }}>
              {backendOnline ? 'Backend Connected' : 'Backend Offline'}
            </Text>
          </Space>
        </Header>

        <Content style={{ margin: 0, minHeight: 'calc(100vh - 52px)', background: '#f0f2f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
