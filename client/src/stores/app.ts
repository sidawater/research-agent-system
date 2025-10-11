import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppConfig {
  websocketUrl: string
  apiServerUrl: string
  exportDirectory: string
  theme: 'light' | 'dark'
  // 新增：Semantic Scholar API Key
  semanticApiKey?: string
}

interface AppState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void

  settingsVisible: boolean
  showSettings: () => void
  hideSettings: () => void

  connectionStatus: 'disconnected' | 'connecting' | 'connected'
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected') => void

  currentSession: string | null
  setCurrentSession: (session: string | null) => void

  // 新增：对话模式
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

      settingsVisible: false,
      showSettings: () => set({ settingsVisible: true }),
      hideSettings: () => set({ settingsVisible: false }),

      connectionStatus: 'disconnected',
      setConnectionStatus: (status) => set({ connectionStatus: status }),

      currentSession: null,
      setCurrentSession: (session) => set({ currentSession: session }),

      // 新增：模式默认 semantic
      mode: 'semantic',
      setMode: (m) => set({ mode: m }),

      // 修改默认地址以匹配服务端端点
      config: {
        websocketUrl: 'ws://127.0.0.1:8000/chat',
        apiServerUrl: 'http://127.0.0.1:8000/api/v1',
        exportDirectory: '',
        theme: 'light',
        // 新增默认空的 Semantic API Key
        semanticApiKey: '',
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
            // 持久化 Semantic API Key
            semanticApiKey: config.semanticApiKey,
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