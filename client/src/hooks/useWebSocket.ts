import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/stores/app'
import { useChatStore } from '@/stores/chat'
import { useResearchStore } from '@/stores/research'

export type ServerMessageType = 'action' | 'content' | 'ref' | 'references' | 'report' | 'error' | 'code'

interface ServerMessage {
  type: ServerMessageType
  data: any
}

interface ClientMessage {
  session_id: string
  query?: string
  need_export?: boolean
  search_results_satisfactory?: boolean
  report_satisfactory?: boolean
  // 新增：模式字段
  mode?: 'deepseek' | 'semantic'
}

function parseActionAndUpdatePhase(action: string): { phase?: 'idle' | 'searching' | 'confirming' | 'generating' | 'completed'; progress?: number } {
  const lower = action.toLowerCase()
  // Heuristics based on action content
  if (lower.includes('academic_search') && (lower.includes('开始') || lower.includes('start'))) {
    return { phase: 'searching', progress: 10 }
  }
  if (lower.includes('academic_search') && (lower.includes('完成') || lower.includes('complete'))) {
    return { phase: 'confirming', progress: 50 }
  }
  if (lower.includes('write_report') && (lower.includes('开始') || lower.includes('start'))) {
    return { phase: 'generating', progress: 70 }
  }
  if (lower.includes('write_report') && (lower.includes('完成') || lower.includes('complete'))) {
    return { phase: 'completed', progress: 100 }
  }
  return {}
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const connectingRef = useRef<boolean>(false)
  const pendingQueueRef = useRef<string[]>([])
  const idleTimerRef = useRef<number | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const { config, connectionStatus, setConnectionStatus, currentSession } = useAppStore()
  const { addUserMessage, addServerMessage, replaceActionMessage, clearActionMessage } = useChatStore()
  const { setPhase, setResearchProgress, setReferences, setCurrentReport } = useResearchStore()

  const attachHandlers = useCallback((ws: WebSocket) => {
    ws.onopen = () => {
      setConnectionStatus('connected')
      // No automatic messages sent on connection - wait for user action
      
      // flush pending messages
      while (pendingQueueRef.current.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = pendingQueueRef.current.shift()!
        ws.send(msg)
      }
      lastActivityRef.current = Date.now()
      // start idle watcher
      if (idleTimerRef.current) clearInterval(idleTimerRef.current)
      idleTimerRef.current = window.setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const idle = Date.now() - lastActivityRef.current
          if (idle >= IDLE_TIMEOUT_MS) {
            wsRef.current.close()
            setConnectionStatus('disconnected')
            addServerMessage('action', '【连接】空闲超过5分钟，已断开.')
            clearInterval(idleTimerRef.current!)
            idleTimerRef.current = null
          }
        }
      }, 30_000)
      connectingRef.current = false
    }

    ws.onmessage = (evt) => {
      lastActivityRef.current = Date.now()
      try {
        const msg: ServerMessage = JSON.parse(evt.data)
        switch (msg.type) {
          case 'action': {
            const actionText = String(msg.data).trim()
            replaceActionMessage(actionText)
            const { phase, progress } = parseActionAndUpdatePhase(actionText)
            if (phase) setPhase(phase)
            if (typeof progress === 'number') setResearchProgress(progress)
            break
          }
          case 'content': {
            clearActionMessage()
            addServerMessage('content', String(msg.data).trim())
            break
          }
          case 'ref': {
            clearActionMessage()
            addServerMessage('ref', String(msg.data).trim())
            break
          }
          case 'code': {
            clearActionMessage()
            addServerMessage('code', String(msg.data).trim())
            break
          }
          case 'references': {
            clearActionMessage()
            const refs = msg.data as any
            const normalized = Array.isArray(refs)
              ? refs
              : Array.isArray(refs?.results)
              ? refs.results
              : Array.isArray(refs?.references)
              ? refs.references
              : Array.isArray(refs?.items)
              ? refs.items
              : []
            setReferences(normalized)
            const count = normalized.length
            const refMsg = count > 0 
              ? `已接收 ${count} 篇参考文献，请在右侧查看详情` 
              : '未找到参考文献，请尝试修改查询'
            addServerMessage('references', refMsg)
            setPhase('confirming')
            setResearchProgress(60)
            break
          }
          case 'report': {
            const reportContent = String(msg.data).trim()
            setCurrentReport(reportContent)
            addServerMessage('report', '[报告生成完成]')
            setPhase('completed')
            setResearchProgress(100)
            break
          }
          case 'error': {
            addServerMessage('error', String(msg.data).trim())
            break
          }
          default: {
            addServerMessage('content', String(msg.data).trim())
          }
        }
      } catch (e) {
        addServerMessage('error', '消息解析错误')
      }
    }

    ws.onerror = () => {
      setConnectionStatus('disconnected')
      addServerMessage('error', 'WebSocket连接错误')
      connectingRef.current = false
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current)
        idleTimerRef.current = null
      }
      connectingRef.current = false
    }
  }, [addServerMessage, clearActionMessage, replaceActionMessage, setConnectionStatus, setPhase, setResearchProgress, setReferences, setCurrentReport])

  // Connect websocket only when websocketUrl and currentSession exist
  useEffect(() => {
    if (!config.websocketUrl || !currentSession) return

    setConnectionStatus('connecting')
    const ws = new WebSocket(config.websocketUrl)
    wsRef.current = ws
    attachHandlers(ws)

    return () => {
      try { ws.close() } catch {}
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current)
        idleTimerRef.current = null
      }
      connectingRef.current = false
    }
  }, [config.websocketUrl, currentSession, setConnectionStatus, setPhase, setResearchProgress, setReferences, setCurrentReport, attachHandlers])

  const sendClientMessage = useCallback((payload: Omit<ClientMessage, 'session_id'> & Partial<ClientMessage>) => {
    const ws = wsRef.current
    const sid = useAppStore.getState().currentSession
    if (!sid) return
    const msgStr = JSON.stringify({ session_id: sid, ...payload })
    // if not open, try reconnect and queue
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (!config.websocketUrl || !sid) return
      // start reconnect if not already
      if (!connectingRef.current) {
        setConnectionStatus('connecting')
        connectingRef.current = true
        const newWs = new WebSocket(config.websocketUrl)
        wsRef.current = newWs
        attachHandlers(newWs)
      }
      pendingQueueRef.current.push(msgStr)
      return
    }
    ws.send(msgStr)
    lastActivityRef.current = Date.now()
  }, [attachHandlers, config.websocketUrl, setConnectionStatus])

  const sendQuery = useCallback((query: string) => {
    const m = useAppStore.getState().mode
    addUserMessage(query)
    sendClientMessage({ query, search_results_satisfactory: false, report_satisfactory: false, mode: m })
    setPhase('searching')
  }, [addUserMessage, sendClientMessage, setPhase])

  const confirmAndGenerate = useCallback(() => {
    const m = useAppStore.getState().mode
    addUserMessage('检索结果满意，请生成报告')
    sendClientMessage({ search_results_satisfactory: true, report_satisfactory: false, mode: m })
    setPhase('generating')
  }, [addUserMessage, sendClientMessage, setPhase])

  const markReportSatisfied = useCallback(() => {
    const m = useAppStore.getState().mode
    sendClientMessage({ report_satisfactory: true, mode: m })
    setPhase('completed')
    setResearchProgress(100)
  }, [sendClientMessage, setPhase, setResearchProgress])

  const requestExport = useCallback((need = true) => {
    sendClientMessage({ need_export: need })
  }, [sendClientMessage])

  return {
    connectionStatus,
    sendQuery,
    confirmAndGenerate,
    markReportSatisfied,
    requestExport,
  }
}