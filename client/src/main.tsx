import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { useAppStore } from './stores/app'
import { themeConfig } from './themes/antd-theme'
import './styles/main.css'
import 'antd/dist/reset.css'

const Root = () => {
  const { theme } = useAppStore()

  // Use HashRouter when running under file:// protocol (Electron packaged)
  const Router = (typeof window !== 'undefined' && window.location?.protocol === 'file:')
    ? HashRouter
    : BrowserRouter

  return (
    <React.StrictMode>
      <ConfigProvider theme={themeConfig[theme]}>
        <Router>
          <App />
        </Router>
      </ConfigProvider>
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
