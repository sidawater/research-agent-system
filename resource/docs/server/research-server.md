# Research Agent System - HTTP/WebSocket 接口文档

## 1. HTTP API 接口

### 1.1 健康检查接口
- **路径**: `/api/v1/health`
- **方法**: GET
- **功能**: 检查服务健康状态

### 1.2 对话历史接口
- **获取所有对话**: 
  - **路径**: `/api/v1/history`
  - **方法**: GET
  - **功能**: 获取所有对话历史（限制50条）
- **获取特定对话**: 
  - **路径**: `/api/v1/history/{session_id}`
  - **方法**: GET
  - **功能**: 获取指定会话的对话历史
- **更新对话历史**: 
  - **路径**: `/api/v1/history/{session_id}`
  - **方法**: POST
  - **功能**: 更新指定会话的对话历史

## 2. WebSocket 接口

### 2.1 聊天接口
- **路径**: `/chat`
- **方法**: WebSocket 连接
- **功能**: 与研究助手进行实时对话交互

### 2.2 WebSocket 消息格式

#### 2.2.1 客户端发送消息
```json
{
  "session_id": "会话ID（可选）",
  "query": "用户查询内容（可选）",
  "need_export": "是否需要导出（可选，布尔值）"
}
```

#### 2.2.2 服务端响应消息
```json
{
  "type": "消息类型（content/action/references/error）",
  "data": "消息数据"
}
```

消息类型说明：
- **content**: 研究内容相关消息
- **action**: 操作状态消息（如节点开始/完成）
- **references**: 参考文献消息
- **error**: 错误消息

### 2.3 WebSocket 交互流程
1. 客户端建立 WebSocket 连接
2. 客户端发送查询请求（包含 session_id 和 query）
3. 服务端通过 WebSocket 实时返回处理进度和结果
4. 用户确认是否满意搜索结果，或手动修正搜索结果
5. 如果用户满意搜索结果，则生成报告
6. 报告生成后，根据需要决定是否导出
7. 交互完成后连接保持开放，等待下一次查询
