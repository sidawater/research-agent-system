import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, Switch, Button, Space, message, Tabs } from 'antd'
import { useAppStore } from '../../stores/app'
import { listPrompts, setPrompt } from '../../services/api'

const { TextArea } = Input

const SettingsModal: React.FC = () => {
  const {
    settingsVisible,
    hideSettings,
    config,
    updateConfig,
  } = useAppStore()

  const [form] = Form.useForm()
  const [promptsForm] = Form.useForm()
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [savingPrompts, setSavingPrompts] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    form.setFieldsValue({
      websocketUrl: config.websocketUrl,
      apiServerUrl: config.apiServerUrl,
      exportDirectory: config.exportDirectory,
      darkMode: config.theme === 'dark',
      // 新增：Semantic API Key 显示
      semanticApiKey: config.semanticApiKey || '',
    })
  }, [config, form])

  useEffect(() => {
    if (settingsVisible && activeTab === 'prompts') {
      loadPrompts()
    }
  }, [settingsVisible, activeTab])

  const loadPrompts = async () => {
    setLoadingPrompts(true)
    try {
      const prompts = await listPrompts()
      promptsForm.setFieldsValue({
        deepseek: prompts.deepseek || '',
        semantic_scholar: prompts.semantic_scholar || '',
        report_writing: prompts.report_writing || '',
      })
      message.success('提示词配置已加载')
    } catch (err) {
      message.error(`加载提示词失败: ${(err as Error).message}`)
    } finally {
      setLoadingPrompts(false)
    }
  }

  const handleSavePrompts = async () => {
    setSavingPrompts(true)
    try {
      const values = await promptsForm.validateFields()
      await Promise.all([
        setPrompt('deepseek', values.deepseek),
        setPrompt('semantic_scholar', values.semantic_scholar),
        setPrompt('report_writing', values.report_writing),
      ])
      message.success('提示词配置已保存')
    } catch (err) {
      message.error(`保存提示词失败: ${(err as Error).message}`)
    } finally {
      setSavingPrompts(false)
    }
  }

  const handleResetPrompts = () => {
    loadPrompts()
  }

  const handleOk = async () => {
    const values = await form.validateFields()
    updateConfig({
      websocketUrl: values.websocketUrl,
      apiServerUrl: values.apiServerUrl,
      exportDirectory: values.exportDirectory,
      theme: values.darkMode ? 'dark' : 'light',
      // 保存 Semantic API Key 到状态
      semanticApiKey: values.semanticApiKey || '',
    })
    
    // Save HTTP/WebSocket/Export Directory to config file
    try {
      await useAppStore.getState().saveConfigToFile()
      hideSettings()
      message.success('Settings saved')
    } catch (err) {
      message.error(`Failed to save settings: ${(err as Error).message}`)
    }
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handleSelectDirectory = async () => {
    try {
      const dir = await window.electronAPI?.selectExportDirectory?.()
      if (dir) {
        form.setFieldsValue({ exportDirectory: dir })
      }
    } catch (err) {
      // ignore
    }
  }

  const handleTestConnection = async () => {
    const values = await form.validateFields()
    const apiBase = (values.apiServerUrl || '').replace(/\/$/, '')
    const healthUrl = `${apiBase}/health`

    message.loading({ content: '测试连接中...', key: 'test-conn' })

    try {
      const resp = await fetch(healthUrl)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      // HTTP OK
      message.success({ content: 'HTTP健康检查通过', key: 'test-conn', duration: 1 })
    } catch (err) {
      message.error({ content: `HTTP连接失败: ${(err as Error).message}`, key: 'test-conn' })
      return
    }

    // Test WebSocket
    const wsUrl = values.websocketUrl
    if (!wsUrl) {
      message.warning('未配置WebSocket地址')
      return
    }

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const ws = new WebSocket(wsUrl)
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            try { ws.close() } catch {}
            reject(new Error('连接超时'))
          }
        }, 5000)
        ws.onopen = () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            ws.close()
            resolve()
          }
        }
        ws.onerror = () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            try { ws.close() } catch {}
            reject(new Error('WebSocket错误'))
          }
        }
        ws.onclose = () => {
          // no-op
        }
      })
      message.success('WebSocket连接成功')
    } catch (err) {
      message.error(`WebSocket连接失败: ${(err as Error).message}`)
    }
  }

  return (
    <Modal
      title="设置"
      open={settingsVisible}
      onCancel={hideSettings}
      footer={null}
      width={800}
    >
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'general',
            label: '基本设置',
            children: (
              <>
                <Form form={form} layout="vertical">
                  <Form.Item label="API 服务器地址" name="apiServerUrl" rules={[{ required: true }]}
                    tooltip="示例: http://127.0.0.1:8000/api/v1">
                    <Input placeholder="http://127.0.0.1:8000/api/v1" />
                  </Form.Item>
                  <Form.Item label="Semantic API Key" name="semanticApiKey"
                    tooltip="用于访问 Semantic Scholar API 的密钥，保存后将用于所有请求">
                    <Input placeholder="输入 Semantic Scholar API Key" />
                  </Form.Item>
                  <Form.Item label="WebSocket 地址" name="websocketUrl" rules={[{ required: true }]}
                    tooltip="示例: ws://127.0.0.1:8000/chat">
                    <Input placeholder="ws://127.0.0.1:8000/chat" />
                  </Form.Item>
                  <Form.Item label="导出目录" name="exportDirectory" rules={[{ required: true }]}
                    tooltip="报告和引用文件将导出到此目录">
                    <Input placeholder="选择导出目录或手动输入" addonAfter={<Button onClick={handleSelectDirectory}>选择</Button>} />
                  </Form.Item>
                  <Form.Item label="深色模式" name="darkMode" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Form>
                <Space>
                  <Button onClick={handleTestConnection}>测试连接</Button>
                  <Button type="primary" onClick={handleOk}>保存</Button>
                </Space>
              </>
            ),
          },
          {
            key: 'prompts',
            label: '提示词配置',
            children: (
              <>
                <Form form={promptsForm} layout="vertical">
                  <Form.Item
                    label="DeepSeek 查询提示词"
                    name="deepseek"
                    tooltip="用于 DeepSeek 学术搜索代理的系统提示词"
                  >
                    <TextArea
                      rows={8}
                      placeholder="输入 DeepSeek 系统提示词..."
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      disabled={loadingPrompts}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Semantic Scholar 查询提示词"
                    name="semantic_scholar"
                    tooltip="用于 Semantic Scholar 搜索代理的系统提示词"
                  >
                    <TextArea
                      rows={8}
                      placeholder="输入 Semantic Scholar 系统提示词..."
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      disabled={loadingPrompts}
                    />
                  </Form.Item>
                  <Form.Item
                    label="报告生成提示词"
                    name="report_writing"
                    tooltip="用于研究报告生成的系统提示词"
                  >
                    <TextArea
                      rows={8}
                      placeholder="输入报告撰写系统提示词..."
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                      disabled={loadingPrompts}
                    />
                  </Form.Item>
                </Form>
                <Space>
                  <Button onClick={handleResetPrompts} disabled={loadingPrompts} loading={loadingPrompts}>重新加载</Button>
                  <Button type="primary" onClick={handleSavePrompts} loading={savingPrompts} disabled={loadingPrompts}>保存配置</Button>
                </Space>
              </>
            ),
          },
        ]}
      />
    </Modal>
  )
}

export default SettingsModal