# 参考文献下载逻辑设计（Client）

本文档描述在客户端（Electron + Vite 前端）中实现参考文献下载的设计与集成点，基于提供的 `SemanticScholarAPI` 封装。

## 目标
- 单个文献下载：不使用 Sci-Hub，优先使用给定 `url`，失败后用 Semantic Scholar 的开放获取 PDF。
- 会话批量下载：为每条文献标记下载状态，并记录 `filepath`，供其他应用调用。

## 依赖与约束
- 依赖 `axios`，Electron 主进程发起下载避免 CORS/跨域与浏览器限制。
- 使用 Semantic Scholar Graph API：
  - `GET /graph/v1/paper/search/match`（标题精确匹配）
  - `GET /graph/v1/paper/search`（关键词检索）
  - 建议字段包含：`paperId,title,year,openAccessPdf,matchScore,url`
- 频率限制：调用 `search`/`match` 之间至少等待 1s。

## 数据结构
- Reference（文献实体，源自会话）
  - `id`: string
  - `title`: string
  - `url`: string | null
  - `filepath`: string | null（下载成功后写入绝对路径）
  - `downloadStatus`: 'pending' | 'success' | 'failed' | 'skipped'
  - `downloadSource`: 'direct' | 'semantic_open_access' | null
  - `errorMessage`: string | null
- DownloadResult（过程返回）
  - `success`: boolean
  - `filepath`: string | null
  - `source`: 同上
  - `errorMessage`: string | null

## 文件保存位置
- 推荐统一目录：`<用户文档>/ResearchAgent/references/<YYYY-MM>/<safe-title>.pdf`
  - Windows 示例：`C:\Users\<User>\Documents\ResearchAgent\references\2025-10\Your_Title.pdf`
  - `safe-title` 需去除非法文件字符并截断至安全长度。
- 实际写入由 Electron 主进程完成，返回绝对路径给渲染进程以更新 `filepath`。

## 单个文献下载流程
1. 尝试直接下载：
   - 使用 `downloadPaper(url)` 获取二进制；校验：
     - `Content-Type` 包含 `application/pdf`；或文件头前 4~5 字节为 `%PDF-`。
   - 成功：保存到目标目录，标记 `downloadStatus=success`，`downloadSource=direct`。
   - 失败或不是 PDF：进入步骤 2。
2. 标题精确匹配查询开放获取：
   - 使用 `searchPaperByTitleMatch(title, fields='paperId,title,matchScore,openAccessPdf', { openAccessPdf: true })`。
   - 若返回 `openAccessPdf.url`：下载并保存，标记 `downloadSource=semantic_open_access`。
   - 若无或匹配失败：进入步骤 3。
3. 关键词检索回退：
   - `searchPapers(title, fields='paperId,title,year,openAccessPdf', limit=5)`。
   - 选取 `openAccessPdf.url` 存在且与标题相似度最高者（可用简单相似度或包含关系）。
   - 成功则下载并保存；否则步骤 4。
4. 标记失败：
   - `downloadStatus=failed`，记录 `errorMessage`（如网络异常、无开放获取）。

## 会话批量下载流程
- 输入：会话中的文献列表 `references[]`。
- 控制：并发建议 `2~4`，对每条间隔 `>=1s` 的 API 调用避免限速。
- 流程：
  1. 初始化：将所有文献标记 `pending`。
  2. 逐条调用「单个文献下载流程」。
  3. 成功：在“sci-hub”存储中记录 `status=success`，并写入 `filepath`。
  4. 失败：记录 `status=failed` 与 `errorMessage`。
- 结果：返回整体统计（成功/失败计数）用于 UI 展示。

## 与现有代码的集成点（client）
- `electron/ipc-handlers.ts`
  - 新增 IPC 通道：`references:download`（单条）、`references:downloadBatch`（批量）。
  - 主进程执行 `axios` 下载与本地写文件，返回保存路径与状态。
- `src/stores/research.ts`
  - 在每条引用对象上增加 `downloadStatus`、`filepath`、`errorMessage`、`downloadSource` 字段。
  - 提供 actions：`downloadReference(id)`、`downloadAllReferences()`，内部通过 IPC 调用主进程；更新状态。
- `src/services/api.ts`
  - 若需要后端同步，则新增 API：`PATCH /references/{id}` 更新 `filepath` 与状态；否则仅前端存储。
- `src/hooks/useWebSocket.ts`
  - 可在会话生成文献后触发批量下载（可配置）。

## 伪代码示例
```ts
// 渲染进程 store action（示意）
async function downloadReference(ref: Reference) {
  update(ref.id, { downloadStatus: 'pending' });

  // step1: direct url
  if (ref.url) {
    const res = await ipcInvoke('references:download', { url: ref.url, title: ref.title });
    if (res.success && res.isPdf) {
      return update(ref.id, {
        downloadStatus: 'success',
        downloadSource: 'direct',
        filepath: res.filepath,
      });
    }
  }

  // step2: semantic match
  const match = await semantic.searchPaperByTitleMatch(
    ref.title,
    'paperId,title,matchScore,openAccessPdf',
    { openAccessPdf: true }
  );
  const oaUrl = match?.data?.openAccessPdf?.url;
  if (oaUrl) {
    const res2 = await ipcInvoke('references:download', { url: oaUrl, title: ref.title });
    if (res2.success && res2.isPdf) {
      return update(ref.id, {
        downloadStatus: 'success',
        downloadSource: 'semantic_open_access',
        filepath: res2.filepath,
      });
    }
  }

  // step3: fallback search
  const list = await semantic.searchPapers(ref.title, 'paperId,title,year,openAccessPdf', 5);
  const cand = pickBestWithOpenAccess(list?.data);
  if (cand?.openAccessPdf?.url) {
    const res3 = await ipcInvoke('references:download', { url: cand.openAccessPdf.url, title: ref.title });
    if (res3.success && res3.isPdf) {
      return update(ref.id, {
        downloadStatus: 'success',
        downloadSource: 'semantic_open_access',
        filepath: res3.filepath,
      });
    }
  }

  update(ref.id, { downloadStatus: 'failed', errorMessage: 'no pdf or network error' });
}
```

## 错误处理与判断
- 非 PDF 判断：优先用响应头 `Content-Type`，其次二进制前缀 `%PDF-`。
- 网络错误：返回并记录 `errorMessage`，不重试或最多一次重试。
- 标题匹配 404：视为无结果，继续后续回退逻辑。

## 测试建议
- 使用 3 类样本：
  - 仅 `url` 可直下；
  - 直下失败但有 `openAccessPdf`；
  - 无法获取 PDF（应标记失败）。
- 验证批量流程并发与限速间隔。
- 验证 `filepath` 可被其他模块读取并打开。

## 备注
- 暂不调用 Sci-Hub 实际下载，仅在“sci-hub”存储命名空间中记录下载状态与本地路径。
- 如需后端参与文件管理，建议在研究服务器增加文件注册 API，以便跨应用共享。