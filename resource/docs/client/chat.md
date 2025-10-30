# 研究助手应用 - 对话模块开发文档

## 1. 概述
对话模块是研究助手应用的核心功能模块，负责管理用户与AI助手之间的研究交互流程。该模块通过WebSocket与后端服务通信，实现学术检索、用户确认、报告生成等闭环交互。

## 2. 对话流程

### 2.1 启动对话/研究的流程

#### 2.1.1 初始化阶段

应用启动时执行以下初始化流程：

```typescript
// 应用初始化
async function initializeApp(): Promise<void> {
  // 1. 获取历史对话记录
  const conversations = await fetchConversationHistory()
  
  // 2. 显示对话历史列表
  displayConversationList(conversations)
  
  // 3. 保持各模块为空状态
  clearAllModules()
}

function clearAllModules(): void {
  // 清空对话消息区
  setMessages([])
  
  // 清空参考文献区
  setReferences([])
  
  // 清空报告区
  setCurrentReport('')
  
  // 重置研究阶段
  setResearchPhase('idle')
}
```

**初始化状态说明**

| 模块 | 初始状态 | 说明 |
|------|---------|------|
| 对话历史列表 | 加载历史记录 | 从服务端获取用户的所有对话会话 |
| 对话消息区 | 空 | 等待用户选择对话或新建对话 |
| 参考文献区 | 空 | 等待进入具体对话后加载 |
| 报告区 | 空 | 等待进入具体对话后加载 |
| 研究阶段 | idle | 无活动研究任务 |

#### 2.1.2 进入对话

用户可以通过两种方式进入对话：

##### A. 选择历史对话

```typescript
// 用户点击历史对话列表中的某个对话
async function enterHistoricalConversation(conversationId: string): Promise<void> {
  try {
    // 1. 并行获取对话详细信息和消息历史
    // 使用专用的消息接口以获得更好的性能和分页支持
    const [conversation, messagesData] = await Promise.all([
      fetchConversationDetail(conversationId),
      fetchConversationMessages(conversationId, 100, 0)
    ])
    
    // 2. 设置当前会话ID
    setCurrentSessionId(conversation.session_id)
    setCurrentSessionName(conversation.session_name || conversation.research_state.query)
    
    // 3. 渲染对话消息
    // 优先使用专用消息接口的数据，如果为空则回退到对话文档中的消息
    const serverMessages = messagesData?.messages?.length > 0 
      ? messagesData.messages 
      : (conversation?.messages || [])
    
    if (serverMessages.length > 0) {
      setMessages(serverMessages)
    } else {
      // 如果没有消息记录，生成初始消息
      setMessages([{
        id: generateId(),
        type: 'content',
        content: `研究课题: ${conversation.research_state.query}`,
        timestamp: new Date(conversation.created_at),
        shouldMerge: false
      }])
    }
    
    // 4. 渲染参考文献
    if (conversation.research_state.academic_search_result) {
      const references = parseReferences(conversation.research_state.academic_search_result)
      setReferences(references)
    }
    
    // 5. 渲染报告
    if (conversation.research_state.final_report) {
      setCurrentReport(conversation.research_state.final_report)
    }
    
    // 6. 恢复研究阶段状态
    const phase = determineResearchPhase(conversation.research_state)
    setResearchPhase(phase)
    
    // 7. 建立WebSocket连接
    connectWebSocket(conversationId)
    
    // 8. 如果有更多消息，在控制台提示
    if (messagesData?.total_count > messagesData?.messages?.length) {
      console.log(`已加载 ${messagesData.messages.length} 条消息，总共 ${messagesData.total_count} 条`)
    }
    
  } catch (error) {
    console.error('Failed to load conversation:', error)
    showError('加载对话失败，请重试')
  }
}

// 根据研究状态判断当前阶段
function determineResearchPhase(researchState: ResearchState): ResearchPhase {
  if (researchState.final_report) {
    return 'completed'
  } else if (researchState.academic_search_result) {
    return 'confirming'
  } else if (researchState.query) {
    return 'searching'
  } else {
    return 'idle'
  }
}
```

**历史对话加载流程**

```text
点击历史对话 → 并行获取对话详情和消息历史 → 设置会话ID → 渲染消息 → 渲染参考文献 → 渲染报告 → 恢复研究阶段 → 建立WebSocket连接
```

**消息加载策略**

系统使用以下策略优化消息加载性能：

1. **并行请求**：同时请求对话详情和消息历史，减少等待时间
2. **专用接口**：使用 `/messages/{session_id}` 接口获取消息，支持分页和更好的性能
3. **数据回退**：如果专用接口无数据，回退使用对话文档中的消息字段
4. **默认限制**：首次加载最近100条消息，避免加载过多数据
5. **分页支持**：为未来实现"加载更多"功能预留接口支持

