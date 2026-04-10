import {
  convertOpenAIChunkToAnthropic,
  convertAnthropicEventToOpenAI,
  generateAnthropicStreamHeaders,
  createAnthropicPing
} from './index';

describe('Stream Conversion', () => {
  describe('convertOpenAIChunkToAnthropic', () => {
    test('should convert OpenAI text chunk to Anthropic content_block_delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        choices: [{
          index: 0,
          delta: { content: 'Hello' },
          finish_reason: null
        }]
      };

      const events = convertOpenAIChunkToAnthropic(chunk, 'msg_123', 'gpt-4');
      
      expect(events).toHaveLength(1);
      expect(events[0]).toContain('event: content_block_delta');
      expect(events[0]).toContain('"text":"Hello"');
    });

    test('should convert OpenAI tool_call chunk to Anthropic content_block_delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: 0,
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"city":'
              }
            }]
          },
          finish_reason: null
        }]
      };

      const events = convertOpenAIChunkToAnthropic(chunk, 'msg_123', 'gpt-4');
      
      expect(events).toHaveLength(1);
      expect(events[0]).toContain('event: content_block_delta');
      expect(events[0]).toContain('"input_json_delta"');
      expect(events[0]).toContain('"partial_json":"{\\"city\\":');
    });

    test('should send message_stop on finish', () => {
      const chunk = {
        id: 'chatcmpl-123',
        choices: [{
          index: 0,
          delta: { content: 'Done' },
          finish_reason: 'stop'
        }]
      };

      const events = convertOpenAIChunkToAnthropic(chunk, 'msg_123', 'gpt-4');
      
      expect(events).toHaveLength(2);
      expect(events[1]).toContain('event: message_stop');
    });

    test('should return empty array for empty delta', () => {
      const chunk = {
        id: 'chatcmpl-123',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: null
        }]
      };

      const events = convertOpenAIChunkToAnthropic(chunk, 'msg_123', 'gpt-4');
      
      expect(events).toHaveLength(0);
    });
  });

  describe('convertAnthropicEventToOpenAI', () => {
    test('should convert message_start event', () => {
      const result = convertAnthropicEventToOpenAI(
        'message_start',
        { message: { id: 'msg_123', role: 'assistant' } },
        'msg_123',
        'claude-3'
      );

      expect(result).toContain('data:');
      const parsed = JSON.parse(result!.replace('data: ', ''));
      expect(parsed.object).toBe('chat.completion.chunk');
      expect(parsed.choices[0].delta.role).toBe('assistant');
    });

    test('should convert content_block_start text event', () => {
      const result = convertAnthropicEventToOpenAI(
        'content_block_start',
        { index: 0, content_block: { type: 'text', text: '' } },
        'msg_123',
        'claude-3'
      );

      expect(result).toContain('data:');
      const parsed = JSON.parse(result!.replace('data: ', ''));
      expect(parsed.choices[0].delta.content).toBe('');
    });

    test('should convert content_block_start tool_use event', () => {
      const result = convertAnthropicEventToOpenAI(
        'content_block_start',
        { index: 0, content_block: { type: 'tool_use', id: 'call_123', name: 'get_weather' } },
        'msg_123',
        'claude-3'
      );

      expect(result).toContain('data:');
      const parsed = JSON.parse(result!.replace('data: ', ''));
      expect(parsed.choices[0].delta.tool_calls[0].function.name).toBe('get_weather');
    });

    test('should convert content_block_delta text event', () => {
      const result = convertAnthropicEventToOpenAI(
        'content_block_delta',
        { index: 0, delta: { type: 'text', text: 'Hello' } },
        'msg_123',
        'claude-3'
      );

      expect(result).toContain('data:');
      const parsed = JSON.parse(result!.replace('data: ', ''));
      expect(parsed.choices[0].delta.content).toBe('Hello');
    });

    test('should convert content_block_delta input_json_delta event', () => {
      const result = convertAnthropicEventToOpenAI(
        'content_block_delta',
        { index: 0, delta: { type: 'input_json_delta', partial_json: '{"city":' } },
        'msg_123',
        'claude-3'
      );

      expect(result).toContain('data:');
      const parsed = JSON.parse(result!.replace('data: ', ''));
      expect(parsed.choices[0].delta.tool_calls[0].function.arguments).toBe('{"city":');
    });

    test('should convert message_delta event', () => {
      const result = convertAnthropicEventToOpenAI(
        'message_delta',
        { stop_reason: 'end_turn' },
        'msg_123',
        'claude-3'
      );

      expect(result).toContain('data:');
      const parsed = JSON.parse(result!.replace('data: ', ''));
      expect(parsed.choices[0].finish_reason).toBe('end_turn');
    });

    test('should convert message_stop event to [DONE]', () => {
      const result = convertAnthropicEventToOpenAI('message_stop', {}, 'msg_123', 'claude-3');
      expect(result).toBe('data: [DONE]');
    });

    test('should return null for unknown event', () => {
      const result = convertAnthropicEventToOpenAI('ping', {}, 'msg_123', 'claude-3');
      expect(result).toBeNull();
    });
  });

  describe('generateAnthropicStreamHeaders', () => {
    test('should generate message_start and content_block_start events', () => {
      const events = generateAnthropicStreamHeaders('msg_123', 'claude-3');

      expect(events).toHaveLength(2);
      expect(events[0]).toContain('event: message_start');
      expect(events[1]).toContain('event: content_block_start');
    });

    test('should include correct message structure', () => {
      const events = generateAnthropicStreamHeaders('msg_123', 'claude-3');

      const messageStart = JSON.parse(events[0].replace('event: message_start\ndata: ', ''));
      expect(messageStart.type).toBe('message_start');
      expect(messageStart.message.id).toBe('msg_123');
      expect(messageStart.message.role).toBe('assistant');
    });
  });

  describe('createAnthropicPing', () => {
    test('should create ping event', () => {
      const ping = createAnthropicPing();
      expect(ping).toContain('event: ping');
      expect(ping).toContain('"type":"ping"');
    });
  });
});