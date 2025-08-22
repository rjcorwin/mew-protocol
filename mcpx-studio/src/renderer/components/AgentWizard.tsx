import React, { useState } from 'react';
import { 
  Modal, 
  Steps, 
  Form, 
  Input, 
  Select, 
  Button, 
  Space, 
  Alert, 
  Card,
  Radio,
  Switch,
  Divider,
  Typography,
  Tag,
  Tooltip,
  Row,
  Col
} from 'antd';
import { 
  RobotOutlined, 
  SettingOutlined, 
  ApiOutlined, 
  CheckCircleOutlined,
  InfoCircleOutlined,
  CodeOutlined,
  MessageOutlined
} from '@ant-design/icons';

const { Step } = Steps;
const { TextArea } = Input;
const { Text, Title } = Typography;

interface AgentWizardProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (agentConfig: any) => void;
}

const AgentWizard: React.FC<AgentWizardProps> = ({ visible, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [agentType, setAgentType] = useState<'basic' | 'ai' | 'custom'>('basic');
  const [loading, setLoading] = useState(false);

  const steps = [
    {
      title: 'Agent Type',
      icon: <RobotOutlined />,
      description: 'Choose agent type'
    },
    {
      title: 'Configuration',
      icon: <SettingOutlined />,
      description: 'Configure settings'
    },
    {
      title: 'Tools & MCP',
      icon: <ApiOutlined />,
      description: 'Select tools'
    },
    {
      title: 'Review',
      icon: <CheckCircleOutlined />,
      description: 'Review & create'
    }
  ];

  const handleNext = async () => {
    try {
      await form.validateFields();
      if (currentStep === steps.length - 1) {
        handleCreate();
      } else {
        setCurrentStep(currentStep + 1);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const agentConfig = {
        ...values,
        type: agentType,
        timestamp: new Date().toISOString()
      };
      
      // Call the agent API to create the agent
      // Map agentType to template name
      const templateMap: { [key: string]: string } = {
        'AI': 'openai',
        'Claude': 'claude',
        'Basic': 'basic'
      };
      const template = templateMap[agentType] || 'basic';
      
      const result = await window.electronAPI.agent.create(
        values.name || `agent-${Date.now()}`,
        template,
        {
          topic: values.topic || 'room:general',
          aiProvider: values.aiProvider,
          aiModel: values.model
        }
      );
      
      if (result) {
        onComplete(agentConfig);
        form.resetFields();
        setCurrentStep(0);
        onClose();
      } else {
        throw new Error('Failed to create agent');
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
      // Note: Alert is just a component, not a function
      // We should use antd message or notification instead
      // For now, just log the error
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div style={{ padding: '20px 0' }}>
            <Radio.Group 
              value={agentType} 
              onChange={(e) => setAgentType(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Card 
                  hoverable 
                  style={{ cursor: 'pointer' }}
                  className={agentType === 'basic' ? 'ant-card-bordered' : ''}
                  onClick={() => setAgentType('basic')}
                >
                  <Radio value="basic">
                    <Space>
                      <MessageOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                      <div>
                        <Title level={5} style={{ margin: 0 }}>Basic Agent</Title>
                        <Text type="secondary">Simple message relay agent for testing and debugging</Text>
                      </div>
                    </Space>
                  </Radio>
                </Card>

                <Card 
                  hoverable 
                  style={{ cursor: 'pointer' }}
                  className={agentType === 'ai' ? 'ant-card-bordered' : ''}
                  onClick={() => setAgentType('ai')}
                >
                  <Radio value="ai">
                    <Space>
                      <RobotOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                      <div>
                        <Title level={5} style={{ margin: 0 }}>AI Agent</Title>
                        <Text type="secondary">Powered by OpenAI GPT-4o or other LLMs</Text>
                      </div>
                    </Space>
                  </Radio>
                </Card>

                <Card 
                  hoverable 
                  style={{ cursor: 'pointer' }}
                  className={agentType === 'custom' ? 'ant-card-bordered' : ''}
                  onClick={() => setAgentType('custom')}
                >
                  <Radio value="custom">
                    <Space>
                      <CodeOutlined style={{ fontSize: 24, color: '#faad14' }} />
                      <div>
                        <Title level={5} style={{ margin: 0 }}>Custom Agent</Title>
                        <Text type="secondary">Build your own agent with custom logic</Text>
                      </div>
                    </Space>
                  </Radio>
                </Card>
              </Space>
            </Radio.Group>
          </div>
        );

      case 1:
        return (
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="Agent Name"
              rules={[
                { required: true, message: 'Please enter agent name' },
                { pattern: /^[a-z0-9-]+$/, message: 'Use lowercase letters, numbers, and hyphens only' }
              ]}
            >
              <Input 
                placeholder="my-agent" 
                prefix={<RobotOutlined />}
              />
            </Form.Item>

            <Form.Item
              name="description"
              label="Description"
            >
              <TextArea 
                rows={2} 
                placeholder="Describe what this agent does..."
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="topic"
                  label="Topic"
                  initialValue="room:general"
                  rules={[{ required: true, message: 'Please select a topic' }]}
                >
                  <Select>
                    <Select.Option value="room:general">room:general</Select.Option>
                    <Select.Option value="room:dev">room:dev</Select.Option>
                    <Select.Option value="room:test">room:test</Select.Option>
                    <Select.Option value="custom">Custom topic...</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="autoStart"
                  label="Auto Start"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
              </Col>
            </Row>

            {agentType === 'ai' && (
              <>
                <Divider>AI Configuration</Divider>
                <Form.Item
                  name="aiProvider"
                  label="AI Provider"
                  initialValue="openai"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Select.Option value="openai">OpenAI</Select.Option>
                    <Select.Option value="anthropic">Anthropic</Select.Option>
                    <Select.Option value="local">Local LLM</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="apiKey"
                  label={
                    <Space>
                      API Key
                      <Tooltip title="Your API key will be stored securely">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  rules={[{ required: true, message: 'API key is required for AI agents' }]}
                >
                  <Input.Password placeholder="sk-..." />
                </Form.Item>

                <Form.Item
                  name="model"
                  label="Model"
                  initialValue="gpt-4o"
                >
                  <Select>
                    <Select.Option value="gpt-4o">GPT-4o (Recommended)</Select.Option>
                    <Select.Option value="gpt-4">GPT-4</Select.Option>
                    <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="systemPrompt"
                  label="System Prompt"
                >
                  <TextArea 
                    rows={3} 
                    placeholder="You are a helpful assistant..."
                  />
                </Form.Item>
              </>
            )}
          </Form>
        );

      case 2:
        return (
          <div>
            <Alert
              message="MCP Server Configuration"
              description="Select which MCP servers this agent should have access to"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Form form={form} layout="vertical">
              <Form.Item
                name="mcpServers"
                label="Available MCP Servers"
              >
                <Select
                  mode="multiple"
                  placeholder="Select MCP servers"
                  style={{ width: '100%' }}
                >
                  <Select.Option value="filesystem">
                    <Space>
                      <ApiOutlined />
                      Filesystem
                    </Space>
                  </Select.Option>
                  <Select.Option value="github">
                    <Space>
                      <ApiOutlined />
                      GitHub
                    </Space>
                  </Select.Option>
                  <Select.Option value="slack">
                    <Space>
                      <ApiOutlined />
                      Slack
                    </Space>
                  </Select.Option>
                  <Select.Option value="postgres">
                    <Space>
                      <ApiOutlined />
                      PostgreSQL
                    </Space>
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="toolPermissions"
                label="Tool Permissions"
              >
                <Radio.Group>
                  <Space direction="vertical">
                    <Radio value="all">Allow all tools</Radio>
                    <Radio value="readonly">Read-only tools</Radio>
                    <Radio value="custom">Custom permissions</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="maxConcurrentTools"
                label="Max Concurrent Tool Calls"
                initialValue={5}
              >
                <Input type="number" min={1} max={20} />
              </Form.Item>
            </Form>
          </div>
        );

      case 3:
        const values = form.getFieldsValue();
        return (
          <div>
            <Alert
              message="Review Configuration"
              description="Please review your agent configuration before creating"
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Agent Type:</Text>
                  <Tag color={agentType === 'ai' ? 'green' : agentType === 'basic' ? 'blue' : 'orange'}>
                    {agentType.toUpperCase()}
                  </Tag>
                </div>
                
                <div>
                  <Text strong>Name:</Text> {values.name || 'Not specified'}
                </div>
                
                <div>
                  <Text strong>Topic:</Text> {values.topic || 'room:general'}
                </div>
                
                {agentType === 'ai' && (
                  <>
                    <div>
                      <Text strong>AI Provider:</Text> {values.aiProvider || 'openai'}
                    </div>
                    <div>
                      <Text strong>Model:</Text> {values.model || 'gpt-4o'}
                    </div>
                  </>
                )}
                
                <div>
                  <Text strong>MCP Servers:</Text> {values.mcpServers?.join(', ') || 'None selected'}
                </div>
                
                <div>
                  <Text strong>Auto Start:</Text> {values.autoStart ? 'Yes' : 'No'}
                </div>
              </Space>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title="Create New Agent"
      visible={visible}
      onCancel={onClose}
      width={700}
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          {currentStep > 0 && (
            <Button onClick={handlePrev}>Previous</Button>
          )}
          <Button 
            type="primary" 
            onClick={handleNext}
            loading={loading}
          >
            {currentStep === steps.length - 1 ? 'Create Agent' : 'Next'}
          </Button>
        </Space>
      }
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps.map((step) => (
          <Step key={step.title} title={step.title} icon={step.icon} />
        ))}
      </Steps>
      
      {renderStepContent()}
    </Modal>
  );
};

export default AgentWizard;