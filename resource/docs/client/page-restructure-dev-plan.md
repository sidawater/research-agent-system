# 页面重构开发详细文档

## 📋 项目概述

将单页应用重构为多页面架构，增加右侧导航栏，实现主页、设置、帮助三个独立页面。

### 关键调整
- **右侧导航栏**：宽度 120px，默认收起状态
- **路由架构**：从单页 Modal 改为多路由页面
- **设置页面**：左侧导航 + 内容区域
- **帮助页面**：应用说明 + 版本信息

---

## 🎯 Phase 1: 基础架构搭建

### 1.1 创建右侧导航栏组件

**文件**: `client/src/components/Navigation/RightNavbar.tsx`

```typescript
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button } from 'antd'
import {
  HomeOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'

const { Sider } = Layout

const RightNavbar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(true) // 默认收起

  const menuItems = [
    {
      key: '/home',
      icon: <HomeOutlined />,
      label: '主页',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      key: '/help',
      icon: <QuestionCircleOutlined />,
      label: '帮助',
    },
  ]

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key)
  }

  // 获取当前激活的菜单项
  const getSelectedKey = () => {
    if (location.pathname.startsWith('/settings')) return '/settings'
    if (location.pathname.startsWith('/help')) return '/help'
    return '/home'
  }

  return (
    <Sider
      collapsed={collapsed}
      collapsible
      trigger={null}
      width={120}
      collapsedWidth={60}
      style={{
        height: '100vh',
        position: 'fixed',
        right: 0,
        top: 0,
        backgroundColor: '#001529',
        zIndex: 100,
      }}
    >
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 折叠按钮 */}
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              color: '#fff',
              fontSize: '16px',
            }}
          />
        </div>

        {/* 菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ flex: 1, borderRight: 0 }}
        />
      </div>
    </Sider>
  )
}

export default RightNavbar
```

**关键点**:
- 使用 Ant Design `Sider` 组件
- 默认 `collapsed={true}` 收起状态
- 展开宽度 120px，收起宽度 60px
- 固定在右侧 (`position: fixed, right: 0`)
- 使用 `useLocation` 高亮当前路由

---

### 1.2 创建通用页面头部组件

**文件**: `client/src/components/Common/PageHeader.tsx`

```typescript
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

const { Title } = Typography

interface PageHeaderProps {
  title: string
  showBackButton?: boolean
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBackButton = true,
}) => {
  const navigate = useNavigate()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fff',
      }}
    >
      {showBackButton && (
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/home')}
          style={{ marginRight: 16 }}
        >
          返回
        </Button>
      )}
      <Title level={3} style={{ margin: 0 }}>
        {title}
      </Title>
    </div>
  )
}

export default PageHeader
```

**关键点**:
- 可选返回按钮
- 统一样式风格
- 点击返回固定导航至 `/home`

---

### 1.3 修改 App.tsx

**文件**: `client/src/App.tsx`

```typescript
import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import Home from './pages/Home'
import SettingsPage from './pages/Settings'
import HelpPage from './pages/Help'
import RightNavbar from './components/Navigation/RightNavbar'
import { useAppStore } from './stores/app'

const { Content } = Layout

const App: React.FC = () => {
  const loadConfigFromFile = useAppStore((state) => state.loadConfigFromFile)

  useEffect(() => {
    // Load config from file on app startup
    loadConfigFromFile()
  }, [])

  return (
    <Layout style={{ height: '100vh', position: 'relative' }}>
      {/* 主内容区域 - 为右侧导航栏留出空间 */}
      <Content style={{ marginRight: '60px' }}> {/* 收起时的宽度 */}
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/settings/*" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </Content>

      {/* 右侧固定导航栏 */}
      <RightNavbar />
    </Layout>
  )
}

export default App
```

**关键变更**:
1. 移除 `SettingsModal` 导入
2. 添加新路由: `/home`, `/settings/*`, `/help`
3. 添加 `RightNavbar` 组件
4. `Content` 区域右侧留出 60px（导航栏收起宽度）

---

### 1.4 修改样式文件

**文件**: `client/src/styles/main.css`

