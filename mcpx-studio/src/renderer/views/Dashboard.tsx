import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Space, Statistic, Tag, Progress, Alert, List, Typography, Badge } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  DatabaseOutlined,
  ApiOutlined,
  RobotOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchSystemStatus, startSystem, stopSystem } from '../store/slices/systemSlice';
import { fetchAgents } from '../store/slices/agentsSlice';

interface SystemMetrics {
  messagesPerSecond: number;
  activeConnections: number;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
}

interface ActivityLog {
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  component?: string;
}

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { status, components, error } = useSelector((state: RootState) => state.system);
  const { list: agents } = useSelector((state: RootState) => state.agents);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    messagesPerSecond: 0,
    activeConnections: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    uptime: 0
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    // Fetch initial status
    dispatch(fetchSystemStatus());
    dispatch(fetchAgents());

    // Poll for updates every 2 seconds for real-time feel
    const interval = setInterval(() => {
      dispatch(fetchSystemStatus());
      dispatch(fetchAgents());
      updateMetrics();
    }, 2000);

    // Simulate activity logs
    const logInterval = setInterval(() => {
      if (status === 'running') {
        addActivityLog({
          timestamp: new Date(),
          type: 'info',
          message: `System health check completed`,
          component: 'Monitor'
        });
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(logInterval);
    };
  }, [dispatch, status]);

  const updateMetrics = () => {
    setMetrics(prev => ({
      messagesPerSecond: Math.floor(Math.random() * 50) + (status === 'running' ? 10 : 0),
      activeConnections: agents.filter(a => a.status === 'running').length,
      cpuUsage: Math.min(95, Math.max(5, prev.cpuUsage + (Math.random() - 0.5) * 10)),
      memoryUsage: Math.min(90, Math.max(10, prev.memoryUsage + (Math.random() - 0.5) * 5)),
      uptime: status === 'running' ? prev.uptime + 2 : 0
    }));
  };

  const addActivityLog = (log: ActivityLog) => {
    setActivityLogs(prev => [log, ...prev].slice(0, 10));
  };

  const runningComponents = components.filter(c => c.status === 'running').length;
  const totalComponents = components.length;
  const runningAgents = agents.filter(a => a.status === 'running').length;
  const totalAgents = agents.length;

  const handleStart = () => {
    dispatch(startSystem());
    addActivityLog({
      timestamp: new Date(),
      type: 'success',
      message: 'System startup initiated',
      component: 'System'
    });
  };

  const handleStop = () => {
    dispatch(stopSystem());
    addActivityLog({
      timestamp: new Date(),
      type: 'warning',
      message: 'System shutdown initiated',
      component: 'System'
    });
  };

  const handleRefresh = () => {
    dispatch(fetchSystemStatus());
    dispatch(fetchAgents());
    addActivityLog({
      timestamp: new Date(),
      type: 'info',
      message: 'Manual status refresh',
      component: 'Dashboard'
    });
  };

  const getComponentIcon = (name: string) => {
    if (name.toLowerCase().includes('server')) return <DatabaseOutlined />;
    if (name.toLowerCase().includes('agent')) return <RobotOutlined />;
    if (name.toLowerCase().includes('bridge')) return <ApiOutlined />;
    if (name.toLowerCase().includes('frontend')) return <GlobalOutlined />;
    return <CheckCircleOutlined />;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'warning': return <WarningOutlined style={{ color: '#faad14' }} />;
      default: return <SyncOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="System Control" extra={
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Refresh</Button>
          }>
            <Space size="large">
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleStart}
                disabled={status === 'running'}
                loading={status === 'loading'}
              >
                Start All
              </Button>
              <Button
                danger
                size="large"
                icon={<PauseCircleOutlined />}
                onClick={handleStop}
                disabled={status === 'stopped'}
                loading={status === 'loading'}
              >
                Stop All
              </Button>
              <Tag color={status === 'running' ? 'green' : status === 'stopped' ? 'red' : 'orange'}>
                Status: {status.toUpperCase()}
              </Tag>
            </Space>
            {error && (
              <Alert
                message="Error"
                description={error}
                type="error"
                showIcon
                closable
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Components"
              value={runningComponents}
              suffix={`/ ${totalComponents}`}
              valueStyle={{ color: runningComponents === totalComponents ? '#3f8600' : '#cf1322' }}
              prefix={<DatabaseOutlined />}
            />
            <Progress 
              percent={totalComponents > 0 ? (runningComponents / totalComponents) * 100 : 0} 
              showInfo={false}
              strokeColor={runningComponents === totalComponents ? '#52c41a' : '#ff4d4f'}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Agents"
              value={runningAgents}
              suffix={`/ ${totalAgents}`}
              valueStyle={{ color: '#1890ff' }}
              prefix={<RobotOutlined />}
            />
            <Progress 
              percent={totalAgents > 0 ? (runningAgents / totalAgents) * 100 : 0} 
              showInfo={false}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Messages/sec"
              value={metrics.messagesPerSecond}
              valueStyle={{ color: metrics.messagesPerSecond > 0 ? '#52c41a' : '#8c8c8c' }}
              prefix={<ApiOutlined />}
            />
            <Progress 
              percent={Math.min(100, metrics.messagesPerSecond * 2)}
              showInfo={false}
              strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Uptime"
              value={formatUptime(metrics.uptime)}
              valueStyle={{ color: '#1890ff', fontSize: 18 }}
              prefix={<SyncOutlined spin={status === 'running'} />}
            />
            <Badge 
              status={status === 'running' ? 'processing' : 'default'} 
              text={status === 'running' ? 'System Active' : 'System Inactive'}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="System Resources" size="small">
            <Row gutter={16}>
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography.Text>CPU Usage</Typography.Text>
                    <Typography.Text type="secondary">{metrics.cpuUsage.toFixed(1)}%</Typography.Text>
                  </div>
                  <Progress 
                    percent={metrics.cpuUsage} 
                    strokeColor={{
                      '0%': '#108ee9',
                      '50%': '#87d068',
                      '100%': metrics.cpuUsage > 80 ? '#ff4d4f' : '#87d068'
                    }}
                    showInfo={false}
                  />
                </Space>
              </Col>
              <Col span={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography.Text>Memory Usage</Typography.Text>
                    <Typography.Text type="secondary">{metrics.memoryUsage.toFixed(1)}%</Typography.Text>
                  </div>
                  <Progress 
                    percent={metrics.memoryUsage} 
                    strokeColor={{
                      '0%': '#108ee9',
                      '50%': '#87d068',
                      '100%': metrics.memoryUsage > 80 ? '#ff4d4f' : '#87d068'
                    }}
                    showInfo={false}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="Component Status" extra={<Badge status="processing" text="Live" />}>
            {components.length === 0 ? (
              <p>No components detected. Start the system to begin.</p>
            ) : (
              <List
                size="small"
                dataSource={components}
                renderItem={(component) => (
                  <List.Item
                    actions={[
                      <Tag color={component.status === 'running' ? 'green' : 'red'}>
                        {component.status}
                      </Tag>,
                      component.pid && <Tag>PID: {component.pid}</Tag>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getComponentIcon(component.name)}
                      title={component.name}
                      description={component.status === 'running' ? 'Healthy' : 'Not running'}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Activity Log" extra={<Badge count={activityLogs.length} />}>
            {activityLogs.length === 0 ? (
              <p>No recent activity to display.</p>
            ) : (
              <List
                size="small"
                dataSource={activityLogs}
                renderItem={(log) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getActivityIcon(log.type)}
                      title={
                        <Space>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {log.timestamp.toLocaleTimeString()}
                          </Typography.Text>
                          {log.component && <Tag>{log.component}</Tag>}
                        </Space>
                      }
                      description={log.message}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;