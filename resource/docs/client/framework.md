# 研究助手应用架构设计

## 1. 构建架构 (Electron + React + TypeScript + Ant Design)

### 项目结构更新
```text
research-assistant/
├── electron/                    # Electron 主进程代码
│   ├── main.ts                 # 主进程入口 (TypeScript)
│   ├── preload.ts              # 预加载脚本 (TypeScript)
│   ├── ipc-handlers.ts         # IPC 通信处理
│   └── types/                  # Electron 类型定义
├── src/                        # React 渲染进程代码
│   ├── main.tsx                # React 应用入口
│   ├── App.tsx                 # 根组件
│   ├── components/             # 通用组件
│   │   ├── Layout/
│   │   ├── MainArea/
│   │   └── Settings/
│   ├── pages/                  # 页面组件 (替代 views)
│   │   └── Home.tsx
│   ├── stores/                 # Zustand 状态管理
│   │   ├── app.ts
│   │   ├── research.ts
│   │   └── chat.ts
│   ├── hooks/                  # React 自定义 Hooks
│   │   ├── useWebSocket.ts
│   │   ├── useConfig.ts
│   │   └── useResearch.ts
│   ├── types/                  # TypeScript 类型定义
│   ├── utils/                  # 工具函数
│   ├── styles/                 # 全局样式
│   └── themes/                 # 主题配置
│       ├── light.ts
│       ├── dark.ts
│       └── antd-theme.ts
├── public/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── electron-builder.json
```

### 技术栈配置更新

#### package.json 核心依赖
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.15.0",
    "zustand": "^4.4.0",
    "antd": "^5.8.0",
    "@ant-design/icons": "^5.2.0",
    "ahooks": "^3.7.0",
    "electron": "^22.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^4.4.0",
    "@vitejs/plugin-react": "^4.1.0",
    "electron-builder": "^24.0.0",
    "concurrently": "^8.0.0",
    "rimraf": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

#### Vite 配置更新 (vite.config.ts)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron')
    }
  },
  server: {
    port: 3000
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        modifyVars: {
          // 自定义 Ant Design 主题变量
          '@primary-color': '#4299e1',
        },
      },
    },
  },
})
```

## 2. React 组件架构

### 应用入口 (src/main.tsx)
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { useThemeStore } from './stores/app'
import { themeConfig } from './themes/antd-theme'
import './styles/main.css'

const Root = () => {
  const { theme } = useThemeStore()

  return (
    <React.StrictMode>
      <ConfigProvider theme={themeConfig[theme]}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
```

### 根组件 (src/App.tsx)
```typescript
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import Home from './pages/Home'
import { useAppStore } from './stores/app'
import SettingsModal from './components/Settings/SettingsModal'

const { Content } = Layout

const App: React.FC = () => {
  const { settingsVisible } = useAppStore()

  return (
    <>
      <Layout style={{ height: '100vh' }}>
        <Content>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* 可以添加更多路由 */}
          </Routes>
        </Content>
      </Layout>
      <SettingsModal open={settingsVisible} />
    </>
  )
}

export default App
```

### 状态管理 (Zustand Stores)

#### 应用状态 (src/stores/app.ts)
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  // 主题
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  
  // 设置弹窗
  settingsVisible: boolean
  showSettings: () => void
  hideSettings: () => void
  
  // 连接状态
  connectionStatus: 'disconnected' | 'connecting' | 'connected'
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void
  
  // 当前会话
  currentSession: string | null
  setCurrentSession: (session: string | null) => void
  
  // 应用配置
  config: AppConfig
  updateConfig: (config: Partial<AppConfig>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      
      settingsVisible: false,
      showSettings: () => set({ settingsVisible: true }),
      hideSettings: () => set({ settingsVisible: false }),
      
      connectionStatus: 'disconnected',
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      
      currentSession: null,
      setCurrentSession: (session) => set({ currentSession: session }),
      
      config: {
        websocketUrl: 'ws://localhost:8080',
        apiServerUrl: 'http://127.0.0.1:8000',
        exportDirectory: '',
        theme: 'light'
      },
      updateConfig: (newConfig) => 
        set((state) => ({ config: { ...state.config, ...newConfig } }))
    }),
    {
      name: 'app-storage'
    }
  )
)
```

### 主页面组件 (src/pages/Home.tsx)
```typescript
import React from 'react'
import { Layout } from 'antd'
import AppHeader from '../components/Layout/Header'
import Sidebar from '../components/Layout/Sidebar'
import MainArea from '../components/MainArea/MainArea'
import AppFooter from '../components/Layout/Footer'

