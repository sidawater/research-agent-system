import { useAppStore } from '@/stores/app'

export interface ServerChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string | number
}

export interface AcademicSearchResult {
  results?: any[]
  references?: any[]
  items?: any[]
  [key: string]: any
}

export interface ConversationHistory {
  session_id: string
  session_name?: string
  research_state?: {
    query?: string
    academic_search_result?: AcademicSearchResult
    final_report?: string
  }
  created_at?: string
  updated_at?: string
  messages?: ServerChatMessage[]
}

function getApiBase(): string {
  const base = useAppStore.getState().config.apiServerUrl || ''
  return base.replace(/\/$/, '')
}

async function jsonGet<T>(path: string): Promise<T> {
  const url = `${getApiBase()}${path}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

async function jsonPost<T>(path: string, data: any): Promise<T> {
  const url = `${getApiBase()}${path}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

export async function getHealth(): Promise<void> {
  await jsonGet('/health')
}

export async function listHistory(): Promise<ConversationHistory[]> {
  return jsonGet('/history')
}

export async function getHistory(sessionId: string): Promise<ConversationHistory> {
  return jsonGet(`/history/${encodeURIComponent(sessionId)}`)
}

export async function updateHistory(sessionId: string, document: Partial<ConversationHistory>): Promise<any> {
  return jsonPost(`/history/${encodeURIComponent(sessionId)}`, document)
}

export async function listPrompts(): Promise<Record<string, string>> {
  return jsonGet('/prompts')
}

export async function getPrompt(key: string): Promise<string> {
  return jsonGet(`/prompts/${encodeURIComponent(key)}`)
}

export async function setPrompt(key: string, prompt: string): Promise<any> {
  const url = `${getApiBase()}/prompts/${encodeURIComponent(key)}?prompt=${encodeURIComponent(prompt)}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}