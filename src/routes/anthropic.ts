import express from 'express';
import config from '../config';
import {
  convertAnthropicRequestToOpenAI,
  convertOpenAIResponseToAnthropic
} from '../services/index';

const router = express.Router();

// Anthropic消息API路由
router.post('/messages', async (req, res) => {
  try {
    // 获取请求体
    const anthropicRequest = req.body;
    // 验证请求
    if (!anthropicRequest || !Array.isArray(anthropicRequest.messages)) {
      return res.status(400).json({
        type: 'invalid_request_error',
        error: {
          type: 'invalid_request_error',
          message: 'Invalid request format'
        }
      });
    }

    // 转换请求格式
    const openAIRequest = convertAnthropicRequestToOpenAI(anthropicRequest, config.defaultOpenAIModel);

    // 获取API密钥
    const apiKey = req.headers['x-api-key'] as string || config.openaiApiKey;
    if (!apiKey) {
      return res.status(401).json({
        type: 'authentication_error',
        error: {
          type: 'authentication_error',
          message: 'Missing API key'
        }
      });
    }
    // console.log('openAIRequest:', openAIRequest);
    // 发送请求到OpenAI API
    // 使用AbortController实现超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    try {
      const openAIResponse = await fetch(config.openaiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(openAIRequest),
        signal: controller.signal
      });

      // 清除超时定时器
      clearTimeout(timeoutId);

      // 处理响应
      if (!openAIResponse.ok) {
        const errorData = await openAIResponse.json().catch(() => ({})) as any;
        console.error('OpenAI API error:', errorData);
        return res.status(openAIResponse.status).json({
          type: 'api_error',
          error: {
            type: 'api_error',
            message: errorData.error?.message || 'OpenAI API error'
          }
        });
      }

      // 转换响应格式
      const openAIData = await openAIResponse.json() as any;
      const anthropicResponse = convertOpenAIResponseToAnthropic(openAIData);

      // console.log('Response:', anthropicResponse);
      // 返回转换后的响应
      res.json(anthropicResponse);
    } catch (error) {
      // 清除超时定时器
      clearTimeout(timeoutId);
      
      // 检查是否是超时错误
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Request timeout after', config.timeout, 'ms');
        return res.status(408).json({
          type: 'timeout_error',
          error: {
            type: 'timeout_error',
            message: 'Request timeout'
          }
        });
      }
      
      // 重新抛出错误，由外部catch处理
      throw error;
    }

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      type: 'internal_error',
      error: {
        type: 'internal_error',
        message: error instanceof Error ? error.message : 'Internal server error'
      }
    });
  }
});

export default router;