const { Content } = Layout

const Home: React.FC = () => {
  return (
    <Layout style={{ height: '100vh' }}>
      <AppHeader />
      <Layout>
        <Sidebar />
        <Content style={{ padding: 0, backgroundColor: '#f5f5f5' }}>
          <MainArea />
        </Content>
      </Layout>
      <AppFooter />
    </Layout>
  )
}

export default Home
```

### 布局组件 (React + Ant Design)

#### Header 组件 (src/components/Layout/Header.tsx)
```typescript
import React from 'react'
import { Layout, Button, Space, Typography, Tag, Tooltip } from 'antd'
import { 
  SettingOutlined, 
  QuestionCircleOutlined,
  ExperimentOutlined 
} from '@ant-design/icons'
import { useAppStore } from '../../stores/app'

const { Header } = Layout
const { Title } = Typography

const AppHeader: React.FC = () => {
  const { 
    currentSession, 
    connectionStatus, 
    showSettings,
    theme,
    setTheme 
  } = useAppStore()

  const connectionStatusConfig = {
    disconnected: { color: 'red', text: '未连接' },
    connecting: { color: 'orange', text: '连接中...' },
    connected: { color: 'green', text: '已连接' }
  }

  const statusConfig = connectionStatusConfig[connectionStatus]

  return (
    <Header 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0 16px',
        background: theme === 'light' ? '#fff' : '#001529'
      }}
    >
      <Space>
        <ExperimentOutlined style={{ fontSize: '24px', color: '#4299e1' }} />
        <Title level={4} style={{ margin: 0, color: theme === 'light' ? '#000' : '#fff' }}>
          研究助手
        </Title>
        <Tag color="blue">{currentSession || '新对话'}</Tag>
      </Space>

      <Space>
        <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
        
        <Tooltip title="切换主题">
          <Button 
            icon={theme === 'light' ? '🌙' : '☀️'} 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
        </Tooltip>
        
        <Tooltip title="设置">
          <Button 
            icon={<SettingOutlined />} 
            onClick={showSettings}
          />
        </Tooltip>
        
        <Tooltip title="帮助">
          <Button icon={<QuestionCircleOutlined />} />
        </Tooltip>
      </Space>
    </Header>
  )
}

export default AppHeader
```

#### Sidebar 组件 (src/components/Layout/Sidebar.tsx)
```typescript
import React, { useState } from 'react'
import { Layout, Menu, Button, Space } from 'antd'
import { 
  MenuFoldOutlined, 
  MenuUnfoldOutlined,
  MessageOutlined,
  FileTextOutlined 
} from '@ant-design/icons'
import { useAppStore } from '../../stores/app'

const { Sider } = Layout

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const { theme } = useAppStore()

  const conversations = [
    { key: 'new', icon: <MessageOutlined />, label: '新对话' },
    { key: '1', icon: <FileTextOutlined />, label: '人工智能研究' },
    { key: '2', icon: <FileTextOutlined />, label: '机器学习综述' }
  ]

  return (
    <Sider 
      trigger={null} 
      collapsible 
      collapsed={collapsed}
      width={260}
      style={{
        background: theme === 'light' ? '#fff' : '#001529'
      }}
    >
      <div style={{ 
        padding: '16px', 
        borderBottom: `1px solid ${theme === 'light' ? '#f0f0f0' : '#303030'}` 
      }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          {!collapsed && <span style={{ fontWeight: 'bold' }}>研究记录</span>}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </Space>
      </div>

      <Menu
        mode="inline"
        selectedKeys={['new']}
        items={conversations}
        style={{ 
          border: 'none',
          background: 'transparent'
        }}
      />
    </Sider>
  )
}

