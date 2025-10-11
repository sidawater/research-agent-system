import { useAppStore } from '@/stores/app'

const BASE = 'https://api.semanticscholar.org/graph/v1'

// Simple global rate limiter: strictly 1 request per second
let lastRequestTime = 0
let chain: Promise<Response> = Promise.resolve(new Response())
const MIN_INTERVAL_MS = 1000

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  chain = chain.then(async () => {
    const now = Date.now()
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime))
    if (wait > 0) await sleep(wait)
    lastRequestTime = Date.now()

    const apiKey = useAppStore.getState().config?.semanticApiKey || ''
    const mergedHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...(options?.headers as Record<string, string> | undefined ?? {}),
    }
    if (apiKey) {
      mergedHeaders['x-api-key'] = apiKey
    }

    return fetch(url, { ...options, headers: mergedHeaders })
  })

  return chain
}

export async function searchPaperByTitleMatch(title: string, fields: string = 'paperId,title,matchScore,openAccessPdf,url') {
  const url = `${BASE}/paper/search/match?query=${encodeURIComponent(title)}&fields=${encodeURIComponent(fields)}`
  const resp = await rateLimitedFetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json() as Promise<any>
}

export async function searchPapers(query: string, fields: string = 'paperId,title,year,openAccessPdf,url', limit: number = 5) {
  const url = `${BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${encodeURIComponent(fields)}`
  const resp = await rateLimitedFetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json() as Promise<any>
}