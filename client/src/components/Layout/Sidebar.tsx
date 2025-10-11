import React, { useEffect, useState } from 'react'
import { Layout, Menu, Button, Space, Spin, message, Tooltip } from 'antd'
import { MenuFoldOutlined, MenuUnfoldOutlined, MessageOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/app'
import { useChatStore } from '../../stores/chat'
import type { ChatMessage } from '../../stores/chat'
import { useResearchStore } from '../../stores/research'
import { listHistory, getHistory, type ConversationHistory } from '@/services/api'

const { Sider } = Layout

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const { theme, setCurrentSession } = useAppStore()
  const { setMessages } = useChatStore()
  const { setReferences, setCurrentReport, setPhase } = useResearchStore()
  const [histories, setHistories] = useState<ConversationHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string>('new')

  const loadHistories = async () => {
    try {
      setLoading(true)
      const list = await listHistory()
      setHistories(Array.isArray(list) ? list : [])
    } catch (err) {
      message.error(`加载历史失败: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistories()
  }, [])

  const handleRefresh = async () => {
    message.loading({ content: '刷新中...', key: 'refresh-history' })
    await loadHistories()
    message.success({ content: '刷新成功', key: 'refresh-history', duration: 2 })
  }

  const determineResearchPhase = (conv: ConversationHistory): 'idle' | 'searching' | 'confirming' | 'generating' | 'completed' => {
    const rs = conv?.research_state || {}
    if (rs.final_report) return 'completed'
    if (rs.academic_search_result) return 'confirming'
    if (rs.query) return 'searching'
    return 'idle'
  }

  const normalizeReferences = (res: any): any[] => {
    if (!res) return []
    if (Array.isArray(res)) return res
    if (Array.isArray(res?.results)) return res.results
    if (Array.isArray(res?.references)) return res.references
    if (Array.isArray(res?.items)) return res.items
    return []
  }

  const enterConversation = async (sessionId: string) => {
    try {
      setLoading(true)
      setCurrentSession(sessionId)
      
      const conv = await getHistory(sessionId)

      // messages
      const serverMsgs = conv?.messages || []
      const msgs: ChatMessage[] = (serverMsgs.length > 0
        ? serverMsgs.map((m: any) => ({
            id: crypto.randomUUID(),
            type: m?.role === 'user' ? 'user' : 'content',
            content: String(m?.content ?? ''),
            timestamp: Date.now(),
            shouldMerge: false,
          }))
        : (conv?.research_state?.query
            ? [{ id: crypto.randomUUID(), type: 'content', content: `研究课题: ${conv.research_state.query}`, timestamp: Date.now(), shouldMerge: false }]
            : []))
      setMessages(msgs)

      // references & report
      const refs = normalizeReferences(conv?.research_state?.academic_search_result)
      setReferences(refs)
      setCurrentReport(conv?.research_state?.final_report || '')

      // phase
      setPhase(determineResearchPhase(conv))
    } catch (err) {
      message.error(`进入对话失败: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleMenuClick = async ({ key }: { key: string }) => {
    setSelectedKey(String(key))
    if (key === 'new') {
      const sid = crypto.randomUUID()
      setCurrentSession(sid)
      // 清空所有模块并设置为 idle
      setMessages([])
      setReferences([])
      setCurrentReport('')
      setPhase('idle')
      return
    }
    await enterConversation(String(key))
  }

  // 历史会话按更新时间倒序
  const sortedHistories = [...histories].sort((a, b) => {
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime()
    return tb - ta
  })

  const items = [
    { key: 'new', icon: <MessageOutlined />, label: '新对话' },
    ...sortedHistories.map((h) => ({
      key: h.session_id,
      icon: <FileTextOutlined />,
      label: h.session_name || h.research_state?.query || h.session_id,
    })),
  ]

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={260}
      style={{ 
        background: theme === 'light' ? '#fff' : '#001529', 
        maxWidth: '20%', 
        overflow: 'hidden'
      }}
    >
      <div style={{ padding: '16px', borderBottom: `1px solid ${theme === 'light' ? '#f0f0f0' : '#303030'}` }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          {!collapsed && <span style={{ fontWeight: 'bold' }}>研究记录</span>}
          <Space size={4}>
            {!collapsed && (
              <Tooltip title="刷新列表">
                <Button 
                  type="text" 
                  icon={<ReloadOutlined />} 
                  onClick={handleRefresh}
                  loading={loading}
                  size="small"
                />
              </Tooltip>
            )}
            <Button 
              type="text" 
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
              onClick={() => setCollapsed(!collapsed)} 
            />
          </Space>
        </Space>
      </div>

      <div style={{ height: 'calc(100% - 65px)', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16 }}>
            <Spin />
          </div>
        ) : (
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={items}
            onClick={handleMenuClick as any}
            style={{ border: 'none', background: 'transparent' }}
          />
        )}
      </div>
    </Sider>
  )
}

export default Sidebar
