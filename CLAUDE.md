# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a bidirectional API proxy service that converts between OpenAI-compatible and Anthropic-compatible API formats. It allows clients to use either API format while the proxy handles format translation and forwards requests to the target API.

### Supported Conversions
- **OpenAI → Anthropic**: Client sends OpenAI format to `/v1/chat/completions`, proxy converts and calls Anthropic API
- **Anthropic → OpenAI**: Client sends Anthropic format to `/v1/messages`, proxy converts and calls OpenAI API

Both streaming and non-streaming responses are supported.

## Common Commands

```bash
# Install dependencies
npm install

# Run development server (with hot reload via ts-node)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run all tests
npm test

# Run a single test file
npm test -- src/services/openai-to-anthropic.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Architecture

The proxy has a layered architecture:

### Entry Point
- `src/index.ts` - Express server that mounts routes and starts listening on configured port

### Route Layer (`src/routes/`)
- `chat.ts` - Handles `/v1/chat/completions` (OpenAI format requests)
- `anthropic.ts` - Handles `/v1/messages` (Anthropic format requests)

Each route:
1. Validates incoming requests
2. Calls the appropriate converter service
3. Forwards the converted request to the target API
4. Converts the response back to the client's expected format
5. Handles both streaming and non-streaming modes

### Converter Services (`src/services/`)
The core conversion logic lives here:

| File | Purpose |
|------|---------|
| `openai-to-anthropic.ts` | Converts OpenAI request/response format to Anthropic format |
| `anthropic-to-openai.ts` | Converts Anthropic request/response format to OpenAI format |
| `openai-stream-to-anthropic.ts` | Converts OpenAI streaming to Anthropic SSE format |
| `anthropic-stream-to-openai. ts` | Converts Anthropic SSE to OpenAI streaming format |
| `types.ts` | TypeScript interfaces for all API formats |
| `tool-call. ts` | Tool/function calling conversion logic |

### Configuration (`src/config/`)
- `index.ts` - Loads environment variables from `.env`, provides typed config object

### Middleware (`src/middleware/`)
- `token-stats.ts` - Middleware that intercepts responses and records token usage to `data/tokens.jsonl`

## Key Design Patterns

1. **Bidirectional Conversion**: Each direction (OpenAI↔Anthropic) has its own converter module with `convertXxxToYyy` functions

2. **Streaming Support**: Stream conversion uses async generators to handle Server-Sent Events (SSE) for Anthropic and chunked transfer for OpenAI

3. **Tool Calling**: Both APIs support function/tools - converter maps between OpenAI's `tool_calls` and Anthropic's `tool_use`/`tool_result` content blocks

4. **Timeout Handling**: Uses `AbortController` with configurable timeout from `TIMEOUT` env var (default 30000ms)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| ANTHROPIC_API_KEY | Key for Anthropic API calls | - |
| OPENAI_API_KEY | Key for OpenAI API calls | - |
| DEFAULT_MODEL | Default Anthropic model | claude-3-opus-20240 |
| DEFAULT_OPENAI_MODEL | Default OpenAI model | gpt-3.5-turbo |
| TIMEOUT | Request timeout (ms) | 30000 |
| ANTHROPIC_API_URL | Anthropic API endpoint | https://api.anthropic.com/v1/messages |
| OPENAI_API_URL | OpenAI API endpoint | https://api.openai.com/v1/chat/completions |

## Testing

## Token Statistics

The proxy records token usage for each API call:

- **Data file**: `data/tokens.jsonl` (JSON Lines format, one record per line)

- **Stats API**: `/token-stats/data` - returns aggregated statistics and recent 100 records

- **Clear data**: `POST /token-stats/clear` - deletes all token records

- **Web UI**: `/token-stats.html` - visual statistics dashboard

Stats include: total requests, input/output/total tokens, average response time, success rate, breakdown by API type and model.
Tests use Jest and are co-located with source files (e.g., `openai-to-anthropic.test.ts`). Run specific tests with `npm test -- `.