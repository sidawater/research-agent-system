import { create } from 'zustand'
import { searchPaperByTitleMatch, searchPapers, sleep } from '@/services/semanticScholar'
import { useAppStore } from '@/stores/app'

export interface DownloadLog {
  timestamp: string
  step: string
  status: 'info' | 'success' | 'error' | 'warning'
  message: string
  details?: any
}

export interface ReferenceItem {
  id?: string | number
  title?: string
  authors?: string
  year?: number
  url?: string
  URL?: string
  doi?: string
  DOI?: string
  local_file?: string
  [key: string]: any
  downloadStatus?: 'pending' | 'success' | 'failed' | 'skipped'
  downloadSource?: 'direct' | 'semantic_open_access' | null
  filepath?: string | null
  errorMessage?: string | null
  downloadLogs?: DownloadLog[]
}

export type ResearchPhase = 'idle' | 'searching' | 'confirming' | 'generating' | 'completed'

interface ResearchState {
  researchProgress: number
  setResearchProgress: (p: number) => void

  references: ReferenceItem[]
  setReferences: (refs: ReferenceItem[]) => void

  currentReport: string
  setCurrentReport: (r: string) => void

  phase: ResearchPhase
  setPhase: (p: ResearchPhase) => void

  selectedReference: ReferenceItem | null
  setSelectedReference: (ref: ReferenceItem | null) => void

  updateReference: (id: string | number, partial: Partial<ReferenceItem>) => void
  downloadReference: (id: string | number) => Promise<void>
  downloadAllReferences: (opts?: { concurrency?: number }) => Promise<{ successCount: number; failCount: number }>
}

function sanitizeTitle(t: string): string {
  return String(t || 'reference').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)
}

function pickBestWithOpenAccess(items: any[] = [], title: string): any | null {
  const q = String(title || '').toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length >= 3)
  let best: any = null
  let bestScore = -1
  for (const it of items) {
    const t = String(it?.title || '').toLowerCase()
    const hasOA = !!it?.openAccessPdf?.url
    if (!hasOA) continue
    let score = 0
    for (const w of words) {
      if (t.includes(w)) score += 1
    }
    if (t === q) score += 5
    if (score > bestScore) {
      bestScore = score
      best = it
    }
  }
  return best
}

