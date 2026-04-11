import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

interface TokenRecord {
  timestamp: string;
  apiType: 'openai' | 'anthropic';
  route: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  responseTime: number;
  statusCode: number;
  isStream: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.csv');
const CSV_HEADER = 'timestamp,apiType,route,model,inputTokens,outputTokens,totalTokens,responseTime,statusCode,isStream';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureCsvHeader() {
  if (!fs.existsSync(TOKEN_FILE)) {
    fs.writeFileSync(TOKEN_FILE, CSV_HEADER + '\n', 'utf-8');
  }
}

function saveTokenRecord(record: TokenRecord) {
  ensureDataDir();
  ensureCsvHeader();
  const row = [
    record.timestamp,
    record.apiType,
    record.route,
    record.model,
    record.inputTokens,
    record.outputTokens,
    record.totalTokens,
    record.responseTime,
    record.statusCode,
    record.isStream
  ].map(v => String(v).replace(/,/g, ';')).join(',');
  fs.appendFileSync(TOKEN_FILE, row + '\n', 'utf-8');
}

function extractUsage(reqPath: string, body: any): { inputTokens: number; outputTokens: number } | null {
  if (!body || !body.usage) {
    return null;
  }

  // Anthropic 路由 (/messages)
  if (reqPath.includes('/messages')) {
    return {
      inputTokens: body.usage.input_tokens || 0,
      outputTokens: body.usage.output_tokens || 0
    };
  }

  // OpenAI 路由 (/chat/completions)
  if (reqPath.includes('/chat/completions')) {
    return {
      inputTokens: body.usage.prompt_tokens || 0,
      outputTokens: body.usage.completion_tokens || 0
    };
  }

  return null;
}

function getApiType(reqPath: string): 'openai' | 'anthropic' {
  if (reqPath.includes('/chat/completions')) {
    return 'openai';
  }
  return 'anthropic';
}

function parseXRayUsage(header: string | null): { inputTokens: number; outputTokens: number } | null {
  if (!header) {
    return null;
  }
  try {
    const usage = JSON.parse(header);
    return {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0
    };
  } catch {
    return null;
  }
}

export function tokenStatsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const isStreaming = req.query.stream === 'true' || req.body?.stream === true;
  const originalJson = res.json.bind(res);
  const originalWrite = res.write.bind(res);

  // 用于存储流式响应的 usage 信息
  let streamRecorded = false;

  res.json = function(body: any) {
    // 非流式响应统计
    if (!isStreaming && body && body.usage) {
      const responseTime = Date.now() - startTime;
      const usage = extractUsage(req.path, body);

      if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
        const record: TokenRecord = {
          timestamp: new Date().toISOString(),
          apiType: getApiType(req.path),
          route: req.path,
          model: body.model || '',
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.inputTokens + usage.outputTokens,
          responseTime,
          statusCode: res.statusCode,
          isStream: false
        };
        saveTokenRecord(record);
      }
    }

    return originalJson(body);
  };

  // 用于存储流式响应的 usage 信息
  let streamUsage: { inputTokens: number; outputTokens: number } | null = null;

  // 流式响应统计 - 拦截 write 方法
  if (isStreaming) {
    res.write = function(chunk: any, ...args: any[]): boolean {
      const chunkStr = chunk.toString();
      
      // 解析 OpenAI 格式的 usage 信息
      if (req.path.includes('/chat/completions')) {
        // 检查是否包含 usage 信息的 chunk
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                if (parsed.usage) {
                  streamUsage = {
                    inputTokens: parsed.usage.prompt_tokens || 0,
                    outputTokens: parsed.usage.completion_tokens || 0
                  };
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }
      
      // 解析 Anthropic 格式的 usage 信息
      if (req.path.includes('/messages')) {
        // 检查是否包含 message_stop 事件
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line === 'event: message_stop') {
            // 查找对应的 data 行
            const dataIndex = lines.indexOf(line) + 1;
            if (dataIndex < lines.length && lines[dataIndex].startsWith('data: ')) {
              const data = lines[dataIndex].slice(6).trim();
              try {
                const parsed = JSON.parse(data);
                if (parsed.usage) {
                  streamUsage = {
                    inputTokens: parsed.usage.input_tokens || 0,
                    outputTokens: parsed.usage.output_tokens || 0
                  };
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }
      
      // 检查是否到达流结束
      if (!streamRecorded && (chunkStr.includes('[DONE]') || chunkStr.includes('data: [DONE]') || chunkStr.includes('event: message_stop'))) {
        // 流结束，计算统计
        const responseTime = Date.now() - startTime;
        
        // 尝试从响应头获取 usage (作为备用)
        let usage = streamUsage;
        if (!usage) {
          const xRayUsage = res.getHeader('x-usage') || res.getHeader('x-amazon-xray-usage');
          usage = parseXRayUsage(xRayUsage as string);
        }

        if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
          const record: TokenRecord = {
            timestamp: new Date().toISOString(),
            apiType: getApiType(req.path),
            route: req.path,
            model: req.body?.model || '',
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.inputTokens + usage.outputTokens,
            responseTime,
            statusCode: res.statusCode,
            isStream: true
          };
          saveTokenRecord(record);
          streamRecorded = true;
        }
      }
      return originalWrite(chunk, ...args);
    };
  }

  next();
}