export default Sidebar
```

#### MainArea 组件 (src/components/MainArea/MainArea.tsx)
```typescript
import React from 'react'
import { Layout, Tabs } from 'antd'
import DisplayZone from './DisplayZone'
import InfoZone from './InfoZone'

const { Content, Sider } = Layout

const MainArea: React.FC = () => {
  return (
    <Layout style={{ height: '100%' }}>
      <Content style={{ padding: 0 }}>
        <DisplayZone />
      </Content>
      <Sider 
        width={320} 
        style={{ 
          background: '#fff',
          borderLeft: '1px solid #f0f0f0'
        }}
      >
        <InfoZone />
      </Sider>
    </Layout>
  )
}

export default MainArea
```

#### DisplayZone 组件 (src/components/MainArea/DisplayZone.tsx)
```typescript
import React, { useState } from 'react'
import { Tabs } from 'antd'
import { MessageOutlined, FileTextOutlined, BookOutlined } from '@ant-design/icons'
import ChatTab from './tabs/ChatTab'
import ReportTab from './tabs/ReportTab'
import ReferencesTab from './tabs/ReferencesTab'

const { TabPane } = Tabs

const DisplayZone: React.FC = () => {
  const [activeTab, setActiveTab] = useState('chat')

  const tabs = [
    {
      key: 'chat',
      label: (
        <span>
          <MessageOutlined />
          研究过程
        </span>
      ),
      children: <ChatTab />
    },
    {
      key: 'report',
      label: (
        <span>
          <FileTextOutlined />
          报告预览
        </span>
      ),
      children: <ReportTab />
    },
    {
      key: 'references',
      label: (
        <span>
          <BookOutlined />
          文献预览
        </span>
      ),
      children: <ReferencesTab />
    }
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
        items={tabs}
      />
    </div>
  )
}

export default DisplayZone
```

#### ChatTab 组件 (src/components/MainArea/tabs/ChatTab.tsx)
```typescript
import React, { useState, useRef, useEffect } from 'react'
import { 
  Input, 
  Button, 
  List, 
  Avatar, 
  Space, 
  Typography,
  Card 
} from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons'
import { useChatStore } from '../../../stores/chat'

const { TextArea } = Input
const { Text } = Typography