**在文件末尾添加**:

```css
/* 右侧导航栏样式 */
.right-navbar-container {
  transition: all 0.2s;
}

/* 确保内容区域在导航栏展开时正确适配 */
.app-content-with-navbar {
  transition: margin-right 0.2s;
}

/* 设置页面左侧导航栏样式 */
.settings-left-nav {
  height: 100%;
  border-right: 1px solid #f0f0f0;
}

.settings-left-nav .ant-menu-item {
  margin: 0;
  border-radius: 0;
}

/* 设置页面内容区域 */
.settings-content {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  background-color: #fff;
}
```

---

## 🎯 Phase 2: 帮助页面实现

### 2.1 创建帮助页面

**文件**: `client/src/pages/Help/index.tsx`

```typescript
import React from 'react'
import { Layout, Card, Typography, Button, Divider, Space } from 'antd'
import { InfoCircleOutlined, RocketOutlined } from '@ant-design/icons'
import PageHeader from '../../components/Common/PageHeader'

const { Content } = Layout
const { Title, Paragraph, Text } = Typography

const HelpPage: React.FC = () => {
  const appVersion = '2.1.0' // 从 package.json 读取

  const handleCheckUpdate = () => {
    // 预留：检查更新逻辑
    console.log('Check for updates...')
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <PageHeader title="帮助" />
      <Content style={{ padding: '24px', overflow: 'auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 应用说明 */}
          <Card
            title={
              <>
                <InfoCircleOutlined style={{ marginRight: 8 }} />
                应用说明
              </>
            }
          >
            <Title level={4}>系统概述</Title>
            <Paragraph>
              Research Agent System 是一款基于 AI 的智能研究助手桌面应用。
              通过集成多个学术搜索引擎和大语言模型，帮助用户快速检索、整理和生成研究报告。
            </Paragraph>

            <Divider />

            <Title level={4}>核心功能</Title>
            <ul>
              <li>
                <Text strong>智能对话：</Text>通过 WebSocket 实时与 AI Agent 交互，
                支持 DeepSeek 和 Semantic Scholar 两种模式
              </li>
              <li>
                <Text strong>文献搜索：</Text>自动从 arXiv、Semantic Scholar 等数据库检索相关文献
              </li>
              <li>
                <Text strong>报告生成：</Text>基于检索结果自动生成结构化研究报告（支持 Markdown/PDF 导出）
              </li>
              <li>
                <Text strong>引用管理：</Text>批量下载文献 PDF，按会话分类整理
              </li>
              <li>
                <Text strong>对话历史：</Text>自动保存所有会话记录，支持快速切换查看
              </li>
            </ul>

            <Divider />

            <Title level={4}>使用指南</Title>
            <Paragraph>
              <Text strong>1. 初始化配置</Text>
              <br />
              首次使用前，请在"设置 → 初始化"中配置 HTTP API 和 WebSocket 地址，
              并测试连接确保服务正常运行。
            </Paragraph>
            <Paragraph>
              <Text strong>2. 开始研究</Text>
              <br />
              在主页输入研究问题，系统将自动：
              <ul>
                <li>分析问题并生成搜索策略</li>
                <li>从多个数据源检索相关文献</li>
                <li>整合信息并生成研究报告</li>
              </ul>
            </Paragraph>
            <Paragraph>
              <Text strong>3. 导出结果</Text>
              <br />
              在报告标签页点击"导出 PDF"，或在引用标签页点击"下载引用"批量保存文献。
            </Paragraph>
          </Card>

          {/* 关于 */}
          <Card
            title={
              <>
                <RocketOutlined style={{ marginRight: 8 }} />
                关于
              </>
            }
          >
            <Space direction="vertical" size="middle">
              <div>
                <Text strong>当前版本：</Text>
                <Text>{appVersion}</Text>
              </div>
              <div>
                <Text strong>技术栈：</Text>
                <Text>Electron + React + TypeScript + Ant Design</Text>
              </div>
              <div>
                <Text strong>后端服务：</Text>
                <Text>Python FastAPI + LangChain + MongoDB</Text>
              </div>
              <Divider />
              <Button type="primary" onClick={handleCheckUpdate} disabled>
                检查更新（预留功能）
              </Button>
            </Space>
          </Card>
        </Space>
      </Content>
    </Layout>
  )
}

export default HelpPage
```

