import {
  convertOpenAIRequestToAnthropic,
  convertAnthropicResponseToOpenAI
} from './index';

describe('OpenAI to Anthropic Converter', () => {
  describe('convertOpenAIRequestToAnthropic', () => {
    test('should convert basic OpenAI request to Anthropic format', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'Hello!' }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.model).toBe('claude-3-haiku-20240229');
      expect(result.messages).toEqual([
        { role: 'user', content: [{ type: 'text' as const, text: 'Hello!' }] }
      ]);
    });

    test('should extract system message from OpenAI request', () => {
      const openAIRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'Hello!' }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.system).toBe('You are a helpful assistant.');
      expect(result.messages).toEqual([
        { role: 'user', content: [{ type: 'text' as const, text: 'Hello!' }] }
      ]);
    });

    test('should map GPT models to Claude models', () => {
      const openAIRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user' as const, content: 'Hello!' }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.model).toBe('claude-3-opus-20240229');
    });

    test('should use default model for unknown models', () => {
      const openAIRequest = {
        model: 'unknown-model',
        messages: [
          { role: 'user' as const, content: 'Hello!' }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.model).toBe('claude-3-opus-20240229');
    });

    test('should convert temperature and max_tokens', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'Hello!' }
        ],
        temperature: 0.7,
        max_tokens: 100
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.temperature).toBe(0.7);
      expect(result.max_tokens).toBe(100);
    });

    test('should convert stop parameter to stop_sequences', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'Hello!' }
        ],
        stop: ['END', 'STOP']
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.stop_sequences).toEqual(['END', 'STOP']);
    });

    test('should convert single stop string to stop_sequences array', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'Hello!' }
        ],
        stop: 'END'
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.stop_sequences).toEqual(['END']);
    });
  });

  describe('convertAnthropicResponseToOpenAI', () => {
    test('should convert Anthropic response to OpenAI format', () => {
      const anthropicResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Hello! How can I help you?' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn' as const,
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      };

      const result = convertAnthropicResponseToOpenAI(anthropicResponse);

      expect(result.choices[0].message.content).toBe('Hello! How can I help you?');
    });

    test('should handle multiple content blocks', () => {
      const anthropicResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: 'Hello!' },
          { type: 'text' as const, text: 'How can I help you?' }
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn' as const,
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      };

      const result = convertAnthropicResponseToOpenAI(anthropicResponse);

      expect(result.choices[0].message.content).toBe('Hello! How can I help you?');
    });
  });
});