const ChatTab: React.FC = () => {
  const [inputMessage, setInputMessage] = useState('')
  const { messages, sendMessage, loading } = useChatStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (inputMessage.trim()) {
      sendMessage(inputMessage)
      setInputMessage('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <List
          dataSource={messages}
          renderItem={(message) => (
            <List.Item style={{ border: 'none', padding: '8px 0' }}>
              <Space align="start" style={{ width: '100%' }}>
                <Avatar 
                  icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  style={{ 
                    background: message.role === 'user' ? '#1890ff' : '#52c41a' 
                  }}
                />
                <Card 
                  size="small"
                  style={{ 
                    maxWidth: '70%',
                    background: message.role === 'user' ? '#f0f8ff' : '#f6ffed'
                  }}
                >
                  <Text>{message.content}</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </Text>
                  </div>
                </Card>
              </Space>
            </List.Item>
          )}
        />
        <div ref={messagesEndRef} />
      </div>
      
      <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0' }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的研究问题..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <Button 
            type="primary" 
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </Space.Compact>
      </div>
    </div>
  )
}

export default ChatTab
```

#### InfoZone 组件 (src/components/MainArea/InfoZone.tsx)
```typescript
import React from 'react'
import { Card, Progress, List, Typography, Space, Tag } from 'antd'
import { FileTextOutlined, BookOutlined } from '@ant-design/icons'
import { useResearchStore } from '../../stores/research'

const { Title, Text } = Typography

const InfoZone: React.FC = () => {
  const { researchProgress, references } = useResearchStore()

  const referenceData = [
    { id: 1, title: '深度学习研究综述', authors: '张三, 李四', year: 2023 },
    { id: 2, title: '神经网络架构优化', authors: '王五', year: 2022 }
  ]

  return (
    <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 研究报告概览 */}
        <Card size="small" title="研究报告" extra={<FileTextOutlined />}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>当前研究主题</Text>
            <Text type="secondary">人工智能技术发展</Text>
            
            <div style={{ marginTop: 16 }}>
              <Text>完成进度</Text>
              <Progress percent={researchProgress} size="small" />
            </div>
            
            <Space>
              <Tag>字数: 0</Tag>
              <Tag>引用: {references.length}</Tag>
            </Space>
          </Space>
        </Card>

        {/* 参考文献 */}
        <Card 
          size="small" 
          title={`参考文献 (${referenceData.length})`} 
          extra={<BookOutlined />}
        >
          <List
            size="small"
            dataSource={referenceData}
            renderItem={(item) => (
              <List.Item>
                <div>
                  <Text strong style={{ fontSize: '12px' }}>
                    {item.title}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {item.authors} ({item.year})
                  </Text>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </div>
  )
}

export default InfoZone
```

#### Footer 组件 (src/components/Layout/Footer.tsx)
```typescript
import React from 'react'
import { Layout, Space, Progress, Typography } from 'antd'
import { useAppStore } from '../../stores/app'

const { Footer: AntFooter } = Layout
const { Text } = Typography

const AppFooter: React.FC = () => {
  const { connectionStatus, researchProgress } = useAppStore()

  const statusMessages = {
    disconnected: '未连接到服务器',
    connecting: '正在连接服务器...',
    connected: '服务器连接正常'
  }

  return (
    <AntFooter style={{ 
      padding: '8px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: '#f0f2f5'
    }}>
      <Space>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {statusMessages[connectionStatus]}
        </Text>
      </Space>

      <Space>
        <Progress 
          percent={researchProgress} 
          size="small" 
          style={{ width: 120 }}
          showInfo={false}
        />
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {researchProgress}%
        </Text>
      </Space>

      <Text type="secondary" style={{ fontSize: '12px' }}>
        v1.0.0
      </Text>
    </AntFooter>
  )
}

export default AppFooter
```

#### 设置模态框 (src/components/Settings/SettingsModal.tsx)

```typescript
import React from 'react'
import { 
  Modal, 
  Form, 
  Input, 
  Button, 
  Select, 
  Space, 
  Tabs,
  message 
} from 'antd'
import { FolderOpenOutlined, WifiOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/app'

const { Option } = Select
const { TabPane } = Tabs

interface SettingsModalProps {
  open: boolean
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open }) => {
  const [form] = Form.useForm()
  const { hideSettings, config, updateConfig } = useAppStore()

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      updateConfig(values)
      message.success('设置保存成功')
      hideSettings()
    } catch (error) {
      message.error('设置验证失败')
    }
  }

  const handleSelectDirectory = () => {
    // 调用 Electron API 选择目录
    console.log('选择目录')
  }

  const handleTestConnection = () => {
    message.info('测试连接功能开发中...')
  }

  return (
    <Modal
      title="设置"
      open={open}
      onCancel={hideSettings}
      onOk={handleOk}
      width={600}
      footer={[
        <Button key="test" onClick={handleTestConnection} icon={<WifiOutlined />}>
          测试连接
        </Button>,
        <Button key="cancel" onClick={hideSettings}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          保存
        </Button>
      ]}
    >
      <Tabs defaultActiveKey="general">
        <TabPane tab="通用设置" key="general">
          <Form
            form={form}
            layout="vertical"
            initialValues={config}
          >
            <Form.Item
              name="apiServerUrl"
              label="HTTP API 地址"
              rules={[{ required: true, message: '请输入 API 服务器地址' }]}
            >
              <Input placeholder="http://127.0.0.1:8000" />
            </Form.Item>

            <Form.Item
              name="websocketUrl"
              label="WebSocket 地址"
              rules={[{ required: true, message: '请输入 WebSocket 地址' }]}
            >
              <Input placeholder="ws://localhost:8080" />
            </Form.Item>

            <Form.Item
              name="exportDirectory"
              label="导出目录"
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input 
                  placeholder="选择文件导出目录" 
                  readOnly 
                />
                <Button 
                  icon={<FolderOpenOutlined />} 
                  onClick={handleSelectDirectory}
                >
                  选择
                </Button>
              </Space.Compact>
            </Form.Item>

            <Form.Item
              name="theme"
              label="主题"
            >
              <Select>
                <Option value="light">浅色主题</Option>
                <Option value="dark">深色主题</Option>
              </Select>
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab="Agent 配置" key="agent">
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p>Agent 配置功能开发中...</p>
          </div>
        </TabPane>

        <TabPane tab="MCP 服务" key="mcp">
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p>MCP 服务配置功能开发中...</p>
          </div>
        </TabPane>
      </Tabs>
    </Modal>
  )
}