##### B. 新建对话

```typescript
// 用户点击"新建对话"按钮
function createNewConversation(): void {
  // 1. 生成新的会话ID
  const newSessionId = generateSessionId()
  
  // 2. 设置当前会话
  setCurrentSessionId(newSessionId)
  setCurrentSessionName('新对话')
  
  // 3. 清空所有模块
  setMessages([])
  setReferences([])
  setCurrentReport('')
  
  // 4. 设置初始研究阶段
  setResearchPhase('idle')
  
  // 5. 建立WebSocket连接
  connectWebSocket(newSessionId)
  
  // 6. 添加欢迎消息（可选）
  addWelcomeMessage()
}

// 生成唯一的会话ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 添加欢迎消息
function addWelcomeMessage(): void {
  const welcomeMessage: ChatMessage = {
    id: generateId(),
    type: 'content',
    content: '您好！我是研究助手，请输入您想要研究的课题，我将为您检索相关学术文献并生成研究报告。',
    timestamp: new Date(),
    shouldMerge: false
  }
  setMessages([welcomeMessage])
}
```

**新建对话流程**

```text
点击新建对话 → 生成会话ID → 清空各模块 → 设置初始状态 → 建立WebSocket连接 → 显示欢迎消息
```

#### 2.1.3 对话启动流程对比

| 步骤 | 历史对话 | 新建对话 |
|------|---------|----------|
| 会话ID | 从历史记录获取 | 新生成唯一ID |
| 对话消息 | 加载历史消息 | 空或欢迎消息 |
| 参考文献 | 加载已有文献 | 空 |
| 报告内容 | 加载已生成报告 | 空 |
| 研究阶段 | 根据数据恢复 | idle |
| WebSocket | 使用已有会话ID连接 | 使用新会话ID连接 |

### 2.2 对话交互流程

```text
新建对话 → 输入课题 → 学术检索阶段 → 用户确认 → 报告生成阶段 → 导出报告
```

### 2.3 研究阶段状态管理

```typescript
interface ResearchState {
  phase: 'idle' | 'searching' | 'confirming' | 'generating' | 'completed'
  sessionId: string
  currentQuery: string
  searchResults: ResearchReference[]
  currentReport: string
  isSearchSatisfied: boolean
  isReportSatisfied: boolean
}
```

## 3. 数据结构设计

### 3.1 核心接口类型

#### 3.1.1 对话历史项

```typescript
interface ConversationHistory {
  session_id: string
  research_state: {
    query: string
    academic_search_result?: AcademicSearchResult
    final_report?: string
  }
  created_at: string
  updated_at: string
  messages?: ChatMessage[]
}
```

#### 3.1.2 当前会话状态

```typescript
interface CurrentSession {
  sessionId: string
  sessionName: string
  messages: ChatMessage[]
  references: ResearchReference[]
  currentReport: string
  researchProgress: number
  connectionStatus: 'disconnected' | 'connecting' | 'connected'
}
```

#### 3.1.3 聊天消息

```typescript
type MessageType = 'user' | 'action' | 'content' | 'ref' | 'references' | 'report' | 'error'

interface ChatMessage {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  shouldMerge: boolean  // 是否与上一条消息合并
}
```

## 4. 组件设计

### 4.1 聊天区域组件 (ChatArea)

**功能职责**

- 渲染完整的聊天界面
- 管理消息输入和发送
- 协调各个子组件的工作

**核心状态**

```typescript
interface ChatAreaState {
  messages: ChatMessage[]
  inputText: string
  isGenerating: boolean
  researchPhase: ResearchPhase
}
```

**主要方法**

```typescript
class ChatArea {
  // 发送用户消息
  async sendUserMessage(content: string): Promise<void>
  
  // 生成研究报告
  generateReport(): void
  
  // 导出报告
  async exportReport(): Promise<void>
  
  // 处理键盘事件
  handleKeyPress(event: React.KeyboardEvent): void
}
```

### 4.2 消息列表组件 (MessageList)

**功能职责**

- 渲染聊天消息列表
- 实现消息合并显示
- 处理消息滚动定位

**渲染逻辑**

```typescript
// 消息合并规则
function shouldMergeMessages(prev: ChatMessage, current: ChatMessage): boolean {
  return prev.type === current.type && 
         current.type !== 'action' && 
         current.type !== 'references' && 
         current.type !== 'report' &&
         current.type !== 'user'
}
```

**布局策略**

- **用户消息**：右对齐，蓝色背景
- **助手消息**：左对齐，灰色背景
- **系统消息**：居中对齐，特殊样式

### 4.3 消息渲染器 (MessageRenderer)

**功能职责**

- 根据消息类型渲染不同样式的内容
- 支持Markdown格式渲染
- 处理特殊消息类型（参考文献、报告等）

**消息类型处理**

