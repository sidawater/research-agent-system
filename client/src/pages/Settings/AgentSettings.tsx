import React, { useEffect, useState } from 'react'
import { Form, Input, Button, Space, message, Divider } from 'antd'
import { useAppStore } from '../../stores/app'
import { listPrompts, setPrompt } from '../../services/api'

const { TextArea } = Input

const AgentSettings: React.FC = () => {
  const { config, updateConfig, saveConfigToFile } = useAppStore()
  const [form] = Form.useForm()
  const [promptsForm] = Form.useForm()
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [savingPrompts, setSavingPrompts] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      openAIBaseUrl: config.openAIBaseUrl || '',
      openAIApiKey: config.openAIApiKey || '',
      semanticApiKey: config.semanticApiKey || '',
    })
  }, [config, form])

  useEffect(() => {
    loadPrompts()
  }, [])

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

  const handleSaveApiConfig = async () => {
    try {
      const values = await form.validateFields()
      updateConfig({
        openAIBaseUrl: values.openAIBaseUrl,
        openAIApiKey: values.openAIApiKey,
        semanticApiKey: values.semanticApiKey,
      })
      await saveConfigToFile()
      message.success('API 配置已保存')
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`)
    }
  }

  return (
    <div>
      <h2>API 配置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="OpenAI Base URL"
          name="openAIBaseUrl"
          tooltip="用于连接 OpenAI API 或兼容服务的基础 URL"
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item
          label="OpenAI API Key"
          name="openAIApiKey"
          tooltip="用于身份验证的 API 密钥"
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item
          label="Semantic Scholar API Key"
          name="semanticApiKey"
          tooltip="用于访问 Semantic Scholar API 的密钥"
        >
          <Input placeholder="输入 Semantic Scholar API Key" />
        </Form.Item>
      </Form>
      <Space>
        <Button type="primary" onClick={handleSaveApiConfig}>
          保存 API 配置
        </Button>
      </Space>

      <Divider />

      <h2>提示词配置</h2>
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
        <Button onClick={loadPrompts} disabled={loadingPrompts} loading={loadingPrompts}>
          重新加载
        </Button>
        <Button type="primary" onClick={handleSavePrompts} loading={savingPrompts}>
          保存提示词
        </Button>
      </Space>
    </div>
  )
}

export default AgentSettings
