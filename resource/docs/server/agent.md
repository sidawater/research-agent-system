# Research Agent System - Agent/Graph 文档

## 1. Agents

### 1.1 学术搜索 Agent (Academic Search Agent)
- **文件路径**: `research/core/agents/search/deepseek.py`
- **功能**: 根据用户问题进行学术文献检索
- **输入**: 用户查询问题
- **输出**: 结构化的学术搜索结果，包括：
  - 查询问题
  - 研究综述摘要
  - 5-10篇参考文献（包含标题、链接、作者、发表年份、摘要、正文节选）

### 1.2 Semantic Scholar Agent (Semantic Scholar搜索代理)
- **文件路径**: `research/core/agents/search/scholar/`
- **功能**: 基于Semantic Scholar API的学术文献搜索与查询优化
- **主要组件**:
  - **agent.py**: Agent核心逻辑
  - **schema.py**: 数据模型定义
  - **prompt.py**: 提示词模板定义
  - **semantic.py**: Semantic Scholar API接口封装

#### 1.2.1 核心类与功能

**SemanticScholarAPI**
- 封装Semantic Scholar API接口
- 提供论文搜索、结果格式化等功能
- 支持查询参数配置（年份、领域、返回字段等）

**QueryOptimizerAgent**
- 基于LangChain的查询优化代理
- 使用OpenAI模型优化搜索查询
- 支持多轮对话和记忆功能
- 可配置的系统提示词和查询参数

**SemanticScholarAgentManager**
- Agent实例管理器
- 支持创建、调用、销毁Agent实例
- 提供Agent状态管理和清理功能

#### 1.2.2 数据模型

**QueryConfig**
- 查询配置数据模型
- 包含默认字段、最大查询数、年份范围等配置

**SearchQuery**
- 搜索查询数据模型
- 包含查询字符串、返回字段、过滤条件等

**Paper**
- 论文数据模型
- 包含论文ID、标题、摘要、年份、作者等信息

**AgentConfig**
- Agent配置数据模型
- 包含模型名称、温度、系统提示词等配置

#### 1.2.3 使用流程
1. 通过SemanticScholarAgentManager创建Agent实例
2. 配置Agent参数（模型、温度、查询配置等）
3. 调用Agent.invoke()方法执行搜索
4. Agent自动优化查询并返回格式化结果
5. 可通过AgentManager管理多个Agent实例

### 1.3 报告生成 Agent (Report Writer Agent)
- **文件路径**: `research/core/agents/report/summary.py`
- **功能**: 根据学术搜索结果生成专业的研究报告
- **输入**: 学术搜索结果
- **输出**: 格式化的研究报告文本，包含：
  - 详细分析部分
  - 规范的参考文献引用
  - 符合学术规范的内容组织

## 2. Graph 工作流

### 2.1 工作流节点
- **academic_search**: 学术搜索节点
- **write_report**: 报告撰写节点

### 2.2 工作流执行流程
1. **academic_search** → 人为判断搜索结果
   - 搜索结果不满意 → 继续学术搜索
   - 搜索结果满意 → 生成报告(write_report)
2. **write_report** → 人为判断报告内容
   - 报告内容不满意 → 
     - 仅修改报告 → 返回报告生成(write_report)
     - 参考文献不足 → 返回学术搜索(academic_search)
   - 报告内容满意 → 完成