```typescript
switch (message.type) {
  case 'action':
    // 显示状态气泡
    return <ActionMessage content={message.content} />
  
  case 'content':
    // Markdown内容渲染
    return <ContentMessage content={message.content} />
  
  case 'ref':
    // 参考文献条目
    return <ReferenceMessage content={message.content} />
  
  case 'references':
    // 参考文献汇总
    return <ReferencesSummary count={references.length} />
  
  case 'report':
    // 研究报告显示
    return <ReportMessage content={message.content} />
  
  case 'error':
    // 错误提示
    return <ErrorMessage content={message.content} />
}
```

### 4.4 聊天输入组件 (ChatInput)

**功能职责**

- 提供消息输入界面
- 根据研究阶段显示不同的操作按钮
- 处理用户交互事件

**状态相关的按钮显示**

```typescript
function getAvailableActions(phase: ResearchPhase): ChatAction[] {
  const baseActions: ChatAction[] = ['send']
  
  switch (phase) {
    case 'confirming':
      return [...baseActions, 'generateReport']
    case 'completed':
      return [...baseActions, 'export']
    default:
      return baseActions
  }
}
```

## 5. 消息处理逻辑

### 5.1 WebSocket消息处理

```typescript
class WebSocketMessageHandler {
  // 处理服务端消息
  handleWebSocketMessage(message: WebSocketMessage): void {
    const { type, data } = message
    
    switch (type) {
      case 'action':
        this.handleActionMessage(data)
        break
      case 'content':
        this.handleContentMessage(data)
        break
      case 'ref':
        this.handleRefMessage(data)
        break
      case 'references':
        this.handleReferencesMessage(data)
        break
      case 'report':
        this.handleReportMessage(data)
        break
      case 'error':
        this.handleErrorMessage(data)
        break
    }
  }
  
  // 处理 action 类型消息
  private handleActionMessage(action: string): void {
    // 显示状态气泡，替换之前的action
    this.showActionBubble(action)
    
    // 根据action更新进度状态
    this.updateProgressByAction(action)
    
    // action消息不参与消息流合并
    this.resetMergeState()
  }
  
  // 处理 content 类型消息
  private handleContentMessage(content: string): void {
    if (this.shouldMergeWithLast('content')) {
      this.appendToLastMessage(content, 'content')
    } else {
      this.createNewMessage(content, 'content')
    }
    this.hideActionBubble()
  }
  
  // 处理 ref 类型消息
  private handleRefMessage(refContent: string): void {
    // 添加到参考文献流
    this.addToReferenceStream(refContent)
    
    if (this.shouldMergeWithLast('ref')) {
      this.appendToLastMessage(refContent, 'ref')
    } else {
      this.createNewMessage(refContent, 'ref')
    }
  }
  
  // 判断是否与上一条消息合并
  private shouldMergeWithLast(currentType: MessageType): boolean {
    return this.lastMessageType === currentType && 
           currentType !== 'action' && 
           currentType !== 'references' && 
           currentType !== 'report' &&
           currentType !== 'user'
  }
}
```

### 5.2 消息合并策略

**合并条件**

- **相同类型**：当前消息与上一条消息类型相同
- **可合并类型**：content、ref 类型消息可以合并
- **时间间隔**：消息间隔在一定时间内（如30秒内）
- **用户切换**：用户消息会重置合并状态

**合并效果**

- **内容追加**：将新内容追加到现有消息元素中
- **时间更新**：更新消息的时间戳为最新时间
- **滚动调整**：保持平滑的滚动体验

## 6. 用户交互设计

### 6.1 发送消息流程

```typescript
// 发送用户消息
async function sendUserMessage(): Promise<void> {
  if (!inputText.trim()) return
  
  // 构建 WebSocket 消息
  const message: ClientMessage = {
    session_id: currentSessionId,
    query: inputText,
    search_results_satisfactory: false,
    report_satisfactory: false
  }
  
  // 添加用户消息到界面
  addUserMessage(inputText)
  
  // 发送 WebSocket 消息
  try {
    await websocket.send(JSON.stringify(message))
    clearInput()
    transitionToPhase('searching')
  } catch (error) {
    showError('发送失败，请检查网络连接')
  }
}
```

### 6.2 生成报告流程

```typescript
// 用户确认检索结果，生成报告
function generateReport(): void {
  const message: ClientMessage = {
    session_id: currentSessionId,
    query: '', // 不需要重复发送查询
    search_results_satisfactory: true, // 关键：用户满意检索结果
    report_satisfactory: false
  }
  
  websocket.send(JSON.stringify(message))
  transitionToPhase('generating')
  
  // 在界面中添加用户确认消息
  addUserMessage('检索结果满意，请生成报告')
}
```

### 6.3 导出报告流程

