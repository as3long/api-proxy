import { Request, Response, NextFunction } from 'express';
import { saveTokenRecordFlatBufferAsync } from './token-stats-flatbuffer';

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

async function saveTokenRecord(record: TokenRecord) {
  await saveTokenRecordFlatBufferAsync(record);
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

  // 用于标记流式响应是否已记录
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
        // 异步保存，不等待完成
        saveTokenRecord(record).catch(console.error);
      }
    }

    return originalJson(body);
  };

  // 流式响应统计 - 拦截 write 方法
  // 优化：使用字符串匹配代替 JSON 解析，仅在流结束时解析，提升首字节延迟
  if (isStreaming) {
    res.write = function(chunk: any, ...args: any[]): boolean {
      const chunkStr = chunk.toString();

      // 仅在流结束时才解析 usage，平时只做字符串检查
      if (!streamRecorded) {
        // 快速字符串匹配检查流是否结束
        const isStreamEnd = chunkStr.includes('[DONE]') ||
                           chunkStr.includes('data: [DONE]') ||
                           chunkStr.includes('event: message_stop');

        if (isStreamEnd) {
          // 流结束，统计耗时
          const responseTime = Date.now() - startTime;
          let usage: { inputTokens: number; outputTokens: number } | null = null;

          // 优先从响应头获取（上游 API 会在结束时通过响应头传递）
          const xRayUsage = res.getHeader('x-usage') || res.getHeader('x-amazon-xray-usage');
          usage = parseXRayUsage(xRayUsage as string);

          // 响应头没有时，才从 chunk 中用正则提取（仅解析最后一次）
          if (!usage) {
            if (req.path.includes('/chat/completions')) {
              // 尝试用正则提取 OpenAI usage
              const usageMatch = chunkStr.match(/"usage"\s*:\s*\{[^}]*"prompt_"\s*:\s*(\d+)/);
              const completionMatch = chunkStr.match(/"completion_tokens"\s*:\s*(\d+)/);
              if (usageMatch && completionMatch) {
                usage = {
                  inputTokens: parseInt(usageMatch[1], 10),
                  outputTokens: parseInt(completionMatch[1], 10)
                };
              }
            } else if (req.path.includes('/messages')) {
              // 尝试用正则提取 Anthropic usage
              const inputMatch = chunkStr.match(/"input_"\s*:\s*(\d+)/);
              const outputMatch = chunkStr.match(/"output_"\s*:\s*(\d+)/);
              if (inputMatch && outputMatch) {
                usage = {
                  inputTokens: parseInt(inputMatch[1], 10),
                  outputTokens: parseInt(outputMatch[1], 10)
                };
              }
            }
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
            // 异步保存，不等待完成
            saveTokenRecord(record).catch(console.error);
            streamRecorded = true;
          }
        }
      }

      return originalWrite(chunk, ...args);
    };
  }

  next();
}