import React, { useState } from 'react'
import { Card, Typography, Button, message } from 'antd'
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

    // Generate automatic title based on timestamp
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const title = `Research-Report-${timestamp}`

    setIsExporting(true)

    console.log('Starting export with params:', {
      sessionId: currentSession,
      title,
      exportDirectory: config.exportDirectory,
      hasContent: !!currentReport,
      apiAvailable: !!window.electronAPI?.exportReportWithPdf
    })

    try {
      const result = await window.electronAPI?.exportReportWithPdf?.({
        sessionId: currentSession!,
        title: title,
        reportContent: currentReport!,
        exportDirectory: config.exportDirectory,
      })
      
      console.log('Export result:', result)

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
    }
  }

  // For testing: create a fake report if none exists
  const testReport = `# Test Research Report

## Introduction

This is a **test report** for validating the PDF export functionality.

## Key Features

- Markdown to PDF conversion
- Offline capability
- Enhanced styling
- Chinese font support: 中文测试

## Code Example

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

## Table

| Feature | Status |
|---------|--------|
| Export MD | ✅ |
| Export PDF | ✅ |

## Conclusion

This demonstrates the export functionality.
`

  const displayReport = currentReport || testReport

  if (!currentReport && phase !== 'generating') {
    // Show test report for debugging
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <Card bordered>
        <Title level={4}>Research Report</Title>
        <div style={{ fontSize: 14 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{displayReport}</ReactMarkdown>
        </div>
        {!currentReport && (
          <div style={{ marginTop: 12, padding: 8, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4 }}>
            <Text type="warning">⚠️ This is a test report for debugging export functionality</Text>
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <Button type="primary" onClick={handleExport} loading={isExporting}>
            Export Report (MD + PDF)
          </Button>
        </div>
        <Text type="secondary">Phase: {phase}</Text>
      </Card>
    </div>
  )
}

export default ReportTab