```typescript
// 导出报告
async function exportReport(): Promise<void> {
  if (!currentReport) {
    showError('没有可导出的报告内容')
    return
  }
  
  try {
    const result = await electronAPI.exportReport({
      content: currentReport,
      references: currentReferences,
      title: `研究报告_${new Date().toLocaleDateString()}`
    })
    
    if (result.success) {
      showSuccess(`报告已导出到: ${result.path}`)
    } else {
      showError(`导出失败: ${result.error}`)
    }
  } catch (error) {
    showError('导出过程中发生错误')
  }
}
```

## 7. 研究阶段管理

### 7.1 阶段转换逻辑

```typescript
class ResearchPhaseManager {
  private currentPhase: ResearchPhase = 'idle'
  
  // 阶段转换
  transitionToPhase(newPhase: ResearchPhase): void {
    this.currentPhase = newPhase
    this.updateUIByPhase(newPhase)
  }
  
  // 根据阶段更新UI
  private updateUIByPhase(phase: ResearchPhase): void {
    switch (phase) {
      case 'idle':
        this.showSendButtonOnly()
        break
      case 'searching':
        this.showSendButtonOnly()
        break
      case 'confirming':
        this.showGenerateReportButton()
        break
      case 'generating':
        this.showSendButtonOnly()
        break
      case 'completed':
        this.showExportButton()
        break
    }
  }
}
```

### 7.2 阶段对应的用户操作

| 研究阶段 | 可用操作 | 界面表现 |
|---------|---------|----------|
| idle | 发送消息 | 仅显示发送按钮 |
| searching | 发送消息 | 显示加载状态，仅发送按钮 |
| confirming | 发送消息、生成报告 | 显示确认按钮和发送按钮 |
| generating | 发送消息 | 显示报告生成状态，仅发送按钮 |
| completed | 发送消息、导出报告 | 显示导出按钮和发送按钮 |

## 8. 错误处理

### 8.1 消息发送失败处理

```typescript

// 消息发送错误处理
function handleMessageSendError(error: Error): void {
  console.error('Message send failed:', error)
  
  // 在聊天界面显示错误消息
  addErrorMessage('消息发送失败，请检查网络连接')
  
  // 重置生成状态
  setIsGenerating(false)
  
  // 根据当前阶段回退状态
  if (researchPhase === 'searching') {
    transitionToPhase('idle')
  } else if (researchPhase === 'generating') {
    transitionToPhase('confirming')
  }
}
```

### 8.2 WebSocket连接异常处理

```typescript
// WebSocket连接错误处理
function handleWebSocketError(error: Error): void {
  console.error('WebSocket error:', error)
  
  // 更新连接状态
  updateConnectionStatus('disconnected')
  
  // 显示错误提示
  showNotification('连接断开，正在尝试重连...', 'warning')
  
  // 自动重连逻辑
  if (shouldReconnect) {
    setTimeout(() => {
      reconnectWebSocket(currentSession.value.sessionId)
    }, 3000)
  }
}
```

## 9. 性能优化

### 9.1 消息渲染优化

**虚拟滚动**

```typescript
// 对于大量消息，使用虚拟滚动
function setupVirtualScroll(): void {
  // 仅渲染可视区域内的消息
  // 减少DOM节点数量，提升性能
}
```

**消息分页**

```typescript
// 消息分页加载
async function loadMoreMessages(): Promise<void> {
  if (isLoadingMore) return
  
  setIsLoadingMore(true)
  try {
    const olderMessages = await fetchConversationMessages(
      currentSessionId, 
      100,  // limit: 每次加载100条
      page * 100  // skip: 根据页数跳过已加载的消息
    )
    setMessages(prev => [...olderMessages.messages, ...prev])
    setPage(prev => prev + 1)
  } catch (error) {
    console.error('Failed to load older messages:', error)
  } finally {
    setIsLoadingMore(false)
  }
}

// API 调用示例
async function fetchConversationMessages(
  sessionId: string,
  limit: number = 100,
  skip: number = 0
): Promise<ConversationMessagesResponse> {
  const response = await fetch(
    `${API_BASE}/messages/${encodeURIComponent(sessionId)}?limit=${limit}&skip=${skip}`
  )
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

// 响应数据结构
interface ConversationMessagesResponse {
  session_id: string
  total_count: number  // 总消息数
  limit: number        // 当前限制
  skip: number         // 当前跳过
  messages: ServerChatMessage[]  // 消息列表
}
```

### 9.2 状态更新优化

**批量更新**

```typescript
// 使用批量更新减少渲染次数
function addMultipleMessages(messages: ChatMessage[]): void {
  setMessages(prev => [...prev, ...messages])
}

// 或者使用防抖处理快速连续的消息
const debouncedAddMessage = useDebounce((message: ChatMessage) => {
  setMessages(prev => [...prev, message])
}, 100)
```