export const useResearchStore = create<ResearchState>()((set, get) => ({
  researchProgress: 0,
  setResearchProgress: (p: number) => set({ researchProgress: p }),

  references: [],
  setReferences: (refs: ReferenceItem[]) => set({ references: refs ?? [] }),
  updateReference: (id: string | number, partial: Partial<ReferenceItem>) => {
    set((state) => ({
      references: (state.references || []).map((r) => {
        const rid = r.id ?? r.title ?? ''
        if (String(rid) === String(id)) {
          return { ...r, ...partial }
        }
        return r
      }),
    }))
  },

  currentReport: '',
  setCurrentReport: (r: string) => set({ currentReport: r ?? '' }),

  phase: 'idle',
  setPhase: (p: ResearchPhase) => set({ phase: p }),

  selectedReference: null,
  setSelectedReference: (ref: ReferenceItem | null) => set({ selectedReference: ref }),

  downloadReference: async (id: string | number) => {
    const state = get()
    const ref = (state.references || []).find((r) => String(r.id ?? r.title ?? '') === String(id))
    if (!ref) return

    const rawTitle = String(ref.title || 'reference')
    const title = sanitizeTitle(rawTitle)
    const directUrl: string | undefined = ref.url || ref.URL

    const { currentSession, config } = useAppStore.getState()
    const sessionId = currentSession || ''
    const exportDirectory = config.exportDirectory || ''
    const index = typeof (ref as any).orderIndex === 'number' ? (ref as any).orderIndex : (state.references || []).findIndex((r) => String(r.id ?? r.title ?? '') === String(id))
    const doi = ref.doi || ref.DOI

    // Helper function to add log entry
    const addLog = (step: string, status: DownloadLog['status'], message: string, details?: any) => {
      const log: DownloadLog = {
        timestamp: new Date().toISOString(),
        step,
        status,
        message,
        details
      }
      const currentRef = get().references.find((r) => String(r.id ?? r.title ?? '') === String(id))
      const existingLogs = currentRef?.downloadLogs || []
      get().updateReference(id, { downloadLogs: [...existingLogs, log] })
    }

    // Mark pending and clear previous logs
    get().updateReference(id, { downloadStatus: 'pending', errorMessage: null, downloadLogs: [] })
    
    addLog('开始下载', 'info', `准备下载参考文献`, {
      title: rawTitle,
      doi: doi || 'N/A',
      directUrl: directUrl || 'N/A',
      sessionId,
      index
    })

    // Step 1: direct URL
    if (directUrl) {
      addLog('直接URL下载', 'info', `尝试通过直接URL下载`, { url: directUrl })
      try {
        const res = await window.electronAPI?.downloadReference?.({ url: directUrl, title, sessionId, exportDirectory, index, doi })
        if (res?.success && res.isPdf && res.filepath) {
          addLog('直接URL下载', 'success', `下载成功`, { 
            filepath: res.filepath,
            source: 'direct'
          })
          get().updateReference(id, { downloadStatus: 'success', downloadSource: 'direct', filepath: res.filepath })
          return
        } else {
          addLog('直接URL下载', 'warning', `直接URL下载失败: ${res?.errorMessage || '未返回PDF'}`, res)
        }
      } catch (err) {
        addLog('直接URL下载', 'error', `直接URL下载异常: ${String(err)}`, { error: err })
      }
    } else {
      addLog('直接URL下载', 'warning', '跳过：未提供直接URL')
    }

    // Step 2: title match via Semantic Scholar
    addLog('Semantic Scholar精确匹配', 'info', '尝试通过标题精确匹配获取OpenAccess链接')
    try {
      await sleep(800)
      const match = await searchPaperByTitleMatch(rawTitle, 'paperId,title,matchScore,openAccessPdf,url')
      const oaUrl = match?.openAccessPdf?.url || match?.data?.openAccessPdf?.url
      
      if (match) {
        addLog('Semantic Scholar精确匹配', 'info', `找到匹配结果`, {
          paperId: match.paperId || match.data?.paperId,
          matchScore: match.matchScore || match.data?.matchScore,
          hasOpenAccess: !!oaUrl
        })
      }
      
      if (oaUrl) {
        addLog('OpenAccess下载', 'info', `找到OpenAccess链接，开始下载`, { url: oaUrl })
        const res2 = await window.electronAPI?.downloadReference?.({ url: oaUrl, title, sessionId, exportDirectory, index, doi })
        if (res2?.success && res2.isPdf && res2.filepath) {
          addLog('OpenAccess下载', 'success', `OpenAccess下载成功`, { 
            filepath: res2.filepath,
            source: 'semantic_scholar'
          })
          get().updateReference(id, { downloadStatus: 'success', downloadSource: 'semantic_open_access', filepath: res2.filepath })
          return
        } else {
          addLog('OpenAccess下载', 'warning', `OpenAccess下载失败: ${res2?.errorMessage || '未返回PDF'}`, res2)
        }
      } else {
        addLog('Semantic Scholar精确匹配', 'warning', '未找到OpenAccess链接')
      }
    } catch (err) {
      addLog('Semantic Scholar精确匹配', 'error', `Semantic Scholar查询异常: ${String(err)}`, { error: err })
    }

    // Step 3: fallback search list
    addLog('Semantic Scholar搜索列表', 'info', '尝试通过搜索列表查找候选文献')
    try {
      await sleep(800)
      const list = await searchPapers(rawTitle, 'paperId,title,year,openAccessPdf,url', 5)
      const items = Array.isArray(list?.data) ? list.data : Array.isArray(list?.results) ? list.results : Array.isArray(list?.items) ? list.items : []
      
      addLog('Semantic Scholar搜索列表', 'info', `获取到 ${items.length} 个候选结果`, { 
        count: items.length,
        candidates: items.map((item: any, idx: number) => ({
          index: idx + 1,
          title: item.title || 'N/A',
          year: item.year || 'N/A',
          hasOpenAccess: !!item?.openAccessPdf?.url,
          openAccessUrl: item?.openAccessPdf?.url || null,
          paperId: item.paperId || null
        }))
      })
      
      const cand = pickBestWithOpenAccess(items, rawTitle)
      const oaUrl2 = cand?.openAccessPdf?.url
      
      if (cand) {
        addLog('Semantic Scholar搜索列表', 'info', `找到最佳候选`, {
          candidateTitle: cand.title,
          hasOpenAccess: !!oaUrl2
        })
      }
      
      if (oaUrl2) {
        addLog('候选文献下载', 'info', `从候选文献下载OpenAccess PDF`, { url: oaUrl2 })
        const res3 = await window.electronAPI?.downloadReference?.({ url: oaUrl2, title, sessionId, exportDirectory, index, doi })
        if (res3?.success && res3.isPdf && res3.filepath) {
          addLog('候选文献下载', 'success', `候选文献下载成功`, { 
            filepath: res3.filepath,
            source: 'semantic_scholar_search'
          })
          get().updateReference(id, { downloadStatus: 'success', downloadSource: 'semantic_open_access', filepath: res3.filepath })
          return
        } else {
          addLog('候选文献下载', 'warning', `候选文献下载失败: ${res3?.errorMessage || '未返回PDF'}`, res3)
        }
      } else {
        addLog('Semantic Scholar搜索列表', 'warning', '未找到具有OpenAccess的候选文献')
      }
    } catch (err) {
      addLog('Semantic Scholar搜索列表', 'error', `搜索列表查询异常: ${String(err)}`, { error: err })
    }

    // Final failure
    const finalError = 'All download attempts failed: no valid PDF source found'
    addLog('下载完成', 'error', finalError)
    get().updateReference(id, { downloadStatus: 'failed', errorMessage: finalError })
  },

  downloadAllReferences: async (opts?: { concurrency?: number }) => {
    const concurrency = Math.max(1, Math.min(4, opts?.concurrency ?? 3))
    const refs = get().references || []
    // Ensure each ref has an id and order index
    const withIds = refs.map((r, idx) => ({ ...r, id: r.id ?? `${idx}-${r.title ?? 'ref'}`, orderIndex: idx }))
    set({ references: withIds })

    let idx = 0
    let successCount = 0
    let failCount = 0

    async function worker() {
      while (true) {
        const i = idx
        idx += 1
        if (i >= withIds.length) break
        const rid = withIds[i].id as string | number
        await get().downloadReference(rid)
        const updated = get().references.find((r) => String(r.id) === String(rid))
        if (updated?.downloadStatus === 'success') successCount += 1
        else if (updated?.downloadStatus === 'failed') failCount += 1
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker())
    await Promise.all(workers)

    return { successCount, failCount }
  },
}))