import React, { useState, useEffect } from 'react'
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

interface LeftNavbarProps {
  onWidthChange?: (width: number) => void
}

const LeftNavbar: React.FC<LeftNavbarProps> = ({ onWidthChange }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(true) // 默认收起

  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(collapsed ? 80 : 120)
    }
  }, [collapsed, onWidthChange])

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
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        backgroundColor: '#001529',
        zIndex: 100,
        width: collapsed ? 60 : 120,
        transition: 'width 0.2s',
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

export default LeftNavbar