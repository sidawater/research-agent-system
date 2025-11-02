import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

const { Title } = Typography

interface PageHeaderProps {
  title: string
  showBackButton?: boolean
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBackButton = true,
}) => {
  const navigate = useNavigate()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fff',
      }}
    >
      {showBackButton && (
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/home')}
          style={{ marginRight: 16 }}
        >
          返回
        </Button>
      )}
      <Title level={3} style={{ margin: 0 }}>
        {title}
      </Title>
    </div>
  )
}

export default PageHeader
