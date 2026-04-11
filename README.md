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

### 统计数据接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stats/data` | GET | 获取调用统计 |
| `/token-stats/data` | GET | 获取 Token 统计 |
| `/token-stats/clear` | POST | 清空 Token 统计 |
| `/token-stats.html` | GET | Token 消耗统计可视化页面 |

#### Token 消耗统计可视化页面 (/token-stats.html)

访问 `/token-stats.html` 可查看 Token 消耗统计的可视化页面，包含：
- 总请求数、输入/输出 Token 数统计
- 按 API 类型和模型分组的统计图表
- 最近 100 条请求记录的详细列表

#### 调用统计 (/api/stats/data)

返回统计数据包含以下信息：
- `totalRequests`: 总请求数
- `totalTokens`: 消耗的总 token 数
- `avgResponseTime`: 平均响应时间(毫秒)
- `successRate`: 请求成功率
- `byModel`: 按模型分组的统计

#### Token 统计 (/token-stats/data)

返回详细的 Token 使用统计和最近 100 条记录：

**汇总信息：**
- `totalRequests`: 总请求数
- `totalInputTokens`: 总输入 Token 数
- `totalOutputTokens`: 总输出 Token 数
- `totalTokens`: 消耗的总 Token 数
- `avgResponseTime`: 平均响应时间(毫秒)
- `successRate`: 请求成功率
- `byApiType`: 按 API 类型(openai/anthropic)分组的统计
- `byModel`: 按模型分组的统计

**记录格式：**
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "apiType": "openai",
  "route": "/v1/chat/completions",
  "model": "gpt-4",
  "inputTokens": 100,
  "outputTokens": 200,
  "totalTokens": 300,
  "responseTime": 15000,
  "statusCode": 200,
  "isStream": false
}
```

- `isStream`: 是否为流式响应 (`true` / `false`)

**数据存储位置：** `data/tokens.csv` (CSV 格式)

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