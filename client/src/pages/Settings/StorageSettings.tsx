import React, { useEffect } from 'react'
import { Form, Input, Button, message } from 'antd'
import { useAppStore } from '../../stores/app'

const StorageSettings: React.FC = () => {
  const { config, updateConfig, saveConfigToFile } = useAppStore()
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      exportDirectory: config.exportDirectory,
    })
  }, [config, form])

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

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      updateConfig({
        exportDirectory: values.exportDirectory,
      })
      await saveConfigToFile()
      message.success('存储设置已保存')
    } catch (err) {
      message.error(`保存失败: ${(err as Error).message}`)
    }
  }

  return (
    <div>
      <h2>本地存储设置</h2>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label="导出目录"
          name="exportDirectory"
          rules={[{ required: true, message: '请选择导出目录' }]}
          tooltip="报告和引用文件将导出到此目录"
        >
          <Input
            placeholder="选择导出目录或手动输入"
            addonAfter={<Button onClick={handleSelectDirectory}>选择</Button>}
          />
        </Form.Item>
      </Form>
      <Button type="primary" onClick={handleSave}>
        保存配置
      </Button>
    </div>
  )
}

export default StorageSettings
