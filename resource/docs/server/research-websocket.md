# Research WebSocket 接口文档

本接口通过 WebSocket 推动研究流程，驱动“学术检索 → 用户确认 → 报告生成”的闭环交互。客户端以 JSON 文本消息与服务端交互，服务端返回结构化消息用于前端呈现与状态控制。

## 连接

- WebSocket 服务：由部署方式决定连接 URL。
- FastAPI 路由前缀：`/api/v1`（`research/app/ws/flow.py`）。实际路径需在项目路由注册处挂载。
- 独立 WebSocket 服务器：`research/app/server/ws/websocket.py` 默认监听端口 `8000`，连接示例：`ws://<host>:8000/<path>`（路径由路由注册定义）。

> 提示：请参考你的部署方式选择对应 URL。若使用独立 WS 服务器，请确保已通过 `Route.register(path, func)` 注册对应路径。

## 客户端消息体

客户端每次向服务端发送一个 JSON 文本消息，结构如下：

```json
{
  "session_id": "f429b333-5ce8-418d-87c6-c7095c91429e",
  "query": "广东省各地市的人口分布",
  "search_results_satisfactory": false,
  "report_satisfactory": false
}
```

字段说明：
- `session_id`：字符串，必填，唯一会话标识。客户端必须维护同一会话的同一 `session_id`。
- `query`：字符串，可为空。研究问题或主题；为空时服务端会提示等待查询。
- `search_results_satisfactory`：布尔，表示用户是否对“学术检索结果”满意。
  - 当变为 `true` 时，服务端将进入“撰写报告”阶段。
- `report_satisfactory`：布尔，表示用户是否对“报告内容”满意。
  - 当变为 `true` 时，会话流程结束。

## 交互流程

1) 会话初始化
- 客户端首次发送消息时，必须包含唯一 `session_id`。
- 若同时提供 `query`，服务端开始学术检索；否则服务端返回提示等待查询。
- 服务端可能返回欢迎信息：`{"type": "content", "data": "welcome!"}`。

2) 学术检索阶段（academic_search）
- 服务端会以流式形式返回检索过程与内容：
  - 过程提示：`{"type": "action", "data": "【academic_search】开始..."}` / `完成.` / `失败.` / `中断.`
  - 内容流：
    - `{"type": "ref", "data": "..."}`（学术参考内容的流式片段）
    - 其他节点为 `{"type": "content", "data": "..."}`（普通内容流片段）
- 检索结束后返回完整参考文献结果：
  - `{"type": "references", "data": <AcademicSearchResult 对象的 JSON>}`
  - 注意：实现中消息类型为 `references`（复数）。

3) 用户确认检索结果
- 若用户满意检索结果，客户端发送消息将 `search_results_satisfactory` 置为 `true`。
- 服务端进入“撰写报告”阶段。

4) 报告生成阶段（write_report）
- 服务端返回过程提示与内容流：
  - `{"type": "action", "data": "【write_report】开始..."}` / `完成.`
  - 报告生成过程中的普通内容流：`{"type": "content", "data": "..."}`
- 报告生成完成后，服务端返回完整 Markdown 报告：
  - `{"type": "report", "data": "# 报告标题\n..."}`

5) 用户确认报告
- 若用户满意报告，客户端发送消息将 `report_satisfactory` 置为 `true`，服务端结束会话流程。

6) 断开与清理
- 正常或异常情况下，服务端会尝试关闭连接并持久化会话状态到 MongoDB。

## 服务端返回消息格式

服务端始终返回 JSON：`{"type": "<消息类型>", "data": <内容>}`。

- `type` 取值：
  - `action`：流程提示（开始、完成、失败、中断）。
  - `content`：普通内容流（欢迎语、等待提示、非检索节点的内容流）。
  - `ref`：学术参考内容的流式片段（仅在 `academic_search` 节点）。
  - `references`：完整的参考文献结果（结构体 `AcademicSearchResult` 的 JSON）。
  - `report`：完整报告（Markdown 文本）。
- `data`：对应内容，可能是字符串或结构化 JSON。

## 典型交互示例

1) 初始化并发起检索
```text
C->S:
{"session_id":"<uuid>","query":"广东省各地市的人口分布","search_results_satisfactory":false,"report_satisfactory":false}

S->C:
{"type":"content","data":"welcome!"}
{"type":"action","data":"【academic_search】开始..."}
{"type":"ref","data":"参考文献片段1..."}
{"type":"ref","data":"参考文献片段2..."}
{"type":"action","data":"【academic_search】完成."}
{"type":"references","data":{...AcademicSearchResult...}}
```

2) 用户确认检索结果，生成报告
```text
C->S:
{"session_id":"<uuid>","search_results_satisfactory":true}

S->C:
{"type":"action","data":"【write_report】开始..."}
{"type":"content","data":"生成报告片段..."}
{"type":"action","data":"【write_report】完成."}
{"type":"report","data":"# 报告标题\n..."}
```

3) 用户确认报告，结束会话
```text
C->S:
{"session_id":"<uuid>","report_satisfactory":true}

S->C:
// 通常不再返回更多内容，并清理持久化会话状态
```

## 状态与持久化

- 会话结构：`Session(session_id, research_state, messages, user_id, created_at, updated_at)`。
- 持久化：MongoDB 集合 `sessions`，键为 `session_id`。
- 研究状态：`ResearchState`，包含 `query`、`academic_search_result`、`final_report`、满意度标记等。

## 错误与中断

- 当出现错误或中断时，服务端会返回：
  - `{"type":"action","data":"【<node>】失败."}` 或 `{"type":"action","data":"【<node>】中断."}`
- 服务端会保存会话状态到 MongoDB 并尝试关闭连接。

## 客户端实现建议

- 保持 `session_id` 稳定，整个会话中始终使用同一值。
- 初次消息可同时提供 `query`，避免“等待查询”提示。
- 在检索结果展示后，用户操作将 `search_results_satisfactory` 置为 `true`，触发报告生成。
- 报告展示后，用户操作将 `report_satisfactory` 置为 `true`，结束会话。
- 处理服务端流式消息时，根据 `type` 决定展示区域：
  - `ref` → 参考文献流区域
  - `references` → 完整参考文献面板
  - `content` → 普通文本内容区域
  - `report` → 报告查看/导出
  - `action` → 状态提示栏

## 兼容性说明

- 服务端支持两种实现方式：
  - FastAPI WebSocket（`research/app/ws/flow.py`）：需在路由中注册该端点。
  - 独立 WebSocket 服务器（`research/app/server/ws/websocket.py`）：通过 `Route.register` 将路径绑定到处理函数。
- 若你只使用其中一种，请以对应方式的 URL 为准。