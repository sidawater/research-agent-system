import React, { useMemo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/stores/chat'
import { Button } from 'antd'

interface Props {
  message: ChatMessage
}

// Global cache for expand states - persists across re-renders
const expandStateCache = new Map<string, boolean>()

// Memoized collapse component for ref type
const RefMessageCollapse: React.FC<{ content: string; messageId: string }> = React.memo(({ content, messageId }) => {
  const [isExpanded, setIsExpanded] = useState(() => expandStateCache.get(messageId) || false)
  
  // Memoize line splitting to avoid repeated computation
  const { lines, shouldCollapse } = useMemo(() => {
    const lines = content.split('\n')
    return {
      lines,
      shouldCollapse: lines.length > 10
    }
  }, [content])
  
  // Memoize display content
  const displayContent = useMemo(() => {
    if (shouldCollapse && !isExpanded) {
      return lines.slice(0, 10).join('\n') + '\n...'
    }
    return content
  }, [content, lines, shouldCollapse, isExpanded])
  
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => {
      const newState = !prev
      expandStateCache.set(messageId, newState)
      return newState
    })
  }, [messageId])
  
  return (
    <div style={{ width: '100%' }}>
      <div style={{ 
        background: '#f6f8fa', 
        border: '1px solid #d1d5da',
        color: '#24292e', 
        padding: 2, 
        borderRadius: 1, 
        overflowX: 'auto',
        margin: '8px 0',
        fontSize: '13px',
        lineHeight: '1.45',
        maxHeight: isExpanded ? '600px' : '300px',
        overflowY: 'auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {displayContent}
      </div>
      {shouldCollapse && (
        <Button 
          type="link" 
          size="small"
          onClick={handleToggle}
          style={{ padding: 0, marginTop: 4 }}
        >
          {isExpanded ? 'Collapse ↑' : `Expand (${lines.length} lines) ↓`}
        </Button>
      )}
    </div>
  )
})

RefMessageCollapse.displayName = 'RefMessageCollapse'

// Progressive markdown renderer for content type
const ProgressiveMarkdown: React.FC<{ content: string }> = React.memo(({ content }) => {
  const [isFullyRendered, setIsFullyRendered] = useState(false)
  const shouldProgressiveRender = content.length > 1000
  
  // For short content, render immediately
  const renderedContent = useMemo(() => {
    if (!shouldProgressiveRender || isFullyRendered) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      )
    }
    
    // For long content, render preview first
    const previewContent = content.substring(0, 1000) + '...'
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {previewContent}
      </ReactMarkdown>
    )
  }, [content, shouldProgressiveRender, isFullyRendered])
  
  return (
    <div style={{ lineHeight: '1.6' }}>
      {renderedContent}
      {shouldProgressiveRender && !isFullyRendered && (
        <Button 
          type="link" 
          size="small"
          onClick={() => setIsFullyRendered(true)}
          style={{ marginTop: 8 }}
        >
          Show full content
        </Button>
      )}
    </div>
  )
})

ProgressiveMarkdown.displayName = 'ProgressiveMarkdown'

const MessageRenderer: React.FC<Props> = React.memo(({ message }) => {
  const { type, content } = message

  // type=action: bubble style
  if (type === 'action') {
    return (
      <div style={{
        display: 'inline-block',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '18px',
        fontSize: '13px',
        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
      }}>
        {content}
      </div>
    )
  }

  if (type === 'references') {
    return (
      <div style={{ 
        color: '#2563eb', 
        fontWeight: 500,
        padding: '8px 12px',
        background: '#eff6ff',
        borderLeft: '3px solid #2563eb',
        borderRadius: '4px'
      }}>
        📚 {content}
      </div>
    )
  }

  if (type === 'error') {
    return (
      <div style={{ color: '#c53030' }}>{content}</div>
    )
  }

  if (type === 'code') {
    return (
      <pre style={{ background: '#2d3748', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
        <code>{content}</code>
      </pre>
    )
  }

  // type=ref: optimized with memoized collapse component
  if (type === 'ref') {
    return <RefMessageCollapse content={content} messageId={message.id} />
  }

  // type=content: optimized with progressive rendering (no expensive syntax highlighting)
  if (type === 'content') {
    return <ProgressiveMarkdown content={content} />
  }

  // user/report default markdown support (lightweight, no syntax highlighting)
  const renderedDefault = useMemo(() => (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  ), [content])
  
  return (
    <div>
      {renderedDefault}
    </div>
  )
})

export default MessageRenderer