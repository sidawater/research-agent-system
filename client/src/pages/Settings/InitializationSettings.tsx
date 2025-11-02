import React, { useEffect, useState } from 'react'
import { Form, Input, Button, Space, message, Alert, Progress } from 'antd'
import { useAppStore } from '../../stores/app'

const InitializationSettings: React.FC = () => {
  const { config, updateConfig, saveConfigToFile } = useAppStore()
  const [form] = Form.useForm()
  const [deployForm] = Form.useForm()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployProgress, setDeployProgress] = useState<{
    step: string
    message: string
    percentage?: number
    details?: string
  } | null>(null)
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('')

  useEffect(() => {
    form.setFieldsValue({
      websocketUrl: config.websocketUrl,
      apiServerUrl: config.apiServerUrl,
    })
  }, [config, form])

  // 监听部署进度
  useEffect(() => {
    if (!window.electronAPI?.onDeployProgress) return

    const unsubscribe = window.electronAPI.onDeployProgress((_event, progress) => {
      setDeployProgress(progress)

      if (progress.step === 'complete') {
        message.success(progress.message)
        setIsDeploying(false)
        checkDocker()
      } else if (progress.step === 'error') {
        message.error({ content: progress.message, duration: 5 })
        setIsDeploying(false)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      updateConfig({
        websocketUrl: values.websocketUrl,
        apiServerUrl: values.apiServerUrl,
      })
      await saveConfigToFile()
      message.success('初始化配置已保存')
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`)
    }
  }

  const handleTestConnection = async () => {
    const values = await form.validateFields()
    const apiBase = (values.apiServerUrl || '').replace(/\/$/, '')
    const healthUrl = `${apiBase}/health`

    message.loading({ content: '测试连接中...', key: 'test-conn' })

    // Test HTTP
    try {
      const resp = await fetch(healthUrl)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      message.success({ content: 'HTTP健康检查通过', key: 'test-conn', duration: 1 })
    } catch (err) {
      message.error({ content: `HTTP连接失败: ${(err as Error).message}`, key: 'test-conn' })
      return
    }

    // Test WebSocket
    const wsUrl = values.websocketUrl
    if (!wsUrl) {
      message.warning('未配置WebSocket地址')
      return
    }

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const ws = new WebSocket(wsUrl)
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            try { ws.close() } catch {}
            reject(new Error('连接超时'))
          }
        }, 5000)
        ws.onopen = () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            ws.close()
            resolve()
          }
        }
        ws.onerror = () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            try { ws.close() } catch {}
            reject(new Error('WebSocket错误'))
          }
        }
      })
      message.success('WebSocket连接成功')
    } catch (err) {
      message.error(`WebSocket连接失败: ${(err as Error).message}`)
    }
  }

  const checkDocker = async () => {
    try {
      const result = await window.electronAPI?.checkDockerEnvironment?.({
        registry: config.deployment?.registry || '',
        imageName: config.deployment?.imageName || 'research-service',
        composeFile: config.deployment?.composeFile || 'docker-compose.yml',
        workingDirectory: config.deployment?.workingDirectory || './',
      })

      if (result?.success) {
        setDockerAvailable(true)
        setCurrentVersion(result.currentVersion || 'unknown')
        message.success('Docker 环境检查通过')
      } else {
        setDockerAvailable(false)
        message.error(`Docker 环境不可用: ${result?.error}`)
      }
    } catch (err) {
      setDockerAvailable(false)
      message.error(`检查失败: ${(err as Error).message}`)
    }
  }

  const handleDeploy = async () => {
    try {
      const values = await deployForm.validateFields()
      setIsDeploying(true)
      setDeployProgress(null)

      const result = await window.electronAPI?.startDeployment?.({
        credentials: {
          username: values.username || '',
          password: values.password || '',
        },
        version: values.version,
        config: {
          registry: config.deployment?.registry || 'sidawater',
          imageName: config.deployment?.imageName || 'research-service',
          composeFile: config.deployment?.composeFile || 'docker-compose.yml',
          workingDirectory: config.deployment?.workingDirectory || 'd:/proj/research-agent-system',
        },
      })

      if (result?.success) {
        message.success(`部署成功: ${result.version}`)
        setCurrentVersion(result.version || '')
        deployForm.resetFields(['password'])
      } else {
        message.error(`部署失败: ${result?.message}`)
      }
    } catch (err) {
      message.error(`部署失败: ${(err as Error).message}`)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div>
      <h2>连接配置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="HTTP API 地址"
          name="apiServerUrl"
          rules={[{ required: true, message: '请输入 API 服务器地址' }]}
          tooltip="示例: http://127.0.0.1:8000/api/v1"
        >
          <Input placeholder="http://127.0.0.1:8000/api/v1" />
        </Form.Item>
        <Form.Item
          label="WebSocket 地址"
          name="websocketUrl"
          rules={[{ required: true, message: '请输入 WebSocket 地址' }]}
          tooltip="示例: ws://127.0.0.1:8000/chat"
        >
          <Input placeholder="ws://127.0.0.1:8000/chat" />
        </Form.Item>
      </Form>
      <Space>
        <Button onClick={handleTestConnection}>测试连接</Button>
        <Button type="primary" onClick={handleSave}>
          保存配置
        </Button>
      </Space>

      <h2 style={{ marginTop: 40 }}>服务部署</h2>
      <Alert
        message="Docker 环境状态"
        description={
          dockerAvailable === null
            ? '未检测'
            : dockerAvailable
            ? `Docker 可用 | 当前版本: ${currentVersion}`
            : 'Docker 不可用，请启动 Docker Desktop'
        }
        type={dockerAvailable ? 'success' : 'warning'}
        showIcon
        style={{ marginBottom: 16, maxWidth: 600 }}
        action={
          <Button size="small" onClick={checkDocker}>
            检测
          </Button>
        }
      />

      <Form form={deployForm} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="Docker Hub 用户名"
          name="username"
          tooltip="用于登录 Docker Hub，如果使用公共镜像可以为空"
        >
          <Input placeholder="输入 Docker Hub 用户名 (可选)" />
        </Form.Item>

        <Form.Item
          label="Docker Hub 密码/Token"
          name="password"
          tooltip="建议使用 Access Token"
        >
          <Input.Password placeholder="输入密码或 Access Token (可选)" />
        </Form.Item>

        <Form.Item
          label="版本号"
          name="version"
          rules={[
            { required: true, message: '请输入版本号' },
            { pattern: /^[a-zA-Z0-9._-]+$/, message: '版本号格式不正确' },
          ]}
          tooltip="如: v1.0.0, 2.1.0, latest"
        >
          <Input placeholder="输入要部署的版本号 (如 v1.0.0)" />
        </Form.Item>
      </Form>

      {deployProgress && (
        <div style={{ marginTop: 16, marginBottom: 16, maxWidth: 600 }}>
          {deployProgress.percentage !== undefined && (
            <Progress percent={deployProgress.percentage} status="active" />
          )}
          <div style={{ marginTop: 8 }}>
            <strong>{deployProgress.message}</strong>
          </div>
          {deployProgress.details && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
              {deployProgress.details}
            </div>
          )}
        </div>
      )}

      <Space>
        <Button
          type="primary"
          onClick={handleDeploy}
          disabled={isDeploying || dockerAvailable === false}
          loading={isDeploying}
        >
          {isDeploying ? '部署中...' : '开始部署'}
        </Button>
        <Button onClick={checkDocker} disabled={isDeploying}>
          检测 Docker 环境
        </Button>
      </Space>

      <Alert
        message="注意事项"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>部署前请确保 Docker Desktop 已启动</li>
            <li>如使用 Docker Hub 公共镜像，无需输入用户名和密码</li>
            <li>部署过程可能需要 3-10 分钟，取决于网络速度</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 16, maxWidth: 600 }}
      />
    </div>
  )
}

export default InitializationSettings
