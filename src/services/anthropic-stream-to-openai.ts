/**
 * 将Anthropic流式响应转换为OpenAI流式格式
 */

/**
 * 解析Anthropic SSE行
 */
function parseAnthropicLine(line: string): { event?: string; data?: string } {
  if (line.startsWith('event: ')) {
    return { event: line.slice(7).trim() };
  }
  if (line.startsWith('data: ')) {
    return { data: line.slice(6).trim() };
  }
  return {};
}

/**
 * 处理Anthropic事件，转换为OpenAI格式
 */
export function convertAnthropicEventToOpenAI(
  event: string,
  data: any,
  messageId: string,
  model: string
): string | null {
  switch (event) {
    case 'message_start': {
      const openAIChunk = {
        id: data.message?.id || messageId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: { role: 'assistant', content: '' },
          finish_reason: null
        }]
      };
      return `data: ${JSON.stringify(openAIChunk)}`;
    }

    case 'content_block_start': {
      const contentBlock = data.content_block;
      if (contentBlock?.type === 'text') {
        const openAIChunk = {
          id: messageId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            delta: { content: '' },
            finish_reason: null
          }]
        };
        return `data: ${JSON.stringify(openAIChunk)}`;
      }
      if (contentBlock?.type === 'tool_use') {
        const openAIChunk = {
          id: messageId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: data.index,
                id: contentBlock.id,
                type: 'function',
                function: { name: contentBlock.name, arguments: '' }
              }]
            },
            finish_reason: null
          }]
        };
        return `data: ${JSON.stringify(openAIChunk)}`;
      }
      return null;
    }

    case 'content_block_delta': {
      const delta = data.delta;
      if (delta?.type === 'text') {
        const openAIChunk = {
          id: messageId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            delta: { content: delta.text },
            finish_reason: null
          }]
        };
        return `data: ${JSON.stringify(openAIChunk)}`;
      }
      if (delta?.type === 'input_json_delta') {
        const openAIChunk = {
          id: messageId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: data.index,
                type: 'function',
                function: { arguments: delta.partial_json }
              }]
            },
            finish_reason: null
          }]
        };
        return `data: ${JSON.stringify(openAIChunk)}`;
      }
      return null;
    }

    case 'message_delta': {
      const openAIChunk = {
        id: messageId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: data.stop_reason || 'stop'
        }]
      };
      return `data: ${JSON.stringify(openAIChunk)}`;
    }

    case 'message_stop': {
      return 'data: [DONE]';
    }

    default:
      return null;
  }
}

/**
 * 将Anthropic流式响应转换为OpenAI SSE格式
 * @param anthropicStream Anthropic流式响应体
 * @param model 模型名称
 * @returns AsyncGeneratoryielding OpenAI SSE格式字符串
 */
export async function* convertAnthropicStreamToOpenAI(
  anthropicStream: ReadableStream<Uint8Array>,
  model: string
): AsyncGenerator<string> {
  const reader = anthropicStream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let currentData = '';
  let messageId = `msg_${Date.now()}`;

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
        if (line === '') {
          // 空行表示事件结束
          if (currentEvent && currentData) {
            try {
              const data = JSON.parse(currentData);
              const result = convertAnthropicEventToOpenAI(currentEvent, data, messageId, model);
              if (result) {
                yield result + '\n';
              }
              // 获取message_id
              if (currentEvent === 'message_start' && data.message?.id) {
                messageId = data.message.id;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
          currentEvent = '';
          currentData = '';
        } else {
          const parsed = parseAnthropicLine(line);
          if (parsed.event) {
            currentEvent = parsed.event;
          }
          if (parsed.data) {
            currentData = parsed.data;
          }
        }
      }
    }

    // 处理最后的事件
    if (currentEvent && currentData) {
      try {
        const data = JSON.parse(currentData);
        const result = convertAnthropicEventToOpenAI(currentEvent, data, messageId, model);
        if (result) {
          yield result + '\n';
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  } finally {
    reader.releaseLock();
  }
}