import { create } from 'zustand'

export type MessageType = 'user' | 'action' | 'content' | 'ref' | 'references' | 'report' | 'error' | 'code'

export interface ChatMessage {
  id: string
  type: MessageType
  content: string
  timestamp: number
  shouldMerge: boolean
}

interface ChatState {
  messages: ChatMessage[]
  loading: boolean
  lastMessageType: MessageType | null
  lastMessageTimestamp: number | null
  addUserMessage: (content: string) => void
  addServerMessage: (type: Exclude<MessageType, 'user'>, content: string) => void
  replaceActionMessage: (content: string) => void
  clearActionMessage: () => void
  // 新增：直接设置消息列表（用于加载历史会话或清空）
  setMessages: (msgs: ChatMessage[]) => void
}

function shouldMerge(prev: ChatMessage | undefined, currentType: MessageType, now: number) {
  if (!prev) return false
  if (prev.type !== currentType) return false
  if (currentType === 'action' || currentType === 'references' || currentType === 'report' || currentType === 'user' || currentType === 'code') return false
  // within 30s window
  return now - prev.timestamp <= 30_000
}

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  loading: false,
  lastMessageType: null,
  lastMessageTimestamp: null,

  addUserMessage: (content: string) => {
    const now = Date.now()
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content,
      timestamp: now,
      shouldMerge: false,
    }
    set((state) => ({ messages: [...state.messages, msg], loading: true, lastMessageType: 'user', lastMessageTimestamp: now }))
  },

  addServerMessage: (type, content) => {
    const now = Date.now()
    const prev = get().messages[get().messages.length - 1]
    if (shouldMerge(prev, type as MessageType, now)) {
      set((state) => {
        const merged = { ...prev!, content: prev!.content + '\n' + content, timestamp: now, shouldMerge: true }
        const next = state.messages.slice(0, -1).concat(merged)
        return { messages: next, loading: type === 'error' ? false : state.loading, lastMessageType: type as MessageType, lastMessageTimestamp: now }
      })
    } else {
      const msg: ChatMessage = { id: crypto.randomUUID(), type: type as MessageType, content, timestamp: now, shouldMerge: false }
      set((state) => ({ messages: [...state.messages, msg], loading: type === 'error' ? false : state.loading, lastMessageType: type as MessageType, lastMessageTimestamp: now }))
    }
    // Stop loading once we get any server content except ongoing action
    if (type === 'content' || type === 'ref' || type === 'references' || type === 'report' || type === 'error' || type === 'code') {
      set({ loading: false })
    }
  },

  replaceActionMessage: (content: string) => {
    const now = Date.now()
    set((state) => {
      const last = state.messages[state.messages.length - 1]
      if (last && last.type === 'action') {
        const replaced = { ...last, content, timestamp: now }
        const next = state.messages.slice(0, -1).concat(replaced)
        return { messages: next, lastMessageType: 'action', lastMessageTimestamp: now }
      }
      const msg: ChatMessage = { id: crypto.randomUUID(), type: 'action', content, timestamp: now, shouldMerge: false }
      return { messages: [...state.messages, msg], lastMessageType: 'action', lastMessageTimestamp: now }
    })
  },

  clearActionMessage: () => {
    set((state) => {
      const last = state.messages[state.messages.length - 1]
      if (last && last.type === 'action') {
        const next = state.messages.slice(0, -1)
        return { messages: next, lastMessageType: null, lastMessageTimestamp: null }
      }
      return state
    })
  },

  // 新增：直接设置消息列表
  setMessages: (msgs: ChatMessage[]) => {
    const last = msgs[msgs.length - 1] || null
    set({
      messages: msgs,
      loading: false,
      lastMessageType: last ? last.type : null,
      lastMessageTimestamp: last ? last.timestamp : null,
    })
  },
}))