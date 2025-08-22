import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  RobotOutlined,
  ApiOutlined,
  MessageOutlined,
  MonitorOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/agents',
      icon: <RobotOutlined />,
      label: 'Agents',
    },
    {
      key: '/bridges',
      icon: <ApiOutlined />,
      label: 'Bridges',
    },
    {
      key: '/topics',
      icon: <MessageOutlined />,
      label: 'Topics',
    },
    {
      key: '/monitoring',
      icon: <MonitorOutlined />,
      label: 'Monitoring',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
  ];

  return (
    <Sider width={200} className="site-layout-background">
      <div style={{ 
        height: 64, 
        margin: 16, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1890ff'
      }}>
        MCPx Studio
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
};

export default Sidebar;