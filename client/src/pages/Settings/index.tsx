import React from 'react'
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
