import React, { useEffect, useState, createContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from 'antd'
import Home from './pages/Home'
import SettingsPage from './pages/Settings/index'
import HelpPage from './pages/Help.tsx' // Import with explicit .tsx extension
import LeftNavbar from './components/Navigation/LeftNavbar'
import TitleBar from './components/Layout/TitleBar'
import { useAppStore } from './stores/app'

const { Content } = Layout

// Create context for sharing leftNavbarWidth
export const LeftNavbarContext = createContext(0);

const App: React.FC = () => {
  const loadConfigFromFile = useAppStore((state) => state.loadConfigFromFile)
  const [leftNavbarWidth, setLeftNavbarWidth] = useState(60) // Default collapsed width

  useEffect(() => {
    // Load config from file on app startup
    loadConfigFromFile()
  }, [])

  return (
    <LeftNavbarContext.Provider value={leftNavbarWidth}>
      <Layout style={{ height: '100vh', position: 'relative' }}>
        {/* 左侧导航栏 */}
        <LeftNavbar onWidthChange={setLeftNavbarWidth} />
        
        {/* 主内容区域 */}
        <Layout style={{ marginLeft: leftNavbarWidth }}>
          {/* TitleBar moved to be part of main content */}
          <TitleBar />
          
          <Content
            style={{
              height: 'calc(100vh - 40px)', // Account for TitleBar height
              marginTop: '5px', // TitleBar height
              overflow: 'hidden', // Prevent scrolling
            }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/settings/*" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </LeftNavbarContext.Provider>
  )
}

export default App