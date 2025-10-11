import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import Home from './pages/Home'
import SettingsModal from './components/Settings/SettingsModal'
import { useAppStore } from './stores/app'

const { Content } = Layout

const App: React.FC = () => {
  const loadConfigFromFile = useAppStore((state) => state.loadConfigFromFile)

  useEffect(() => {
    // Load config from file on app startup
    loadConfigFromFile()
  }, [])

  return (
    <>
      <Layout style={{ height: '100vh' }}>
        <Content>
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </Content>
      </Layout>
      <SettingsModal />
    </>
  )
}

export default App