export default SettingsModal
```

### 主题配置 (src/themes/antd-theme.ts)

```typescript
import { ThemeConfig } from 'antd'

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#4299e1',
    colorBgBase: '#ffffff',
    colorTextBase: '#2d3748',
    borderRadius: 6,
  },
  components: {
    Layout: {
      bodyBg: '#ffffff',
      headerBg: '#ffffff',
      siderBg: '#f8f9fa'
    }
  }
}

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#63b3ed',
    colorBgBase: '#1a202c',
    colorTextBase: '#f7fafc',
    borderRadius: 6,
  },
  components: {
    Layout: {
      bodyBg: '#1a202c',
      headerBg: '#1a202c',
      siderBg: '#2d3748'
    }
  }
}

export const themeConfig = {
  light: lightTheme,
  dark: darkTheme
}
```

### 自定义 Hooks

#### WebSocket Hook (src/hooks/useWebSocket.ts)

```typescript
import { useState, useEffect, useCallback } from 'react'
import { message } from 'antd'
import { useAppStore } from '../stores/app'

export const useWebSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const { config, setConnectionStatus } = useAppStore()

  const connect = useCallback(() => {
    try {
      setConnectionStatus('connecting')
      const ws = new WebSocket(config.websocketUrl)
      
      ws.onopen = () => {
        setConnectionStatus('connected')
        message.success('WebSocket 连接成功')
      }
      
      ws.onclose = () => {
        setConnectionStatus('disconnected')
        message.warning('WebSocket 连接断开')
      }
      
      ws.onerror = (error) => {
        setConnectionStatus('disconnected')
        message.error('WebSocket 连接错误')
        console.error('WebSocket error:', error)
      }
      
      setSocket(ws)
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      setConnectionStatus('disconnected')
    }
  }, [config.websocketUrl, setConnectionStatus])

  const disconnect = useCallback(() => {
    if (socket) {
      socket.close()
      setSocket(null)
      setConnectionStatus('disconnected')
    }
  }, [socket, setConnectionStatus])

  const sendMessage = useCallback((data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data))
    } else {
      message.error('WebSocket 未连接')
    }
  }, [socket])

  useEffect(() => {
    if (config.websocketUrl) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [config.websocketUrl])

  return {
    socket,
    connect,
    disconnect,
    sendMessage
  }
}
```