**关键点**:
- 使用 `PageHeader` 显示返回按钮
- 卡片式布局展示信息
- 检查更新功能预留（disabled 状态）
- 版本号可从 `package.json` 动态读取

---

## 🎯 Phase 3: 设置页面重构

### 3.1 设置页面主框架

**文件**: `client/src/pages/Settings/index.tsx`

```typescript
import React, { useState } from 'react'
import { Layout, Menu } from 'antd'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  ApiOutlined,
  RobotOutlined,
  FolderOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import PageHeader from '../../components/Common/PageHeader'
import InitializationSettings from './InitializationSettings'
import AgentSettings from './AgentSettings'
import StorageSettings from './StorageSettings'
import ServerSettings from './ServerSettings'

const { Sider, Content } = Layout

const SettingsPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      key: '/settings/initialization',
      icon: <ApiOutlined />,
      label: '初始化',
    },
    {
      key: '/settings/agent',
      icon: <RobotOutlined />,
      label: 'Agent 参数',
    },
    {
      key: '/settings/storage',
      icon: <FolderOutlined />,
      label: '本地存储',
    },
    {
      key: '/settings/server',
      icon: <ToolOutlined />,
      label: '服务器高级设置',
    },
  ]

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key)
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <PageHeader title="设置" />
      <Layout style={{ flex: 1 }}>
        {/* 左侧导航 */}
        <Sider width={200} theme="light" className="settings-left-nav">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>

        {/* 右侧内容区 */}
        <Content className="settings-content">
          <Routes>
            <Route path="/" element={<Navigate to="initialization" replace />} />
            <Route path="initialization" element={<InitializationSettings />} />
            <Route path="agent" element={<AgentSettings />} />
            <Route path="storage" element={<StorageSettings />} />
            <Route path="server" element={<ServerSettings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default SettingsPage
```

**关键点**:
- 左侧导航宽度 200px
- 使用嵌套路由 `/settings/*`
- 默认重定向到 `initialization`
- 动态高亮当前路由

---

### 3.2 初始化设置页面

**文件**: `client/src/pages/Settings/InitializationSettings.tsx`

```typescript
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
```

---

### 3.3 Agent 参数设置页面

**文件**: `client/src/pages/Settings/AgentSettings.tsx`

