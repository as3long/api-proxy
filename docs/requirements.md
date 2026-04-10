# 需求文档：OpenAI to Anthropic API 代理

## 1. 项目概述

本项目旨在创建一个API代理服务，支持OpenAI兼容的API与Anthropic兼容的API之间的双向转换，使得只支持OpenAI格式的应用能够与Anthropic的API进行交互，同时也支持只支持Anthropic格式的应用与OpenAI API进行交互。

## 2. 功能需求

### 2.1 核心功能

1. **API格式转换**：支持OpenAI格式与Anthropic格式之间的双向转换
2. **API服务器**：提供OpenAI兼容和Anthropic兼容的API端点
3. **配置管理**：支持通过环境变量或配置文件进行配置
4. **错误处理**：提供友好的错误响应

### 2.2 支持的API端点

#### OpenAI兼容端点
- `/v1/chat/completions` - 聊天完成API（接收OpenAI格式请求，转发到Anthropic API）

#### Anthropic兼容端点
- `/v1/messages` - 消息API（接收Anthropic格式请求，转发到OpenAI API）

### 2.3 请求转换

#### OpenAI请求格式：

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

#### Anthropic请求格式：

```json
{
  "model": "claude-3-opus-20240229",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "system": "You are a helpful assistant.",
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1
}
```

### 2.4 响应转换

将Anthropic的响应转换为OpenAI格式的响应，确保客户端能够正确处理。

### 2.5 反向转换

将OpenAI格式的请求转换为Anthropic格式，将OpenAI的响应转换为Anthropic格式。

#### OpenAI请求格式：

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1
}
```

#### Anthropic请求格式：

```json
{
  "model": "claude-3-opus-20240229",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "system": "You are a helpful assistant.",
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1
}
```

## 3. 技术需求

### 3.1 技术栈

- Node.js 18+
- TypeScript
- Express.js
- 其他必要的依赖包

### 3.2 项目结构

```
api-proxy/
├── src/
│   ├── index.ts           # 服务器入口
│   ├── routes/
│   │   └── chat.ts        # 聊天API路由
│   ├── services/
│   │   └── converter.ts   # 格式转换服务
│   └── config/
│       └── index.ts       # 配置管理
├── package.json
├── tsconfig.json
└── README.md
```

### 3.3 配置项

| 配置项 | 类型 | 默认值 | 描述 |
|-------|------|-------|------|
| PORT | number | 3000 | 服务器端口 |
| ANTHROPIC_API_KEY | string | - | Anthropic API密钥 |
| OPENAI_API_KEY | string | - | OpenAI API密钥 |
| DEFAULT_MODEL | string | claude-3-opus-20240229 | 默认使用的Anthropic模型 |
| DEFAULT_OPENAI_MODEL | string | gpt-3.5-turbo | 默认使用的OpenAI模型 |
| TIMEOUT | number | 30000 | API请求超时时间（毫秒） |

## 4. 性能需求

- 响应时间：转换和转发请求的时间应小于100ms
- 并发处理：能够同时处理至少100个请求
- 错误率：转换错误率应低于0.1%

## 5. 安全需求

- API密钥安全：不在日志中记录API密钥
- 输入验证：验证请求格式，防止恶意输入
- CORS配置：合理配置CORS策略

## 6. 测试需求

- 单元测试：测试转换逻辑
- 集成测试：测试完整的API流程
- 性能测试：测试并发处理能力

## 7. 部署需求

- 支持Docker部署
- 支持环境变量配置
- 提供健康检查端点

## 8. 开发计划

1. 项目初始化和基础结构搭建
2. 编写README.md和需求文档
3. 实现配置管理模块
4. 实现请求/响应转换核心逻辑
5. 实现API服务器和路由
6. 编写测试用例
7. 优化和完善功能
8. 部署和文档更新

## 9. 验收标准

- 能够成功将OpenAI格式的请求转换为Anthropic格式
- 能够将Anthropic的响应转换为OpenAI格式
- 支持所有主要的请求参数
- 提供友好的错误处理
- 性能满足要求
- 代码质量良好，测试覆盖率高