import React, { useState, useEffect } from 'react'
import { Tabs } from 'antd'
import { MessageOutlined, FileTextOutlined, BookOutlined } from '@ant-design/icons'
import ChatTab from './tabs/ChatTab'
import ReportTab from './tabs/ReportTab'
import ReferencesTab from './tabs/ReferencesTab'
import { useResearchStore } from '../../stores/research'

const DisplayZone: React.FC = () => {
  const [activeTab, setActiveTab] = useState('chat')
  const { selectedReference } = useResearchStore()

  // Auto switch to references tab when a reference is selected
  useEffect(() => {
    if (selectedReference) {
      setActiveTab('references')
    }
  }, [selectedReference])

  const tabs = [
    {
      key: 'chat',
      label: (
        <span>
          <MessageOutlined /> 研究过程
        </span>
      ),
      children: <ChatTab />,
    },
    {
      key: 'report',
      label: (
        <span>
          <FileTextOutlined /> 报告预览
        </span>
      ),
      children: <ReportTab />,
    },
    {
      key: 'references',
      label: (
        <span>
          <BookOutlined /> 文献详情
        </span>
      ),
      children: <ReferencesTab />,
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabs}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        className="display-zone-tabs"
      />
    </div>
  )
}

export default DisplayZone