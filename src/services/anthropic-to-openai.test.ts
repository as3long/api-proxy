import {
  convertAnthropicRequestToOpenAI,
  convertOpenAIResponseToAnthropic
} from './index';

describe('Anthropic to OpenAI Converter', () => {
  describe('convertAnthropicRequestToOpenAI', () => {
    test('should convert basic Anthropic request to OpenAI format', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello!' }] }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.model).toBe('gpt-4');
      expect(result.messages).toEqual([
        { role: 'user', content: 'Hello!' }
      ]);
    });

    test('should add system message to OpenAI request', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        system: 'You are a helpful assistant.',
        messages: [
          { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello!' }] }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toBe('You are a helpful assistant.');
      expect(result.messages[1].role).toBe('user');
      expect(result.messages[1].content).toBe('Hello!');
    });

    test('should map Claude models to GPT models', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello!' }] }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.model).toBe('gpt-4');
    });

    test('should use default model for unknown models', () => {
      const anthropicRequest = {
        model: 'unknown-model',
        messages: [
          { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello!' }] }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.model).toBe('gpt-3.5-turbo');
    });

    test('should convert temperature and max_tokens', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello!' }] }
        ],
        temperature: 0.7,
        max_tokens: 100
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.temperature).toBe(0.7);
      expect(result.max_tokens).toBe(100);
    });

    test('should convert stop_sequences to stop parameter', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello!' }] }
        ],
        stop_sequences: ['END', 'STOP']
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.stop).toEqual(['END', 'STOP']);
    });

    test('should convert single stop_sequence to stop string', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello!' }] }
        ],
        stop_sequences: ['END']
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.stop).toBe('END');
    });
  });

  describe('convertOpenAIResponseToAnthropic', () => {
    test('should convert OpenAI response to Anthropic format', () => {
      const openAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion' as const,
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      const result = convertOpenAIResponseToAnthropic(openAIResponse);

      expect(result.id).toBe('chatcmpl-123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect((result.content[0] as { type: 'text'; text: string }).text).toBe('Hello! How can I help you?');
      expect(result.model).toBe('gpt-4');
      expect(result.stop_reason).toBe('stop');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(15);
    });
  });
});
