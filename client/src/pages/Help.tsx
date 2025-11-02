import React from 'react'
import { Layout, Card, Typography, Button, Divider, Space } from 'antd'
import { InfoCircleOutlined, RocketOutlined } from '@ant-design/icons'
import PageHeader from '../components/Common/PageHeader'

const { Content } = Layout
const { Title, Paragraph, Text } = Typography

const HelpPage: React.FC = () => {
  const appVersion = '2.1.0' // 从 package.json 读取

  const handleCheckUpdate = () => {
    // 预留：检查更新逻辑
    console.log('Check for updates...')
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <PageHeader title="帮助" />
      <Content style={{ padding: '24px', overflow: 'auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 应用说明 */}
          <Card
            title={
              <>
                <InfoCircleOutlined style={{ marginRight: 8 }} />
                应用说明
              </>
            }
          >
            <Title level={4}>系统概述</Title>
            <Paragraph>
              Research Agent System 是一款基于 AI 的智能研究助手桌面应用。
              通过集成多个学术搜索引擎和大语言模型，帮助用户快速检索、整理和生成研究报告。
            </Paragraph>

            <Divider />

            <Title level={4}>核心功能</Title>
            <ul>
              <li>
                <Text strong>智能对话：</Text>通过 WebSocket 实时与 AI Agent 交互，
                支持 DeepSeek 和 Semantic Scholar 两种模式
              </li>
              <li>
                <Text strong>文献搜索：</Text>自动从 arXiv、Semantic Scholar 等数据库检索相关文献
              </li>
              <li>
                <Text strong>报告生成：</Text>基于检索结果自动生成结构化研究报告（支持 Markdown/PDF 导出）
              </li>
              <li>
                <Text strong>引用管理：</Text>批量下载文献 PDF，按会话分类整理
              </li>
              <li>
                <Text strong>对话历史：</Text>自动保存所有会话记录，支持快速切换查看
              </li>
            </ul>

            <Divider />

            <Title level={4}>使用指南</Title>
            <Paragraph>
              <Text strong>1. 初始化配置</Text>
              <br />
              首次使用前，请在"设置 → 初始化"中配置 HTTP API 和 WebSocket 地址，
              并测试连接确保服务正常运行。
            </Paragraph>
            <Paragraph>
              <Text strong>2. 开始研究</Text>
              <br />
              在主页输入研究问题，系统将自动：
              <ul>
                <li>分析问题并生成搜索策略</li>
                <li>从多个数据源检索相关文献</li>
                <li>整合信息并生成研究报告</li>
              </ul>
            </Paragraph>
            <Paragraph>
              <Text strong>3. 导出结果</Text>
              <br />
              在报告标签页点击"导出 PDF"，或在引用标签页点击"下载引用"批量保存文献。
            </Paragraph>
          </Card>

          {/* 关于 */}
          <Card
            title={
              <>
                <RocketOutlined style={{ marginRight: 8 }} />
                关于
              </>
            }
          >
            <Space direction="vertical" size="middle">
              <div>
                <Text strong>当前版本：</Text>
                <Text>{appVersion}</Text>
              </div>
              <div>
                <Text strong>技术栈：</Text>
                <Text>Electron + React + TypeScript + Ant Design</Text>
              </div>
              <div>
                <Text strong>后端服务：</Text>
                <Text>Python FastAPI + LangChain + MongoDB</Text>
              </div>
              <Divider />
              <Button type="primary" onClick={handleCheckUpdate} disabled>
                检查更新（预留功能）
              </Button>
            </Space>
          </Card>
        </Space>
      </Content>
    </Layout>
  )
}

export default HelpPage
