# API Proxy: OpenAI to Anthropic

一个将OpenAI兼容的API转换为Anthropic兼容API的双向转换代理服务。

## 功能

- 支持OpenAI格式与Anthropic格式之间的双向转换
- 支持主要的聊天完成API
- 配置简单，易于部署
- 基于Node.js和TypeScript开发

## 安装

### 前提条件

- Node.js 18+ 
- npm 或 yarn

### 安装步骤

1. 克隆项目

```bash
git clone <repository-url>
cd api-proxy
```

2. 安装依赖

```bash
npm install
# 或
yarn install
```

3. 配置环境变量

1. 复制环境变量示例文件：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，添加以下配置：

```env
# 服务器配置
PORT=3000

# Anthropic API配置
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages

# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_URL=https://api.openai.com/v1/chat/completions

# 默认模型配置
DEFAULT_MODEL=claude-3-opus-20240229
DEFAULT_OPENAI_MODEL=gpt-3.5-turbo

# 超时配置（毫秒）
TIMEOUT=60000
```

## 运行

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm run build
npm start
```

## 使用方法

### OpenAI格式请求 → Anthropic API

将原本发送到OpenAI API的请求改为发送到本代理服务。例如：

**原OpenAI请求：**
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_openai_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**改为代理服务请求：**
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_anthropic_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Anthropic格式请求 → OpenAI API

将原本发送到Anthropic API的请求改为发送到本代理服务。例如：

**原Anthropic请求：**
```bash
curl https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_anthropic_api_key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-opus-20240229",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "system": "You are a helpful assistant."
  }'
```

**改为代理服务请求：**
```bash
curl http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_openai_api_key" \
  -d '{
    "model": "claude-3-opus-20240229",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "system": "You are a helpful assistant."
  }'
```

## API支持

### OpenAI兼容端点
- `/v1/chat/completions` - 聊天完成API（接收OpenAI格式请求，转发到Anthropic API）

### Anthropic兼容端点
- `/v1/messages` - 消息API（接收Anthropic格式请求，转发到OpenAI API）

## 项目结构

```
api-proxy/
├── src/
│   ├── index.ts           # 服务器入口
│   ├── routes/
│   │   ├── chat.ts        # 聊天API路由（OpenAI兼容）
│   │   └── anthropic.ts  # 消息API路由（Anthropic兼容）
│   ├── services/
│   │   ├── converter.ts   # 格式转换服务
│   │   └── converter.test.ts # 转换逻辑测试
│   └── config/
│       └── index.ts       # 配置管理
├── docs/
│   └── requirements.md    # 需求文档
├── package.json
├── tsconfig.json
├── jest.config.js
├── .env.example
└── README.md
```

## 开发进度

- [x] 项目基础结构搭建
- [x] README.md文档编写
- [x] 需求文档编写
- [x] OpenAI到Anthropic格式转换核心逻辑
- [x] Anthropic到OpenAI格式转换核心逻辑
- [x] API服务器和路由实现
- [x] 测试用例编写
- [x] 配置管理
- [x] 功能优化和完善
- [x] 双向转换功能实现

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT