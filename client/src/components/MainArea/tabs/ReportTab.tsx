import React, { useState } from 'react'
import { Card, Typography, Empty, Button, message, Input, Modal } from 'antd'
import { useResearchStore } from '../../../stores/research'
import { useAppStore } from '../../../stores/app'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

const { Title, Text } = Typography

const ReportTab: React.FC = () => {
  const { currentReport, phase } = useResearchStore()
  const { currentSession, config } = useAppStore()
  const [isExporting, setIsExporting] = useState(false)
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [reportTitle, setReportTitle] = useState('')

  const handleExport = async () => {
    if (!currentReport) {
      message.error('No report content to export')
      return
    }

    if (!config.exportDirectory) {
      message.error('Please configure export directory in settings first')
      return
    }

    if (!currentSession) {
      message.error('No active session')
      return
    }

    // Show title input modal
    setShowTitleModal(true)
  }

  const handleConfirmExport = async () => {
    if (!reportTitle.trim()) {
      message.error('Please enter a title for the report')
      return
    }

    setIsExporting(true)
    setShowTitleModal(false)

    try {
      const result = await window.electronAPI?.exportReportWithPdf?.({
        sessionId: currentSession!,
        title: reportTitle.trim(),
        reportContent: currentReport!,
        exportDirectory: config.exportDirectory,
      })

      if (result?.success) {
        message.success(`Report exported successfully to ${result.directory}`)
        console.log('Exported files:', result.files)
      } else {
        message.error(`Export failed: ${result?.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('Export error:', error)
      message.error(`Export failed: ${error.message}`)
    } finally {
      setIsExporting(false)
      setReportTitle('')
    }
  }

  if (!currentReport) {
    return (
      <div style={{ padding: 24, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description={phase === 'generating' ? '正在生成报告...' : '报告预览开发中...'} />
      </div>
    )
  }

  return (
    <>
      <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
        <Card bordered>
          <Title level={4}>Research Report</Title>
          <div style={{ fontSize: 14 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{currentReport}</ReactMarkdown>
          </div>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Button type="primary" onClick={handleExport} loading={isExporting}>
              Export Report (MD + PDF)
            </Button>
          </div>
          <Text type="secondary">Phase: {phase}</Text>
        </Card>
      </div>

      <Modal
        title="Export Report"
        open={showTitleModal}
        onOk={handleConfirmExport}
        onCancel={() => {
          setShowTitleModal(false)
          setReportTitle('')
        }}
        okText="Export"
        cancelText="Cancel"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>Enter a title for the exported report:</Text>
        </div>
        <Input
          placeholder="e.g., Research Report - AI Technology"
          value={reportTitle}
          onChange={(e) => setReportTitle(e.target.value)}
          onPressEnter={handleConfirmExport}
        />
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Files will be saved to: {config.exportDirectory}/{currentSession?.substring(0, 8)}-{new Date().toISOString().split('T')[0]}/
          </Text>
        </div>
      </Modal>
    </>
  )
}

export default ReportTab