```typescript
import React, { useEffect, useState } from 'react'
import { Form, Input, Button, Space, message, Divider } from 'antd'
import { useAppStore } from '../../stores/app'
import { listPrompts, setPrompt } from '../../services/api'

const { TextArea } = Input

const AgentSettings: React.FC = () => {
  const { config, updateConfig, saveConfigToFile } = useAppStore()
  const [form] = Form.useForm()
  const [promptsForm] = Form.useForm()
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [savingPrompts, setSavingPrompts] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      openAIBaseUrl: config.openAIBaseUrl || '',
      openAIApiKey: config.openAIApiKey || '',
      semanticApiKey: config.semanticApiKey || '',
    })
  }, [config, form])

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    setLoadingPrompts(true)
    try {
      const prompts = await listPrompts()
      promptsForm.setFieldsValue({
        deepseek: prompts.deepseek || '',
        semantic_scholar: prompts.semantic_scholar || '',
        report_writing: prompts.report_writing || '',
      })
      message.success('提示词配置已加载')
    } catch (err) {
      message.error(`加载提示词失败: ${(err as Error).message}`)
    } finally {
      setLoadingPrompts(false)
    }
  }

  const handleSavePrompts = async () => {
    setSavingPrompts(true)
    try {
      const values = await promptsForm.validateFields()
      await Promise.all([
        setPrompt('deepseek', values.deepseek),
        setPrompt('semantic_scholar', values.semantic_scholar),
        setPrompt('report_writing', values.report_writing),
      ])
      message.success('提示词配置已保存')
    } catch (err) {
      message.error(`保存提示词失败: ${(err as Error).message}`)
    } finally {
      setSavingPrompts(false)
    }
  }

  const handleSaveApiConfig = async () => {
    try {
      const values = await form.validateFields()
      updateConfig({
        openAIBaseUrl: values.openAIBaseUrl,
        openAIApiKey: values.openAIApiKey,
        semanticApiKey: values.semanticApiKey,
      })
      await saveConfigToFile()
      message.success('API 配置已保存')
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`)
    }
  }

  return (
    <div>
      <h2>API 配置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="OpenAI Base URL"
          name="openAIBaseUrl"
          tooltip="用于连接 OpenAI API 或兼容服务的基础 URL"
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item
          label="OpenAI API Key"
          name="openAIApiKey"
          tooltip="用于身份验证的 API 密钥"
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item
          label="Semantic Scholar API Key"
          name="semanticApiKey"
          tooltip="用于访问 Semantic Scholar API 的密钥"
        >
          <Input placeholder="输入 Semantic Scholar API Key" />
        </Form.Item>
      </Form>
      <Space>
        <Button type="primary" onClick={handleSaveApiConfig}>
          保存 API 配置
        </Button>
      </Space>

      <Divider />

      <h2>提示词配置</h2>
      <Form form={promptsForm} layout="vertical">
        <Form.Item
          label="DeepSeek 查询提示词"
          name="deepseek"
          tooltip="用于 DeepSeek 学术搜索代理的系统提示词"
        >
          <TextArea
            rows={8}
            placeholder="输入 DeepSeek 系统提示词..."
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            disabled={loadingPrompts}
          />
        </Form.Item>
        <Form.Item
          label="Semantic Scholar 查询提示词"
          name="semantic_scholar"
          tooltip="用于 Semantic Scholar 搜索代理的系统提示词"
        >
          <TextArea
            rows={8}
            placeholder="输入 Semantic Scholar 系统提示词..."
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            disabled={loadingPrompts}
          />
        </Form.Item>
        <Form.Item
          label="报告生成提示词"
          name="report_writing"
          tooltip="用于研究报告生成的系统提示词"
        >
          <TextArea
            rows={8}
            placeholder="输入报告撰写系统提示词..."
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            disabled={loadingPrompts}
          />
        </Form.Item>
      </Form>
      <Space>
        <Button onClick={loadPrompts} disabled={loadingPrompts} loading={loadingPrompts}>
          重新加载
        </Button>
        <Button type="primary" onClick={handleSavePrompts} loading={savingPrompts}>
          保存提示词
        </Button>
      </Space>
    </div>
  )
}

export default AgentSettings
```

---

### 3.4 本地存储设置页面

**文件**: `client/src/pages/Settings/StorageSettings.tsx`

```typescript
import React, { useEffect } from 'react'
import { Form, Input, Button, message } from 'antd'
import { useAppStore } from '../../stores/app'

