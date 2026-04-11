# API Proxy: OpenAI <-> Anthropic

A bidirectional proxy service that converts OpenAI-compatible API to Anthropic-compatible API and vice versa.

## Features

- Bidirectional conversion between OpenAI and Anthropic formats
- Supports major chat completion APIs
- Simple configuration, easy to deploy
- Built with Node.js and TypeScript

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation Steps

1. Clone the project

```bash
git clone <repository-url>
cd api-proxy
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Configure environment variables

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit the `.env` file and add the following configuration:

```env
# Server configuration
PORT=3000

# Anthropic API configuration
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages

# OpenAI API configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_URL=https://api.openai.com/v1/chat/completions

# Default model configuration
DEFAULT_MODEL=claude-3-opus-20240229
DEFAULT_OPENAI_MODEL=gpt-3.5-turbo

# Timeout configuration (milliseconds)
TIMEOUT=60000
```

## Running

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## Usage

### OpenAI Format Request → Anthropic API

Send requests to this proxy service instead of the OpenAI API. For example:

**Original OpenAI request:**
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

**Proxy service request:**
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

### Anthropic Format Request → OpenAI API

Send requests to this proxy service instead of the Anthropic API. For example:

**Original Anthropic request:**
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

**Proxy service request:**
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

## Supported APIs

### OpenAI-compatible Endpoints
- `/v1/chat/completions` - Chat Completions API (receives OpenAI format, forwards to Anthropic API)

### Anthropic-compatible Endpoints
- `/v1/messages` - Messages API (receives Anthropic format, forwards to OpenAI API)

## Project Structure

```
api-proxy/
├── src/
│   ├── index.ts           # Server entry point
│   ├── routes/
│   │   ├── chat.ts        # Chat API routes (OpenAI compatible)
│   │   └── anthropic.ts  # Message API routes (Anthropic compatible)
│   ├── services/
│   │   ├── converter.ts   # Format conversion service
│   │   └── converter.test.ts # Conversion logic tests
│   └── config/
│       └── index.ts       # Configuration management
├── docs/
│   └── requirements.      # Requirements documentation
├── package.json
├── tsconfig.json
├── jest.config.js
├── .env.example
└── README.md
```

## Development Progress

- [x] Project structure setup
- [x] README documentation
- [x] Requirements documentation
- [x] OpenAI to Anthropic format conversion core logic
- [x] Anthropic to OpenAI format conversion core logic
- [x] API server and routes implementation
- [x] Test cases
- [x] Configuration management
- [x] Feature optimization and improvements
- [x] Bidirectional conversion implementation

## Contributing

Feel free to submit Issues and Pull Requests!

## License

MIT