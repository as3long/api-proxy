/**
 * 将OpenAI流式响应转换为Anthropic流式事件格式
 */

/**
 * 将OpenAI delta转换为Anthropic delta
 */
function convertDeltaToAnthropic(delta: any): any {
  if (!delta || typeof delta !== 'object') {
    return { type: 'text', text: '' };
  }

  if (delta.content) {
    return { type: 'text', text: delta.content };
  }

  if (delta.tool_calls) {
    // OpenAI流式工具调用格式转换为Anthropic格式
    const toolCall = delta.tool_calls[0];
    if (toolCall) {
      return {
        type: 'input_json_delta',
        partial_json: toolCall.function?.arguments || ''
      };
    }
  }

  if (delta.function_call) {
    return {
      type: 'input_json_delta',
      partial_json: delta.function_call.arguments || ''
    };
  }

  return { type: 'text', text: '' };
}

/**
 * 处理OpenAI流式chunk，转换为Anthropic SSE格式
 */
export function convertOpenAIChunkToAnthropic(
  chunk: any,
  messageId: string,
  model: string
): string[] {
  const events: string[] = [];

  if (!chunk.choices || !chunk.choices[0]) {
    return events;
  }

  const choice = chunk.choices[0];
  const delta = choice.delta;

  // 跳过空增量
  if (!delta || (delta.content === undefined && !delta.tool_calls)) {
    return events;
  }

  // 检查是否是文本内容
  if (delta.content !== undefined) {
    events.push(`event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text',
        text: delta.content
      }
    })}`);
  }

  // 检查是否是工具调用
  if (delta.tool_calls && delta.tool_calls.length > 0) {
    const toolCall = delta.tool_calls[0];
    events.push(`event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'input_json_delta',
        partial_json: toolCall.function?.arguments || ''
      }
    })}`);
  }

  // 检查是否是结束
  if (choice.finish_reason) {
    events.push(`event: message_stop\ndata: ${JSON.stringify({
      type: 'message_stop'
    })}`);
  }

  return events;
}

/**
 * 生成Anthropic流式响应的头部事件
 */
export function generateAnthropicStreamHeaders(messageId: string, model: string): string[] {
  const events: string[] = [];

  // message_start事件
  events.push(`event: message_start\ndata: ${JSON.stringify({
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [],
      model: model
    }
  })}`);

  // content_block_start事件
  events.push(`event: content_block_start\ndata: ${JSON.stringify({
    type: 'content_block_start',
    index: 0,
    content_block: {
      type: 'text',
      text: ''
    }
  })}`);

  return events;
}

/**
 * 创建Anthropic ping事件
 */
export function createAnthropicPing(): string {
  return `event: ping\ndata: ${JSON.stringify({ type: 'ping' })}`;
}

/**
 * 将OpenAI流式响应解析为Anthropic SSE格式
 * @param openAIStream OpenAI流式响应体
 * @param model 模型名称
 * @returns AsyncGeneratoryielding Anthropic SSE格式字符串
 */
export async function* convertOpenAIStreamToAnthropic(
  openAIStream: ReadableStream<Uint8Array>,
  model: string
): AsyncGenerator<string> {
  const reader = openAIStream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let messageId = `msg_${Date.now()}`;
  let headersSent = false;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          if (data === '[DONE]') {
            if (!headersSent) {
              // 如果没有发送过header，发送它们
              for (const event of generateAnthropicStreamHeaders(messageId, model)) {
                yield event + '\n';
              }
              headersSent = true;
            }
            yield `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n`;
            continue;
          }

          try {
            const chunk = JSON.parse(data);

            // 获取或生成message_id
            if (chunk.id && !messageId.startsWith('msg_')) {
              messageId = chunk.id;
            }

            // 发送header事件（仅在第一次收到有效chunk时）
            if (!headersSent) {
              for (const event of generateAnthropicStreamHeaders(messageId, model)) {
                yield event + '\n';
              }
              headersSent = true;
            }

            // 转换并发送delta事件
            const events = convertOpenAIChunkToAnthropic(chunk, messageId, model);
            for (const event of events) {
              yield event + '\n';
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}