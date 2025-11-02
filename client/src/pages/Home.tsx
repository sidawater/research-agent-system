// import React, { useContext } from 'react'
import { Layout } from 'antd'
import Sidebar from '../components/Layout/Sidebar'
import MainArea from '../components/MainArea/MainArea'
import AppFooter from '../components/Layout/Footer'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/app'
// import { LeftNavbarContext } from '../App' // Import the context with correct relative path

const { Content } = Layout

const Home: React.FC = () => {
  // Get the leftNavbarWidth from context
  // const leftNavbarWidth = useContext(LeftNavbarContext);
  
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
    <Layout style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', marginLeft:  5 }}> 
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