import { contextBridge, ipcRenderer } from 'electron'

interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  // 新增：Semantic Scholar API Key
  semanticApiKey?: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  loadConfig: () => ipcRenderer.invoke('load-config') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('save-config', config) as Promise<{ success: boolean }>,
  selectExportDirectory: () => ipcRenderer.invoke('select-export-directory'),
  exportReport: (payload: { title?: string; reportContent: string; references: any[] }) =>
    ipcRenderer.invoke('export-report', payload),
  downloadReference: (payload: { url: string; title: string; sessionId: string; exportDirectory: string; index: number; doi?: string }) =>
    ipcRenderer.invoke('references:download', payload),
  exportReportWithPdf: (payload: { sessionId: string; title: string; reportContent: string; exportDirectory: string }) =>
    ipcRenderer.invoke('export-report-with-pdf', payload),
})