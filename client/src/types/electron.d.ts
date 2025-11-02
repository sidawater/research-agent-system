export {}

interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  // Semantic Scholar API Key
  semanticApiKey?: string
  // OpenAI 配置
  openAIBaseUrl?: string
  openAIApiKey?: string
  // MongoDB 配置
  mongoConfig?: {
    host: string
    port: number
    database: string
    username?: string
    password?: string
  }
  // 服务器端口
  serverPort?: number
  // 部署配置
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

interface DeploymentResult {
  success: boolean
  message: string
  version?: string
  error?: string
}

interface DockerEnvironmentCheck {
  success: boolean
  available: boolean
  currentVersion?: string
  error?: string
}

declare global {
  interface Window {
    electronAPI?: {
      // 现有 API
      ping?: () => Promise<string>
      loadConfig?: () => Promise<AppConfig>
      saveConfig?: (config: AppConfig) => Promise<{ success: boolean }>
      selectExportDirectory?: () => Promise<string | null>
      exportReport?: (payload: { title?: string; reportContent: string; references: any[] }) => Promise<{ success: boolean; error?: string; directory?: string; files?: { reportPath: string; refsPath: string } }>
      downloadReference?: (payload: { url: string; title: string; sessionId: string; exportDirectory: string; index: number; doi?: string }) => Promise<{ success: boolean; isPdf: boolean; filepath?: string; errorMessage?: string; statusCode?: number; contentType?: string; finalUrl?: string; redirects?: number }>
      exportReportWithPdf?: (payload: { sessionId: string; title: string; reportContent: string; exportDirectory: string }) => Promise<{ success: boolean; error?: string; directory?: string; files?: { mdPath: string; pdfPath: string } }>

      // 新增：部署 API
      startDeployment?: (payload: {
        credentials: { username: string; password: string }
        version: string
        config: DeploymentConfig
      }) => Promise<DeploymentResult>
      
      checkDockerEnvironment?: (config: DeploymentConfig) => Promise<DockerEnvironmentCheck>
      
      onDeployProgress?: (
        callback: (event: any, progress: DeployProgress) => void
      ) => () => void  // 返回取消监听函数

      // Window control APIs
      windowMinimize?: () => Promise<void>
      windowMaximize?: () => Promise<void>
      windowClose?: () => Promise<void>
      windowIsMaximized?: () => Promise<boolean>
      
      // Developer tools API
      openDevTools?: () => Promise<{ success: boolean; error?: string }>
    }
  }
}