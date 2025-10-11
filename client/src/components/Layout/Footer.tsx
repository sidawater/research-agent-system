import React from 'react'
import { Layout, Space, Progress, Typography } from 'antd'
import { useAppStore } from '../../stores/app'
import { useResearchStore } from '../../stores/research'

const { Footer: AntFooter } = Layout
const { Text } = Typography

const AppFooter: React.FC = () => {
  const { connectionStatus } = useAppStore()
  const { researchProgress } = useResearchStore()

  const statusMessages: Record<'disconnected' | 'connecting' | 'connected', string> = {
    disconnected: '未连接到服务器',
    connecting: '正在连接服务器...',
    connected: '服务器连接正常',
  }

  return (
    <AntFooter
      style={{
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f0f2f5',
      }}
    >
      <Space>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {statusMessages[connectionStatus]}
        </Text>
      </Space>

      <Space>
        <Progress percent={researchProgress} size="small" style={{ width: 120 }} showInfo={false} />
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