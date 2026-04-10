import express from 'express';
import config from '../config';
import {
  convertOpenAIRequestToAnthropic,
  convertAnthropicResponseToOpenAI,
  convertAnthropicStreamToOpenAI
} from '../services/index';

const router = express.Router();

// 聊天完成API路由
router.post('/completions', async (req, res) => {
  try {
    // 获取请求体
    const openAIRequest = req.body;
    
    // 验证请求
    if (!openAIRequest || !Array.isArray(openAIRequest.messages)) {
      return res.status(400).json({
        error: {
          message: 'Invalid request format',
          type: 'invalid_request_error',
          code: 'invalid_format'
        }
      });
    }

    // 转换请求格式
    const anthropicRequest = convertOpenAIRequestToAnthropic(openAIRequest, config.defaultModel);

    // 获取API密钥
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || config.anthropicApiKey;
    if (!apiKey) {
      return res.status(401).json({
        error: {
          message: 'Missing API key',
          type: 'authentication_error',
          code: 'missing_api_key'
        }
      });
    }

    // 检查是否请求流式响应
    const isStreaming = openAIRequest.stream === true;

    // 发送请求到Anthropic API
    // 使用AbortController实现超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const anthropicResponse = await fetch(config.anthropicApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(anthropicRequest),
        signal: controller.signal
      });

      // 清除超时定时器
      clearTimeout(timeoutId);

      // 处理响应
      if (!anthropicResponse.ok) {
        const errorData = await anthropicResponse.json().catch(() => ({})) as any;
        return res.status(anthropicResponse.status).json({
          error: {
            message: errorData.error?.message || 'Anthropic API error',
            type: 'api_error',
            code: errorData.error?.type || 'anthropic_error'
          }
        });
      }

      // 处理流式响应
      if (isStreaming && anthropicResponse.body) {
        // 设置SSE响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Request-Id', anthropicResponse.headers.get('X-Request-Id') || '');

        // 转换流式响应
        const stream = convertAnthropicStreamToOpenAI(
          anthropicResponse.body,
          openAIRequest.model || config.defaultModel
        );

        for await (const chunk of stream) {
          res.write(chunk);
        }
        res.end();
        return;
      }

      // 非流式响应处理
      const anthropicData = await anthropicResponse.json() as any;
      const openAIResponse = convertAnthropicResponseToOpenAI(anthropicData);

      // 返回转换后的响应
      res.json(openAIResponse);
    } catch (error) {
      // 清除超时定时器
      clearTimeout(timeoutId);
      
      // 检查是否是超时错误
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Request timeout after', config.timeout, 'ms');
        return res.status(408).json({
          error: {
            message: 'Request timeout',
            type: 'timeout_error',
            code: 'timeout'
          }
        });
      }
      
      // 重新抛出错误，由外部catch处理
      throw error;
    }

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

export default router;