import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Button, message, Alert } from 'antd'
import { useAppStore } from '../../stores/app'

const ServerSettings: React.FC = () => {
  const { config, updateConfig, saveConfigToFile } = useAppStore()
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      mongoHost: config.mongoConfig?.host || 'localhost',
      mongoPort: config.mongoConfig?.port || 27017,
      mongoDatabase: config.mongoConfig?.database || 'research_agent',
      mongoUsername: config.mongoConfig?.username || '',
      mongoPassword: config.mongoConfig?.password || '',
      serverPort: config.serverPort || 8000,
      dockerRegistry: config.deployment?.registry || 'sidawater',
      dockerImageName: config.deployment?.imageName || 'research-service',
      dockerComposeFile: config.deployment?.composeFile || 'docker-compose.yml',
      dockerWorkingDirectory: config.deployment?.workingDirectory || '',
    })
  }, [config, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      updateConfig({
        mongoConfig: {
          host: values.mongoHost,
          port: values.mongoPort,
          database: values.mongoDatabase,
          username: values.mongoUsername,
          password: values.mongoPassword,
        },
        serverPort: values.serverPort,
        deployment: {
          registry: values.dockerRegistry,
          imageName: values.dockerImageName,
          composeFile: values.dockerComposeFile,
          workingDirectory: values.dockerWorkingDirectory,
        },
      })
      await saveConfigToFile()
      message.success('服务器高级设置已保存')
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`)
    }
  }

  // Function to open DevTools
  const handleOpenDevTools = async () => {
    try {
      // Use the electronAPI object exposed via contextBridge in preload script
      if (window.electronAPI && typeof window.electronAPI.openDevTools === 'function') {
        const result = await window.electronAPI.openDevTools();
        if (result.success) {
          message.success('开发者工具已打开');
        } else {
          message.error(`打开开发者工具失败: ${result.error || '未知错误'}`);
        }
      } else {
        message.error('无法打开开发者工具：Electron API 不可用');
      }
    } catch (err) {
      message.error(`打开开发者工具失败: ${(err as Error).message}`);
    }
  };

  return (
    <div>
      <Alert
        message="警告"
        description="此页面包含高级配置选项，修改不当可能导致系统无法正常运行。请谨慎操作。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <h2>MongoDB 配置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item label="Host" name="mongoHost" rules={[{ required: true }]}>
          <Input placeholder="localhost" />
        </Form.Item>
        <Form.Item label="Port" name="mongoPort" rules={[{ required: true }]}>
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Database" name="mongoDatabase" rules={[{ required: true }]}>
          <Input placeholder="research_agent" />
        </Form.Item>
        <Form.Item label="Username" name="mongoUsername">
          <Input placeholder="可选" />
        </Form.Item>
        <Form.Item label="Password" name="mongoPassword">
          <Input.Password placeholder="可选" />
        </Form.Item>
      </Form>

      <h2 style={{ marginTop: 32 }}>服务器配置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="启动端口"
          name="serverPort"
          rules={[{ required: true }]}
          tooltip="后端服务监听端口"
        >
          <InputNumber min={1024} max={65535} style={{ width: '100%' }} />
        </Form.Item>
      </Form>

      <h2 style={{ marginTop: 32 }}>Docker 部署配置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item label="Docker Registry" name="dockerRegistry">
          <Input placeholder="sidawater" />
        </Form.Item>
        <Form.Item label="镜像名称" name="dockerImageName">
          <Input placeholder="research-service" />
        </Form.Item>
        <Form.Item label="Compose 文件名" name="dockerComposeFile">
          <Input placeholder="docker-compose.yml" />
        </Form.Item>
        <Form.Item
          label="工作目录"
          name="dockerWorkingDirectory"
          tooltip="docker-compose.yml 文件所在的绝对路径"
        >
          <Input placeholder="d:/proj/research-agent-system" />
        </Form.Item>
      </Form>

      <h2 style={{ marginTop: 32 }}>开发者工具</h2>
      <div style={{ marginBottom: 24 }}>
        <Button type="primary" onClick={handleOpenDevTools}>
          打开开发者工具
        </Button>
        <p style={{ marginTop: 8, color: '#666' }}>
          点击此按钮可打开开发者工具，用于调试和查看应用内部状态
        </p>
      </div>

      <h2 style={{ marginTop: 32 }}>MySQL 配置（预留）</h2>
      <Alert
        message="功能开发中"
        description="MySQL 数据库支持正在开发中，敬请期待。"
        type="info"
        showIcon
      />

      <div style={{ marginTop: 24 }}>
        <Button type="primary" onClick={handleSave}>
          保存所有配置
        </Button>
      </div>
    </div>
  )
}

export default ServerSettings