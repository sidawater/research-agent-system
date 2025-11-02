import React from 'react'
import { Layout } from 'antd'
import DisplayZone from './DisplayZone'
import InfoZone from './InfoZone'

const { Content, Sider } = Layout

const MainArea: React.FC = () => {
  return (
    <Layout style={{ height: '100%', overflow: 'hidden' }}>
      <Content style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <DisplayZone />
      </Content>
      <Sider
        width={320}
        style={{
          background: '#fff',
          borderLeft: '1px solid #f0f0f0',
          maxWidth: '30%',
          overflow: 'hidden',
          height: '100%',
        }}
      >
        <InfoZone />
      </Sider>
    </Layout>
  )
}

export default MainArea