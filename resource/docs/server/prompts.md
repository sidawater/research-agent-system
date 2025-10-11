# Prompts 管理接口文档

## 概述

Prompts 管理接口提供对 AI Agent 系统提示词的动态管理功能，支持获取、设置和查看所有提示词。提示词存储在 MongoDB 数据库中，同时也支持内存中的默认提示词。

## 接口列表

### 1. 获取所有提示词

#### 请求
```
GET /api/v1/prompts
```

#### 响应
```json
{
  "deepseek": "提示词内容...",
  "semantic_scholar": "提示词内容...",
  "report_writing": "提示词内容..."
}
```

#### 说明
- 返回系统中所有可用的提示词
- 包括默认提示词和自定义提示词
- 自定义提示词会覆盖默认提示词

### 2. 获取指定提示词

#### 请求
```
GET /api/v1/prompts/{key}
```

#### 参数
| 参数名 | 类型   | 必填 | 说明           |
| ------ | ------ | ---- | -------------- |
| key    | string | 是   | 提示词的标识符 |

#### 响应
```json
{
  "key": "deepseek",
  "prompt": "提示词内容..."
}
```

#### 说明
- 根据 key 获取指定的提示词
- 优先从 MongoDB 获取自定义提示词
- 如果 MongoDB 中不存在，则返回内存中的默认提示词

### 3. 设置指定提示词

#### 请求
```
POST /api/v1/prompts/{key}
```

#### 参数
| 参数名 | 类型   | 必填 | 说明           |
| ------ | ------ | ---- | -------------- |
| key    | string | 是   | 提示词的标识符 |
| prompt | string | 是   | 提示词内容     |

#### 响应
```json
{
  "key": "deepseek",
  "prompt": "新的提示词内容..."
}
```

#### 说明
- 设置指定 key 的提示词内容
- 数据同时保存到 MongoDB 和内存中
- 支持新增和更新操作

## 提示词标识符

系统当前支持的提示词标识符包括：

- `deepseek`: DeepSeek 模型使用的系统提示词
- `semantic_scholar`: Semantic Scholar 搜索使用的系统提示词
- `report_writing`: 报告撰写使用的系统提示词

## 存储机制

- 默认提示词存储在 `research/core/agents/prompts.py` 文件中
- 自定义提示词存储在 MongoDB 的 `agent_config` 集合中
- 自定义提示词优先级高于默认提示词
- 系统重启后，自定义提示词会从数据库恢复