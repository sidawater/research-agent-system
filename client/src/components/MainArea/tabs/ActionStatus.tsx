import React from 'react'
import { useChatStore } from '@/stores/chat'

const ActionStatus: React.FC = () => {
  const { messages } = useChatStore()
  const last = messages[messages.length - 1]
  if (!last || last.type !== 'action') return null
  return (
    <div style={{
      padding: '8px 12px',
      background: '#f7fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 6,
      fontSize: 12,
      fontStyle: 'italic',
      color: '#718096',
    }}>
      {last.content}
    </div>
  )
}

export default ActionStatus