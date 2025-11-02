import { contextBridge, ipcRenderer } from 'electron'

interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  // 新增：Semantic Scholar API Key
  semanticApiKey?: string
  // 新增：部署配置
  deployment?: {
    registry: string
    imageName: string
    composeFile: string
    workingDirectory: string
  }
}

interface DeploymentConfig {
  registry: string
  imageName: string
  composeFile: string
  workingDirectory: string
}

interface DeployProgress {
  step: 'login' | 'pull' | 'update' | 'deploy' | 'health-check' | 'complete' | 'error'
  message: string
  percentage?: number
  details?: string
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
  
  // 新增：部署相关 API
  startDeployment: (payload: {
    credentials: { username: string; password: string }
    version: string
    config: DeploymentConfig
  }) => ipcRenderer.invoke('start-deployment', payload),
  
  checkDockerEnvironment: (config: DeploymentConfig) =>
    ipcRenderer.invoke('check-docker-environment', config),
  
  // 监听部署进度
  onDeployProgress: (callback: (event: any, progress: DeployProgress) => void) => {
    ipcRenderer.on('deploy-progress', callback)
    // 返回取消监听的函数
    return () => ipcRenderer.removeListener('deploy-progress', callback)
  },

  // Window control APIs
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  
  // Developer tools API
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
})