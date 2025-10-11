export {}

interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  // 新增：Semantic Scholar API Key
  semanticApiKey?: string
}

declare global {
  interface Window {
    electronAPI?: {
      ping?: () => Promise<string>
      loadConfig?: () => Promise<AppConfig>
      saveConfig?: (config: AppConfig) => Promise<{ success: boolean }>
      selectExportDirectory?: () => Promise<string | null>
      exportReport?: (payload: { title?: string; reportContent: string; references: any[] }) => Promise<{ success: boolean; error?: string; directory?: string; files?: { reportPath: string; refsPath: string } }>
      downloadReference?: (payload: { url: string; title: string; sessionId: string; exportDirectory: string; index: number; doi?: string }) => Promise<{ success: boolean; isPdf: boolean; filepath?: string; errorMessage?: string; statusCode?: number; contentType?: string; finalUrl?: string; redirects?: number }>
      exportReportWithPdf?: (payload: { sessionId: string; title: string; reportContent: string; exportDirectory: string }) => Promise<{ success: boolean; error?: string; directory?: string; files?: { mdPath: string; pdfPath: string } }>
    }
  }
}