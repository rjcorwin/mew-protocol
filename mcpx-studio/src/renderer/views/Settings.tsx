import React from 'react';
import { Card, Form, Switch, Select, Button } from 'antd';

const Settings: React.FC = () => {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log('Settings:', values);
    // Save settings
  };

  return (
    <Card title="Settings">
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          theme: 'system',
          autoStart: false,
          notifications: true,
        }}
      >
        <Form.Item label="Theme" name="theme">
          <Select>
            <Select.Option value="system">System</Select.Option>
            <Select.Option value="light">Light</Select.Option>
            <Select.Option value="dark">Dark</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Auto Start on Login" name="autoStart" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="Enable Notifications" name="notifications" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            Save Settings
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default Settings;