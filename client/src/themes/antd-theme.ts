import type { ThemeConfig } from 'antd/es/config-provider/context'

export const themeConfig: Record<'light' | 'dark', ThemeConfig> = {
  light: {
    token: {
      colorPrimary: '#4299e1',
      colorBgBase: '#ffffff',
    },
  },
  dark: {
    token: {
      colorPrimary: '#4299e1',
      colorBgBase: '#001529',
    },
    algorithm: undefined, // use default dark adjustments or customize
  },
}