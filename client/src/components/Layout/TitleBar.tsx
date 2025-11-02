import React, { useEffect, useState } from 'react'
import { Space, Tag, Tooltip, Button } from 'antd'
import { 
  MinusOutlined, 
  BorderOutlined, 
  CloseOutlined,
  ExperimentOutlined 
} from '@ant-design/icons'
import { useAppStore } from '../../stores/app'

const TitleBar: React.FC = () => {
  const { connectionStatus, theme, setTheme } = useAppStore()
  const [isMaximized, setIsMaximized] = useState(false)

  const connectionStatusConfig: Record<string, { color: string; text: string }> = {
    disconnected: { color: 'red', text: '未连接' },
    connecting: { color: 'orange', text: '连接中...' },
    connected: { color: 'green', text: '已连接' },
  }

  const statusConfig = connectionStatusConfig[connectionStatus]

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.electronAPI?.windowIsMaximized?.()
      setIsMaximized(maximized || false)
    }
    checkMaximized()
  }, [])

  const handleMinimize = () => {
    window.electronAPI?.windowMinimize?.()
  }

  const handleMaximize = async () => {
    await window.electronAPI?.windowMaximize?.()
    const maximized = await window.electronAPI?.windowIsMaximized?.()
    setIsMaximized(maximized || false)
  }

  const handleClose = () => {
    window.electronAPI?.windowClose?.()
  }

  return (
    <div
      style={{
        height: '40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        background: theme === 'light' ? '#fff' : '#001529',
        borderBottom: '1px solid ' + (theme === 'light' ? '#e8e8e8' : '#303030'),
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      } as React.CSSProperties}
    >
      {/* Left side - App info */}
      <Space style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <ExperimentOutlined style={{ fontSize: '20px', color: '#4299e1' }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: theme === 'light' ? '#000' : '#fff' }}>
          研究助手
        </span>
        <Tag color="blue" style={{ fontSize: '10px' }}>v2.1.0</Tag>
      </Space>

      {/* Middle - Connection status and theme toggle */}
      <Space style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Tag color={statusConfig.color} style={{ fontSize: '12px' }}>{statusConfig.text}</Tag>
        <Tooltip title="切换主题">
          <Button 
            type="text" 
            size="small"
            icon={theme === 'light' ? '🌙' : '☀️'} 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
          />
        </Tooltip>
      </Space>

      {/* Right side - Window controls */}
      <Space size={0} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          onClick={handleMinimize}
          style={{ color: theme === 'light' ? '#000' : '#fff' }}
        />
        <Button
          type="text"
          size="small"
          icon={isMaximized ? <BorderOutlined style={{ transform: 'rotate(180deg)' }} /> : <BorderOutlined />}
          onClick={handleMaximize}
          style={{ color: theme === 'light' ? '#000' : '#fff' }}
        />
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleClose}
          style={{ color: theme === 'light' ? '#000' : '#fff' }}
          danger
        />
      </Space>
    </div>
  )
}

export default TitleBar