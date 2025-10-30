import React from 'react'
import { Layout, Button, Space, Typography, Tag, Tooltip } from 'antd'
import { SettingOutlined, QuestionCircleOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/app'

const { Header } = Layout
const { Title } = Typography

const AppHeader: React.FC = () => {
  const { connectionStatus, showSettings, theme, setTheme } = useAppStore()

  const connectionStatusConfig: Record<string, { color: string; text: string }> = {
    disconnected: { color: 'red', text: '未连接' },
    connecting: { color: 'orange', text: '连接中...' },
    connected: { color: 'green', text: '已连接' },
  }

  const statusConfig = connectionStatusConfig[connectionStatus]

  return (
    <Header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        background: theme === 'light' ? '#fff' : '#001529',
      }}
    >
      <Space>
        <ExperimentOutlined style={{ fontSize: '24px', color: '#4299e1' }} />
        <Title level={4} style={{ margin: 0, color: theme === 'light' ? '#000' : '#fff' }}>
          研究助手
        </Title>
        <Tag color="blue" style={{ fontSize: '12px' }}>v2.1.0</Tag>
      </Space>

      <Space>
        <Tag color={statusConfig.color}>{statusConfig.text}</Tag>

        <Tooltip title="切换主题">
          <Button icon={theme === 'light' ? '🌙' : '☀️'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
        </Tooltip>

        <Tooltip title="设置">
          <Button icon={<SettingOutlined />} onClick={showSettings} />
        </Tooltip>

        <Tooltip title="帮助">
          <Button icon={<QuestionCircleOutlined />} />
        </Tooltip>
      </Space>
    </Header>
  )
}

export default AppHeader