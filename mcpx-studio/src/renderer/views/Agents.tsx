import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Dropdown, Menu, Modal, message, Badge, Tooltip } from 'antd';
import { 
  PlusOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  ReloadOutlined,
  SettingOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { startAgent, stopAgent, fetchAgents } from '../store/slices/agentsSlice';
import AgentWizard from '../components/AgentWizard';

const Agents: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { list: agents, loading } = useSelector((state: RootState) => state.agents);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  useEffect(() => {
    // Fetch agents on mount and poll for updates
    dispatch(fetchAgents());
    const interval = setInterval(() => {
      dispatch(fetchAgents());
    }, 5000);
    return () => clearInterval(interval);
  }, [dispatch]);

  const handleCreateAgent = () => {
    setWizardVisible(true);
  };

  const handleWizardComplete = async (agentConfig: any) => {
    message.success(`Agent "${agentConfig.name}" created successfully!`);
    dispatch(fetchAgents());
  };

  const handleDeleteAgent = (agent: any) => {
    Modal.confirm({
      title: 'Delete Agent',
      content: `Are you sure you want to delete "${agent.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await window.electronAPI.cli.execute('agent', ['remove', agent.name]);
          if (result.success) {
            message.success(`Agent "${agent.name}" deleted`);
            dispatch(fetchAgents());
          } else {
            message.error('Failed to delete agent');
          }
        } catch (error) {
          message.error('Failed to delete agent');
        }
      }
    });
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'ai': return <RobotOutlined style={{ color: '#52c41a' }} />;
      case 'basic': return <RobotOutlined style={{ color: '#1890ff' }} />;
      default: return <RobotOutlined />;
    }
  };

  const columns = [
    {
      title: '',
      key: 'icon',
      width: 40,
      render: (text: any, record: any) => getAgentIcon(record.type),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {record.autoStart && (
            <Tooltip title="Auto-start enabled">
              <Badge status="processing" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'ai' ? 'green' : type === 'basic' ? 'blue' : 'orange'}>
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => (
        <Space>
          <Badge 
            status={status === 'running' ? 'success' : status === 'starting' ? 'processing' : 'default'} 
          />
          <Tag color={status === 'running' ? 'green' : status === 'starting' ? 'blue' : 'default'}>
            {status}
          </Tag>
          {record.pid && <Tag>PID: {record.pid}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Topic',
      dataIndex: 'topic',
      key: 'topic',
      render: (topic: string) => (
        <Tag icon={<SettingOutlined />}>
          {topic || 'room:general'}
        </Tag>
      ),
    },
    {
      title: 'MCP Servers',
      key: 'mcpServers',
      render: (text: any, record: any) => (
        <Space>
          {record.mcpServers?.length > 0 ? (
            record.mcpServers.map((server: string) => (
              <Tag key={server}>{server}</Tag>
            ))
          ) : (
            <Tag color="default">None</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (text: any, record: any) => {
        const menu = (
          <Menu>
            <Menu.Item 
              key="edit" 
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedAgent(record);
                message.info('Edit functionality coming soon');
              }}
            >
              Edit Configuration
            </Menu.Item>
            <Menu.Item 
              key="logs" 
              onClick={() => message.info('Logs viewer coming soon')}
            >
              View Logs
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item 
              key="delete" 
              icon={<DeleteOutlined />}
              danger
              onClick={() => handleDeleteAgent(record)}
            >
              Delete Agent
            </Menu.Item>
          </Menu>
        );

        return (
          <Space>
            {record.status === 'stopped' ? (
              <Button
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={async () => {
                  const result = await window.electronAPI.cli.execute('agent', ['start', record.name]);
                  if (result.success) {
                    message.success(`Agent "${record.name}" started`);
                    dispatch(fetchAgents());
                  }
                }}
              >
                Start
              </Button>
            ) : (
              <Button
                size="small"
                danger
                icon={<PauseCircleOutlined />}
                onClick={async () => {
                  const result = await window.electronAPI.cli.execute('agent', ['stop', record.name]);
                  if (result.success) {
                    message.success(`Agent "${record.name}" stopped`);
                    dispatch(fetchAgents());
                  }
                }}
              >
                Stop
              </Button>
            )}
            <Dropdown overlay={menu} trigger={['click']}>
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Card 
        title={
          <Space>
            <RobotOutlined />
            <span>Agents</span>
            <Badge count={agents.length} showZero />
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => dispatch(fetchAgents())}
            >
              Refresh
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleCreateAgent}
            >
              Create Agent
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={agents}
          loading={loading}
          rowKey="name"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} agents`
          }}
        />
      </Card>
      
      <AgentWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onComplete={handleWizardComplete}
      />
    </>
  );
};

export default Agents;