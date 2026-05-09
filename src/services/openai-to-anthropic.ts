import {
  OpenAIRequest,
  AnthropicRequest,
  OpenAIMessage,
  AnthropicMessage,
  AnthropicContentBlock,
  OpenAIChatCompletionResponse,
  AnthropicResponse
} from './types';

/**
 * 将OpenAI请求转换为Anthropic请求
 * @param request OpenAI格式的请求
 * @param defaultModel 默认的Anthropic模型
 * @returns Anthropic格式的请求
 */
export function convertOpenAIRequestToAnthropic(request: OpenAIRequest, defaultModel: string = 'claude-3-opus-20240229'): AnthropicRequest {
  if (!request || !request.messages) {
    throw new Error('Invalid OpenAI request: missing required fields');
  }

  // 提取系统消息
  let systemMessage = '';
  const userMessages = request.messages.filter(msg => {
    if (msg.role === 'system') {
      systemMessage = msg.content as string;
      return false;
    }
    return true;
  });

  // 转换消息格式
  const anthropicMessages: AnthropicMessage[] = [];

  userMessages.forEach(msg => {
    // 处理工具结果
    if (msg.role === 'tool' && msg.tool_call_id) {
      // 工具结果在Anthropic中作为user消息的一部分
      if (anthropicMessages.length > 0 && anthropicMessages[anthropicMessages.length - 1].role === 'user') {
        anthropicMessages[anthropicMessages.length - 1].content.push({
          type: 'tool_result' as const,
          tool_use_id: msg.tool_call_id,
          content: msg.content || ''
        });
      } else {
        // 创建新的user消息
        anthropicMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result' as const,
            tool_use_id: msg.tool_call_id,
            content: msg.content || ''
          }]
        });
      }
      return;
    }

    if (msg.role === 'user' || msg.role === 'assistant') {
      const contentBlocks: AnthropicContentBlock[] = [];

      // 处理文本内容
      if (msg.content) {
        contentBlocks.push({ type: 'text' as const, text: msg.content });
      }

      // 处理工具调用
      if (msg.role === 'assistant' && msg.tool_calls) {
        msg.tool_calls.forEach(toolCall => {
          // 确保工具调用参数正确
          if (toolCall.type === 'function' && toolCall.function) {
            let inputData: any = {};
            try {
              // 尝试解析arguments为JSON对象
              inputData = JSON.parse(toolCall.function.arguments || '{}');
            } catch (error) {
              // 如果解析失败，使用空对象
              inputData = {};
            }
            contentBlocks.push({
              type: 'tool_use' as const,
              id: toolCall.id,
              name: toolCall.function.name,
              input: inputData
            });
          }
        });
      }

      if (contentBlocks.length > 0) {
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: contentBlocks
        });
      }
    }
  });

  // 转换模型：如果request中包含model信息，则直接使用请求的模型，否则使用默认的
  const anthropicModel = request.model || defaultModel;

  // 构建Anthropic请求
  const anthropicRequest: AnthropicRequest = {
    model: anthropicModel,
    messages: anthropicMessages,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    top_p: request.top_p,
  };

  // 添加系统消息
  if (systemMessage) {
    anthropicRequest.system = systemMessage;
  }

  // 转换stop参数
  if (request.stop) {
    anthropicRequest.stop_sequences = Array.isArray(request.stop) ? request.stop : [request.stop];
  }

  // 转换工具定义
  if (request.tools) {
    anthropicRequest.tools = request.tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters
    }));
  }

  // 转换tool_choice参数
  if (request.tool_choice) {
    if (typeof request.tool_choice === 'object') {
      // 处理OpenAI的tool_choice为对象的情况
      if (request.tool_choice.type === 'function') {
        anthropicRequest.tool_choice = {
          type: 'tool' as const,
          name: request.tool_choice.function.name
        };
      }
    } else {
      // 处理tool_choice为字符串的情况
      anthropicRequest.tool_choice = request.tool_choice;
    }
  }

  return anthropicRequest;
}

/**
 * 将OpenAI响应转换为Anthropic响应
 * @param response OpenAI格式的响应
 * @returns Anthropic格式的响应
 */
export function convertOpenAIResponseToAnthropic(response: OpenAIChatCompletionResponse): AnthropicResponse {
  if (!response || !response.choices || response.choices.length === 0) {
    throw new Error('Invalid OpenAI response: missing required fields');
  }

  // 获取第一个选择的内容
  const choice = response.choices[0];
  const message = choice.message;

  if (!message) {
    throw new Error('Invalid OpenAI response: missing message');
  }

  // 构建Content Blocks
  const contentBlocks: AnthropicContentBlock[] = [];

  // 处理文本内容
  if (message.content) {
    contentBlocks.push({ type: 'text', text: message.content });
  }

  // 处理工具调用
  if (message.tool_calls) {
    message.tool_calls.forEach(toolCall => {
      // 确保工具调用参数正确
      if (toolCall.type === 'function' && toolCall.function) {
        let inputData: any = {};
        try {
          // 尝试解析arguments为JSON对象
          inputData = JSON.parse(toolCall.function.arguments || '{}');
        } catch (error) {
          // 如果解析失败，使用空对象
          inputData = {};
        }
        contentBlocks.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: inputData
        });
      }
    });
  }

  // 构建Anthropic响应
  return {
    id: response.id,
    type: 'message',
    role: message.role,
    content: contentBlocks,
    model: response.model,
    stop_reason: choice.finish_reason,
    usage: {
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens
    }
  };
}