import React from 'react'
import { Card, Progress, List, Typography, Space, Tag, Empty, Badge } from 'antd'
import { FileTextOutlined, BookOutlined } from '@ant-design/icons'
import { useResearchStore } from '../../stores/research'
import type { ReferenceItem } from '../../stores/research'
import { useChatStore } from '../../stores/chat'
import { useAppStore } from '../../stores/app'

const { Text } = Typography

// Utility function to truncate text
const truncateText = (text: string | undefined, maxLen = 20): string => {
  const str = String(text || '')
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

// Utility function to format authors
const formatAuthors = (authors: string | string[] | undefined): string => {
  if (Array.isArray(authors)) {
    return authors.join(', ')
  }
  return String(authors || '作者未知')
}

// Get download status badge color
const getStatusBadgeColor = (status?: 'pending' | 'success' | 'failed' | 'skipped'): string => {
  switch (status) {
    case 'success':
      return '#52c41a'
    case 'failed':
      return '#ff4d4f'
    case 'pending':
      return '#1890ff'
    default:
      return 'transparent'
  }
}

const InfoZone: React.FC = () => {
  const { researchProgress, references, setSelectedReference } = useResearchStore()
  const { messages } = useChatStore()
  const { currentSession } = useAppStore()

  const topicFromContent = messages.find((m) => m.type === 'content' && m.content.startsWith('研究课题:'))
  const topicFromUser = messages.find((m) => m.type === 'user')
  const topic = (topicFromContent?.content?.replace(/^研究课题:\s*/, '') || topicFromUser?.content || '未设置').trim()

  const reportChars = references.reduce((sum, ref) => sum + (ref.abstract?.length || 0), 0)

  const handleReferenceClick = (ref: ReferenceItem) => {
    setSelectedReference(ref)
  }

  // Top info area (30%) + bottom reference area (70%)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 30%', padding: '16px', overflow: 'auto', borderBottom: '1px solid #f0f0f0' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small" title="研究报告" extra={<FileTextOutlined />}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>当前会话</Text>
              <Text type="secondary">{currentSession || '未设置'}</Text>

              <Text strong style={{ marginTop: 8 }}>当前研究主题</Text>
              <Text type="secondary">{topic}</Text>

              <div style={{ marginTop: 16 }}>
                <Text>完成进度</Text>
                <Progress percent={researchProgress} size="small" />
              </div>

              <Space>
                <Tag>字数: {reportChars}</Tag>
                <Tag>引用: {references.length}</Tag>
              </Space>
            </Space>
          </Card>
        </Space>
      </div>

      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', minHeight: 0 }}>
        <Card size="small" title={`参考文献 (${references.length})`} extra={<BookOutlined />}>
          {(!references || references.length === 0) ? (
            <Empty description="暂无参考文献" />
          ) : (
            <List
              dataSource={references}
              renderItem={(ref: ReferenceItem) => {
                const title = truncateText(ref.title, 20)
                const authors = truncateText(formatAuthors(ref.authors), 20)
                const abstract = truncateText(ref.abstract || ref.summary || ref.description, 20)
                const badgeColor = getStatusBadgeColor(ref.downloadStatus)
                
                return (
                  <List.Item
                    style={{ 
                      cursor: 'pointer',
                      padding: '12px 0',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    onClick={() => handleReferenceClick(ref)}
                  >
                    <div style={{ width: '100%', paddingRight: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text strong style={{ fontSize: '14px', flex: 1 }}>{title}</Text>
                        <Badge 
                          color={badgeColor} 
                          status={badgeColor === 'transparent' ? undefined : 'processing'}
                          style={{ 
                            position: 'absolute',
                            top: '12px',
                            right: '0px',
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>{authors}</Text>
                      </div>
                      {abstract && abstract !== '未知' && (
                        <div style={{ marginTop: '4px' }}>
                          <Text type="secondary" style={{ fontSize: '12px', color: '#8c8c8c' }}>{abstract}</Text>
                        </div>
                      )}
                    </div>
                  </List.Item>
                )
              }}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

export default InfoZone