const StorageSettings: React.FC = () => {
  const { config, updateConfig, saveConfigToFile } = useAppStore()
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      exportDirectory: config.exportDirectory,
    })
  }, [config, form])

  const handleSelectDirectory = async () => {
    try {
      const dir = await window.electronAPI?.selectExportDirectory?.()
      if (dir) {
        form.setFieldsValue({ exportDirectory: dir })
      }
    } catch (err) {
      // ignore
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      updateConfig({
        exportDirectory: values.exportDirectory,
      })
      await saveConfigToFile()
      message.success('存储设置已保存')
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`)
    }
  }

  return (
    <div>
      <h2>本地存储设置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="导出目录"
          name="exportDirectory"
          rules={[{ required: true, message: '请选择导出目录' }]}
          tooltip="报告和引用文件将导出到此目录"
        >
          <Input
            placeholder="选择导出目录或手动输入"
            addonAfter={<Button onClick={handleSelectDirectory}>选择</Button>}
          />
        </Form.Item>
      </Form>
      <Button type="primary" onClick={handleSave}>
        保存配置
      </Button>
    </div>
  )
}

export default StorageSettings
```

---

### 3.5 服务器高级设置页面

**文件**: `client/src/pages/Settings/ServerSettings.tsx`

```typescript
import React, { useEffect } from 'react'
import { Form, Input, InputNumber, Button, Space, message, Alert } from 'antd'
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
```

---

### 3.6 更新状态管理

**文件**: `client/src/stores/app.ts`

**添加新的配置项**:

```typescript
interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  theme: 'light' | 'dark'
  semanticApiKey?: string
  // 新增 OpenAI 配置
  openAIBaseUrl?: string
  openAIApiKey?: string
  // 新增 MongoDB 配置
  mongoConfig?: {
    host: string
    port: number
    database: string
    username?: string
    password?: string
  }
  // 新增服务器端口
  serverPort?: number
  // 部署配置
  deployment?: {
    registry: string
    imageName: string
    composeFile: string
    workingDirectory: string
  }
}
```

**更新默认值**:

```typescript
config: {
  websocketUrl: 'ws://127.0.0.1:8000/chat',
  apiServerUrl: 'http://127.0.0.1:8000/api/v1',
  exportDirectory: '',
  theme: 'light',
  semanticApiKey: '',
  openAIBaseUrl: '',
  openAIApiKey: '',
  mongoConfig: {
    host: 'localhost',
    port: 27017,
    database: 'research_agent',
  },
  serverPort: 8000,
  deployment: {
    registry: 'sidawater',
    imageName: 'research-service',
    composeFile: 'docker-compose.yml',
    workingDirectory: 'd:/proj/research-agent-system',
  },
},
```

---

### 3.7 删除旧 SettingsModal

**操作**: 删除文件 `client/src/components/Settings/SettingsModal.tsx`

---

## 🎯 Phase 4: 完善细节

### 4.1 修改 Home 页面

**文件**: `client/src/pages/Home.tsx`

**移除顶部导航按钮** (如果 Header 中有设置按钮，需要移除):

```typescript
// 保持现有代码不变
// Home 页面不需要修改，继续使用完整的布局
```

---

### 4.2 更新 Header 组件

**文件**: `client/src/components/Layout/Header.tsx`

**移除设置按钮** (如果存在):

```typescript
// 检查 Header.tsx，移除任何打开设置 Modal 的按钮
// 因为设置现在通过右侧导航栏访问
```

---

### 4.3 响应式布局调整

**更新 App.tsx 的内容区域宽度**:

```typescript
// 根据导航栏展开/收起状态动态调整
// 可使用状态提升或 Context 共享导航栏状态

import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import Home from './pages/Home'
import SettingsPage from './pages/Settings'
import HelpPage from './pages/Help'
import RightNavbar from './components/Navigation/RightNavbar'
import { useAppStore } from './stores/app'

const { Content } = Layout

const App: React.FC = () => {
  const loadConfigFromFile = useAppStore((state) => state.loadConfigFromFile)
  const [navbarWidth, setNavbarWidth] = useState(60) // 默认收起宽度

  useEffect(() => {
    loadConfigFromFile()
  }, [])

  return (
    <Layout style={{ height: '100vh', position: 'relative' }}>
      <Content
        style={{
          marginRight: `${navbarWidth}px`,
          transition: 'margin-right 0.2s',
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/settings/*" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </Content>

      <RightNavbar onWidthChange={setNavbarWidth} />
    </Layout>
  )
}

export default App
```

**更新 RightNavbar 传递宽度**:

```typescript
// 在 RightNavbar 组件中添加 onWidthChange 回调
interface RightNavbarProps {
  onWidthChange?: (width: number) => void
}

const RightNavbar: React.FC<RightNavbarProps> = ({ onWidthChange }) => {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(collapsed ? 60 : 120)
    }
  }, [collapsed, onWidthChange])

  // ... rest of the component
}
```

---

## 🎯 Phase 5: 测试与优化

### 5.1 功能测试清单

- [ ] **路由跳转**
  - [ ] 主页 → 设置 → 主页
  - [ ] 主页 → 帮助 → 主页
  - [ ] 设置内部子路由切换
  - [ ] 返回按钮功能
  - [ ] 浏览器前进/后退按钮

- [ ] **导航栏**
  - [ ] 默认收起状态
  - [ ] 展开/收起动画
  - [ ] 当前路由高亮
  - [ ] 内容区域自动适配宽度

- [ ] **设置页面**
  - [ ] 初始化配置保存
  - [ ] 测试连接功能
  - [ ] Docker 部署功能
  - [ ] API 配置保存
  - [ ] 提示词加载/保存
  - [ ] 导出目录选择
  - [ ] 服务器配置保存

- [ ] **帮助页面**
  - [ ] 内容正确显示
  - [ ] 版本号正确
  - [ ] 检查更新按钮 disabled

- [ ] **配置持久化**
  - [ ] 刷新后配置保留
  - [ ] Electron 环境配置文件读写
  - [ ] localStorage 同步

### 5.2 样式优化

- [ ] 导航栏 hover 效果
- [ ] 页面切换过渡动画
- [ ] 表单布局统一
- [ ] 响应式适配（不同屏幕尺寸）
- [ ] 深色主题兼容（如果需要）

### 5.3 性能优化

- [ ] 路由懒加载（如果需要）
  ```typescript
  const SettingsPage = React.lazy(() => import('./pages/Settings'))
  const HelpPage = React.lazy(() => import('./pages/Help'))
  ```
- [ ] 防抖/节流（表单提交等）
- [ ] 提示词加载缓存

---

## 📝 开发注意事项

### 1. Electron 环境兼容
- 使用 HashRouter 而非 BrowserRouter
- 配置文件路径使用 userData 目录
- IPC 通信需检查 API 可用性

### 2. 配置管理
- 所有配置统一通过 `useAppStore` 管理
- 保存时同时更新状态和文件
- 新增配置项需更新 TypeScript 接口

### 3. 中文国际化
- 所有界面文字使用中文
- 提示信息、错误信息统一中文
- 预留国际化接口（未来支持多语言）

### 4. 错误处理
- 所有异步操作添加 try-catch
- 用户友好的错误提示
- 关键操作添加确认弹窗

### 5. 代码规范
- 组件命名使用 PascalCase
- 文件名与组件名一致
- 导出使用 default export
- Props 类型定义使用 interface

---

## 🚀 部署与构建

### 开发环境运行
```bash
cd client
npm run dev
```

### 生产构建
```bash
npm run build
npm run electron:build
npm run package:win
```

### 构建产物
- `dist/` - Vite 构建输出
- `dist-electron/` - Electron 主进程编译输出
- `release/` - 最终安装包

---

## 📊 进度跟踪

| 阶段 | 任务 | 状态 |
|------|------|------|
| Phase 1 | 右侧导航栏组件 | ⏳ 待开发 |
| Phase 1 | PageHeader 组件 | ⏳ 待开发 |
| Phase 1 | App.tsx 路由配置 | ⏳ 待开发 |
| Phase 1 | 样式文件更新 | ⏳ 待开发 |
| Phase 2 | 帮助页面 | ⏳ 待开发 |
| Phase 3 | 设置页主框架 | ⏳ 待开发 |
| Phase 3 | 初始化设置页 | ⏳ 待开发 |
| Phase 3 | Agent 设置页 | ⏳ 待开发 |
| Phase 3 | 存储设置页 | ⏳ 待开发 |
| Phase 3 | 服务器设置页 | ⏳ 待开发 |
| Phase 3 | 状态管理更新 | ⏳ 待开发 |
| Phase 3 | 删除旧 SettingsModal | ⏳ 待开发 |
| Phase 4 | 响应式布局 | ⏳ 待开发 |
| Phase 5 | 功能测试 | ⏳ 待开发 |
| Phase 5 | 样式优化 | ⏳ 待开发 |

---

## 🔗 相关文档

- [Ant Design Menu 组件](https://ant.design/components/menu-cn)
- [React Router v6 文档](https://reactrouter.com/en/main)
- [Electron IPC 通信](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Zustand 状态管理](https://github.com/pmndrs/zustand)

---

**文档版本**: 1.0  
**创建时间**: 2025-11-02  
**最后更新**: 2025-11-02
