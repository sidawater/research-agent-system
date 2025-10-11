import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '../../../stores/chat'
import type { ChatMessage } from '../../../stores/chat'
import { useResearchStore } from '../../../stores/research'
import { Button, Input, List, Typography, Space, message, Segmented } from 'antd'
import { useWebSocket } from '@/hooks/useWebSocket'
import MessageRenderer from './MessageRenderer'
import ActionStatus from './ActionStatus'
import { useAppStore } from '@/stores/app'

const ChatTab: React.FC = () => {
  const { messages } = useChatStore()
  const { phase } = useResearchStore()
  const { sendQuery, confirmAndGenerate } = useWebSocket()
  const [inputValue, setInputValue] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const { mode, setMode } = useAppStore()

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!inputValue.trim()) return
    sendQuery(inputValue.trim())
    setInputValue('')
  }

  const handleConfirmAndGenerateReport = () => {
    if (phase !== 'confirming') {
      message.warning('当前阶段不可生成报告')
      return
    }
    confirmAndGenerate()
    message.info('已确认，开始生成报告')
  }

  const handleExport = async () => {
    const { currentReport, references } = useResearchStore.getState()
    if (!currentReport) {
      message.warning('暂无可导出的报告')
      return
    }
    const result = await window.electronAPI?.exportReport?.({
      reportContent: currentReport,
      references,
      title: `研究报告_${new Date().toLocaleDateString()}`,
    })
    if (!result?.success) {
      message.error('导出失败')
    } else {
      message.success('导出成功')
    }
  }

  const handleDownloadReferences = async () => {
    const { references, downloadAllReferences } = useResearchStore.getState()
    const { currentSession } = useAppStore.getState()

    if (!references || references.length === 0) {
      message.warning('No references available to download')
      return
    }

    if (!currentSession) {
      message.warning('No active session')
      return
    }

    message.loading({ content: 'Downloading references (direct & open access)...', key: 'download-ref' })

    try {
      const result = await downloadAllReferences({ concurrency: 3 })
      const summaryMsg = `Downloaded ${result.successCount}, failed ${result.failCount}.`
      const { currentSession, config } = useAppStore.getState()
      const sessionPrefix = String(currentSession || '').substring(0, 8)
      const now = new Date()
      const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      message.success({ 
        content: (
          <div>
            <div>{summaryMsg}</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Saved in {config.exportDirectory}/{sessionPrefix}_{yyyymmdd}/
            </div>
          </div>
        ),
        key: 'download-ref', 
        duration: 5 
      })
    } catch (err) {
      message.error({ content: `Download error: ${(err as Error).message}`, key: 'download-ref' })
    }
  }

  // Memoize render function to prevent unnecessary re-renders
  const renderMessage = useCallback((item: ChatMessage) => (
    <List.Item 
      key={item.id} 
      style={{ 
        display: 'block',
        width: '100%',
        maxWidth: '100%'
      }}
    >
      <Typography.Text strong={item.type === 'user'}>
        {item.type === 'user' ? '你' : item.type === 'error' ? '系统' : '助手'}:
      </Typography.Text>
      <div style={{ marginTop: 4, width: '100%' }}>
        <MessageRenderer message={item} />
      </div>
    </List.Item>
  ), [])

  // Adjust layout: scrollable message area, fixed input area at bottom
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div 
        ref={listRef} 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          border: '1px solid #eee', 
          padding: 8,
          minHeight: 0
        }}
      >
        <ActionStatus />
        <List
          itemLayout="vertical"
          dataSource={messages}
          renderItem={renderMessage}
        />
      </div>

      <div 
        style={{ 
          flex: '0 0 auto',
          height: '200px',
          display: 'flex', 
          flexDirection: 'column', 
          background: '#fff', 
          padding: '12px 16px',
          borderTop: '1px solid #f0f0f0'
        }}
      >
        {/* 模式切换控件 */}
        <div style={{ marginBottom: 8 }}>
          <Space>
            <Segmented
              options={[
                { label: 'Semantic', value: 'semantic' },
                { label: 'DeepSeek', value: 'deepseek' },
              ]}
              value={mode}
              onChange={(v) => setMode(v as 'semantic' | 'deepseek')}
            />
          </Space>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入你的问题或指令..."
            style={{ width: '100%', height: '100%', resize: 'none' }}
          />
        </div>

        <div style={{ marginTop: 8, flex: '0 0 auto' }}>
          <Space size={50}>
            <Button type="primary" onClick={handleSend}>发送</Button>
            <Button onClick={handleConfirmAndGenerateReport} disabled={phase !== 'confirming'}>参考文献合格</Button>
            <Button onClick={handleDownloadReferences}>下载文献</Button>
            <Button onClick={handleExport}>导出报告</Button>
          </Space>
        </div>
      </div>
    </div>
  )
}

export default ChatTab