import React from 'react'
import { Layout } from 'antd'
import AppHeader from '../components/Layout/Header'
import Sidebar from '../components/Layout/Sidebar'
import MainArea from '../components/MainArea/MainArea'
import AppFooter from '../components/Layout/Footer'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/app'

const { Content } = Layout

const Home: React.FC = () => {
  // Initialize WebSocket connection when Home mounts
  useWebSocket()

  const { currentSession, setCurrentSession } = useAppStore()
  useEffect(() => {
    if (!currentSession) {
      const sid = crypto.randomUUID()
      setCurrentSession(sid)
    }
  }, [currentSession, setCurrentSession])

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader />
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <Content style={{ padding: 0, backgroundColor: '#f5f5f5', overflow: 'hidden' }}>
          <MainArea />
        </Content>
      </Layout>
      <AppFooter />
    </Layout>
  )
}

export default Home