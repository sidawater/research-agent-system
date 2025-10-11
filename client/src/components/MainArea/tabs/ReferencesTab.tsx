import React, { useState } from 'react'
import { Descriptions, Typography, Empty, Card, Input, Button, Collapse, Space, message, Timeline, Tag } from 'antd'
import { LinkOutlined, FileOutlined, CloseOutlined, DownloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { useResearchStore } from '../../../stores/research'
import type { DownloadLog } from '../../../stores/research'

const { Text, Link } = Typography
const { TextArea } = Input

const ReferencesTab: React.FC = () => {
  const { selectedReference, setSelectedReference, downloadReference } = useResearchStore()
  const [downloading, setDownloading] = useState(false)

  if (!selectedReference) {
    return (
      <div style={{ padding: 24, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="请从右侧参考文献列表中选择一篇文献查看详情" />
      </div>
    )
  }

  const ref = selectedReference
  const url = ref.url || ref.URL
  const doi = ref.doi || ref.DOI
  const abstract = ref.abstract || ref.summary || ref.description
  const authors = Array.isArray(ref.authors) ? ref.authors.join(', ') : (ref.authors || '作者未知')
  
  // Keys that are explicitly displayed in the UI
  const displayedKeys = [
    'id', 'title', 'authors', 'year', 'url', 'URL', 'doi', 'DOI',
    'abstract', 'summary', 'description', 'citation', 'downloadStatus',
    'downloadSource', 'filepath', 'local_file', 'errorMessage', 'orderIndex'
  ]
  
  // Other fields not explicitly displayed
  const otherFields = Object.entries(ref)
    .filter(([key]) => !displayedKeys.includes(key))
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
  
  // Handle single reference download
  const handleDownload = async () => {
    if (!ref.id && !ref.title) {
      message.error('Cannot download: reference has no ID or title')
      return
    }
    
    setDownloading(true)
    try {
      const refId = ref.id ?? ref.title ?? ''
      await downloadReference(refId)
      message.success('Download completed')
    } catch (error) {
      message.error('Download failed: ' + String(error))
    } finally {
      setDownloading(false)
    }
  }
  
  // Download status display
  const getDownloadStatusText = () => {
    switch (ref.downloadStatus) {
      case 'success':
        return <Text type="success">已下载</Text>
      case 'failed':
        return <Text type="danger">下载失败</Text>
      case 'pending':
        return <Text type="warning">下载中...</Text>
      case 'skipped':
        return <Text type="secondary">已跳过</Text>
      default:
        return <Text type="secondary">未下载</Text>
    }
  }

  // Render download logs
  const renderDownloadLogs = () => {
    const logs = ref.downloadLogs || []
    if (logs.length === 0) return null

    const getLogIcon = (status: DownloadLog['status']) => {
      switch (status) {
        case 'success':
          return <CheckCircleOutlined style={{ color: '#52c41a' }} />
        case 'error':
          return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
        case 'warning':
          return <WarningOutlined style={{ color: '#faad14' }} />
        case 'info':
        default:
          return <InfoCircleOutlined style={{ color: '#1890ff' }} />
      }
    }

    const getLogColor = (status: DownloadLog['status']) => {
      switch (status) {
        case 'success':
          return 'green'
        case 'error':
          return 'red'
        case 'warning':
          return 'orange'
        case 'info':
        default:
          return 'blue'
      }
    }

    return (
      <Timeline
        mode="left"
        items={logs.map((log, idx) => ({
          key: idx,
          dot: getLogIcon(log.status),
          color: getLogColor(log.status),
          label: (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {new Date(log.timestamp).toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </Text>
          ),
          children: (
            <div>
              <div style={{ marginBottom: 4 }}>
                <Tag color={getLogColor(log.status)} style={{ marginRight: 8 }}>
                  {log.step}
                </Tag>
                <Text>{log.message}</Text>
              </div>
              {log.details && (
                <div style={{ marginTop: 8 }}>
                  <pre style={{
                    backgroundColor: '#f5f5f5',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    margin: 0,
                    maxHeight: '150px',
                    overflow: 'auto',
                    fontFamily: 'Monaco, Consolas, monospace'
                  }}>
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )
        }))}
      />
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <Card 
        bordered
        title="参考文献详情"
        extra={
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => setSelectedReference(null)}
          >
            关闭
          </Button>
        }
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题">
            <Text strong>{ref.title || '未命名文献'}</Text>
          </Descriptions.Item>
          
          <Descriptions.Item label="作者">
            <Text>{authors}</Text>
          </Descriptions.Item>
          
          {ref.year && (
            <Descriptions.Item label="年份">
              <Text>{ref.year}</Text>
            </Descriptions.Item>
          )}
          
          {doi && (
            <Descriptions.Item label="DOI">
              {doi.startsWith('http') ? (
                <Link href={doi} target="_blank" rel="noreferrer">
                  <LinkOutlined /> {doi}
                </Link>
              ) : (
                <Link href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
                  <LinkOutlined /> {doi}
                </Link>
              )}
            </Descriptions.Item>
          )}
          
          {url && (
            <Descriptions.Item label="URL">
              <Link href={url} target="_blank" rel="noreferrer">
                <LinkOutlined /> {url}
              </Link>
            </Descriptions.Item>
          )}
          
          {abstract && (
            <Descriptions.Item label="摘要">
              <TextArea 
                value={abstract} 
                readOnly 
                autoSize={{ minRows: 3, maxRows: 10 }}
                style={{ 
                  border: 'none', 
                  padding: 0, 
                  resize: 'none',
                  backgroundColor: 'transparent'
                }}
              />
            </Descriptions.Item>
          )}
          
          {ref.citation && (
            <Descriptions.Item label="引用内容">
              <TextArea 
                value={ref.citation} 
                readOnly 
                autoSize={{ minRows: 2, maxRows: 8 }}
                style={{ 
                  border: 'none', 
                  padding: 0, 
                  resize: 'none',
                  backgroundColor: 'transparent'
                }}
              />
            </Descriptions.Item>
          )}
          
          <Descriptions.Item label="下载状态">
            <Space>
              {getDownloadStatusText()}
              {ref.downloadSource && (
                <Text type="secondary">(来源: {ref.downloadSource})</Text>
              )}
              {(!ref.downloadStatus || ref.downloadStatus === 'failed') && (
                <Button
                  type="primary"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  loading={downloading}
                >
                  下载
                </Button>
              )}
            </Space>
          </Descriptions.Item>
          
          {ref.filepath && (
            <Descriptions.Item label="文件路径">
              <Text copyable>
                <FileOutlined /> {ref.filepath}
              </Text>
            </Descriptions.Item>
          )}
          
          {ref.local_file && (
            <Descriptions.Item label="本地文件">
              <Text copyable>
                <FileOutlined /> {ref.local_file}
              </Text>
            </Descriptions.Item>
          )}
          
          {ref.errorMessage && (
            <Descriptions.Item label="错误信息">
              <TextArea
                value={ref.errorMessage}
                readOnly
                autoSize={{ minRows: 2, maxRows: 15 }}
                style={{
                  color: '#ff4d4f',
                  border: '1px solid #ffccc7',
                  backgroundColor: '#fff2f0',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              />
            </Descriptions.Item>
          )}
          
          {ref.downloadLogs && ref.downloadLogs.length > 0 && (
            <Descriptions.Item label="下载日志">
              <div style={{ 
                maxHeight: '500px', 
                overflowY: 'auto',
                padding: '12px',
                backgroundColor: '#fafafa',
                borderRadius: '4px'
              }}>
                {renderDownloadLogs()}
              </div>
            </Descriptions.Item>
          )}
          
          {otherFields.length > 0 && (
            <Descriptions.Item label="其他字段">
              <Collapse
                size="small"
                items={[
                  {
                    key: 'other-fields',
                    label: `显示 ${otherFields.length} 个其他字段`,
                    children: (
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {otherFields.map(([key, value]) => (
                          <div key={key} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <Text strong style={{ display: 'block', marginBottom: 4 }}>{key}:</Text>
                            <Text
                              copyable
                              style={{
                                display: 'block',
                                wordBreak: 'break-all',
                                whiteSpace: 'pre-wrap',
                                fontFamily: typeof value === 'object' ? 'monospace' : 'inherit',
                                fontSize: '12px'
                              }}
                            >
                              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )
                  }
                ]}
              />
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    </div>
  )
}

export default ReferencesTab