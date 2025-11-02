import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  theme: 'light' | 'dark'
  // Semantic Scholar API Key
  semanticApiKey?: string
  // 新增 OpenAI 配置
  openAIBaseUrl?: string
  openAIApiKey?: string
  // 新增 MongoDB 配置
  mongoConfig?: {
    host: string
    port: number
    database: string
    username?: string
    password?: string
  }
  // 新增服务器端口
  serverPort?: number
  // 部署配置
  deployment?: {
    registry: string
    imageName: string
    composeFile: string
    workingDirectory: string
  }
}

interface AppState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void

  connectionStatus: 'disconnected' | 'connecting' | 'connected'
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void

  currentSession: string | null
  setCurrentSession: (session: string | null) => void

  // 对话模式
  mode: 'semantic' | 'deepseek'
  setMode: (m: 'semantic' | 'deepseek') => void

  config: AppConfig
  updateConfig: (config: Partial<AppConfig>) => void
  loadConfigFromFile: () => Promise<void>
  saveConfigToFile: () => Promise<void>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => set((state) => ({ 
        theme, 
        config: { ...state.config, theme } 
      })),

      connectionStatus: 'disconnected',
      setConnectionStatus: (status) => set({ connectionStatus: status }),

      currentSession: null,
      setCurrentSession: (session) => set({ currentSession: session }),

      // 模式默认 semantic
      mode: 'semantic',
      setMode: (m) => set({ mode: m }),

      // 修改默认地址以匹配服务端端点
      config: {
        websocketUrl: 'ws://127.0.0.1:8000/chat',
        apiServerUrl: 'http://127.0.0.1:8000/api/v1',
        exportDirectory: '',
        theme: 'light',
        // Semantic API Key
        semanticApiKey: '',
        // OpenAI 配置
        openAIBaseUrl: '',
        openAIApiKey: '',
        // MongoDB 配置
        mongoConfig: {
          host: 'localhost',
          port: 27017,
          database: 'research_agent',
        },
        // 服务器端口
        serverPort: 8000,
        // 部署配置
        deployment: {
          registry: 'sidawater',
          imageName: 'research-service',
          composeFile: 'docker-compose.yml',
          workingDirectory: 'd:/proj/research-agent-system',
        },
      },
      updateConfig: (newConfig) =>
        set((state) => {
          const updatedConfig = { ...state.config, ...newConfig }
          return { 
            config: updatedConfig,
            theme: updatedConfig.theme
          }
        }),
      
      loadConfigFromFile: async () => {
        try {
          const fileConfig = await window.electronAPI?.loadConfig?.()
          if (fileConfig) {
            set((state) => ({
              config: {
                ...fileConfig,
                theme: state.config.theme, // Keep theme from localStorage
              },
            }))
          }
        } catch (err) {
          console.error('Failed to load config from file:', err)
        }
      },
      
      saveConfigToFile: async () => {
        try {
          const { config } = get()
          await window.electronAPI?.saveConfig?.({
            websocketUrl: config.websocketUrl,
            apiServerUrl: config.apiServerUrl,
            exportDirectory: config.exportDirectory,
            // 持久化配置
            semanticApiKey: config.semanticApiKey,
            openAIBaseUrl: config.openAIBaseUrl,
            openAIApiKey: config.openAIApiKey,
            mongoConfig: config.mongoConfig,
            serverPort: config.serverPort,
            deployment: config.deployment,
          })
        } catch (err) {
          console.error('Failed to save config to file:', err)
          throw err
        }
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        theme: state.theme,
        currentSession: state.currentSession,
        mode: state.mode,
        // Note: config (except theme) is now stored in file, not localStorage
      }),
    }
  )
)