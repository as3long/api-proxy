import {
  AnthropicRequest,
  OpenAIRequest,
  OpenAIMessage,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicResponse,
  OpenAIResponse,
  OpenAIToolCall,
  reverseModelMapping
} from './types';

/**
 * 将Anthropic响应转换为OpenAI响应
 * @param response Anthropic格式的响应
 * @returns OpenAI格式的响应
 */
export function convertAnthropicResponseToOpenAI(response: AnthropicResponse): OpenAIResponse {
  if (!response || !response.content) {
    throw new Error('Invalid Anthropic response: missing required fields');
  }

  let textContent: string | null = null;
  let toolCalls: OpenAIToolCall[] = [];

  // 处理Content Blocks
  let contentBlocks: any[] = [];
  if (Array.isArray(response.content)) {
    contentBlocks = response.content;
  } else if (typeof response.content === 'string') {
    // 处理content为字符串的情况
    contentBlocks = [{ type: 'text', text: response.content }];
  } else {
    console.log('Unknown content type:', response.content);
  }
  
  contentBlocks.forEach(block => {
    switch (block.type) {
      case 'text':
        if (textContent) {
          textContent += ' ' + block.text;
        } else {
          textContent = block.text;
        }
        break;
      case 'tool_use':
        // 确保工具使用参数正确
        if (block.id && block.name) {
          let argumentsStr: string;
          if (typeof block.input === 'string') {
            argumentsStr = block.input || '{}';
          } else if (block.input === undefined || block.input === null) {
            argumentsStr = '{}';
          } else {
            // 将对象转换为JSON字符串
            argumentsStr = JSON.stringify(block.input);
          }
          toolCalls.push({
            id: block.id,
            type: 'function' as const,
            function: {
              name: block.name,
              arguments: argumentsStr
            }
          });
        }
        break;
      case 'thinking':
        // OpenAI不支持thinking，将其作为文本内容
        if (textContent) {
          textContent += `\n[Thinking] ${block.thinking}`;
        } else {
          textContent = `[Thinking] ${block.thinking}`;
        }
        break;
    }
  });

  // 构建OpenAI响应
  const openAIMessage: OpenAIMessage = {
    role: response.role as 'user' | 'assistant',
    content: textContent || null
  };

  if (toolCalls.length > 0) {
    openAIMessage.tool_calls = toolCalls;
  }

  return {
    id: response.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [{
      index: 0,
      message: openAIMessage,
      finish_reason: response.stop_reason
    }],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens
    }
  };
}

/**
 * 将Anthropic请求转换为OpenAI请求
 * @param request Anthropic格式的请求
 * @param defaultModel 默认的OpenAI模型
 * @returns OpenAI格式的请求
 */
export function convertAnthropicRequestToOpenAI(request: AnthropicRequest, defaultModel: string = 'gpt-3.5-turbo'): OpenAIRequest {
  if (!request || !request.messages) {
    throw new Error('Invalid Anthropic request: missing required fields');
  }

  // 转换消息格式
  const openAIMessages: OpenAIMessage[] = [];

  request.messages.forEach(msg => {
    if (msg.role === 'user' || msg.role === 'assistant') {
      let textContent: string | null = null;
      let toolCalls: OpenAIToolCall[] = [];
      let toolResult: any = null;

      // 处理Content Blocks
      let contentBlocks: any[] = [];
      if (Array.isArray(msg.content)) {
        contentBlocks = msg.content;
      } else if (typeof msg.content === 'string') {
        // 处理content为字符串的情况
        contentBlocks = [{ type: 'text', text: msg.content }];
      }
      
      contentBlocks.forEach(block => {
        switch (block.type) {
          case 'text':
            textContent = block.text;
            break;
          case 'tool_use':
            // 确保工具使用参数正确
            if (block.id && block.name) {
              let argumentsStr: string;
              if (typeof block.input === 'string') {
                argumentsStr = block.input || '{}';
              } else if (block.input === undefined || block.input === null) {
                argumentsStr = '{}';
              } else {
                // 将对象转换为JSON字符串
                argumentsStr = JSON.stringify(block.input);
              }
              toolCalls.push({
                id: block.id,
                type: 'function' as const,
                function: {
                  name: block.name,
                  arguments: argumentsStr
                }
              });
            }
            break;
          case 'tool_result':
            // 确保工具结果参数正确
            if (block.tool_use_id) {
              toolResult = {
                tool_call_id: block.tool_use_id,
                content: block.content || ''
              };
            }
            break;
          case 'thinking':
            // OpenAI不支持thinking，将其作为文本内容
            if (textContent) {
              textContent += `\n[Thinking] ${block.thinking}`;
            } else {
              textContent = `[Thinking] ${block.thinking}`;
            }
            break;
        }
      });

      // 处理助手消息
      if (msg.role === 'assistant') {
        const assistantMessage: OpenAIMessage = {
          role: 'assistant',
          content: textContent || null
        };

        if (toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
        }

        openAIMessages.push(assistantMessage);
      }

      // 处理用户消息
      if (msg.role === 'user') {
        if (textContent) {
          openAIMessages.push({
            role: 'user',
            content: textContent
          });
        }

        // 处理工具结果
        if (toolResult) {
          openAIMessages.push({
            role: 'tool' as const,
            content: toolResult.content,
            tool_call_id: toolResult.tool_call_id
          } as OpenAIMessage);
        }
      }
    }
  });

  // 如果有系统消息，添加到消息数组开头
    if (request.system) {
      let systemContent: string;
      if (Array.isArray(request.system)) {
        // 处理系统消息为数组的情况
        systemContent = request.system
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } else {
        // 处理系统消息为字符串的情况
        systemContent = request.system;
      }
      openAIMessages.unshift({
        role: 'system',
        content: systemContent
      });
    }

  // 转换模型
  const openAIModel = reverseModelMapping[request.model] || defaultModel;

  // 构建OpenAI请求
  const openAIRequest: OpenAIRequest = {
    model: openAIModel,
    messages: openAIMessages,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    top_p: request.top_p,
  };

  // 转换stop_sequences参数
  if (request.stop_sequences) {
    openAIRequest.stop = request.stop_sequences.length === 1 ? request.stop_sequences[0] : request.stop_sequences;
  }

  // 转换工具定义
  if (request.tools) {
    openAIRequest.tools = request.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  }

  // 转换tool_choice参数
  if (request.tool_choice) {
    if (typeof request.tool_choice === 'object') {
      switch (request.tool_choice.type) {
        case 'tool':
          openAIRequest.tool_choice = {
            type: 'function',
            function: { name: request.tool_choice.name }
          };
          break;
        case 'auto':
          openAIRequest.tool_choice = 'auto';
          break;
        case 'none':
          openAIRequest.tool_choice = 'none';
          break;
      }
    } else {
      // 处理tool_choice为字符串的情况
      openAIRequest.tool_choice = request.tool_choice;
    }
  }

  return openAIRequest;
}