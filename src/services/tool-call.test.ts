import {
  convertOpenAIRequestToAnthropic,
  convertAnthropicResponseToOpenAI,
  convertAnthropicRequestToOpenAI,
  convertOpenAIResponseToAnthropic
} from './index';

describe('Tool Call Support', () => {
  describe('OpenAI to Anthropic with tools', () => {
    test('should convert OpenAI request with tools to Anthropic format', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'What\'s the weather in Beijing?' }
        ],
        tools: [
          {
            type: 'function' as const,
            function: {
              name: 'get_weather',
              description: 'Get weather information for a city',
              parameters: {
                type: 'object',
                properties: {
                  city: {
                    type: 'string',
                    description: 'The city to get weather for'
                  }
                },
                required: ['city']
              }
            }
          }
        ],
        "tool_choice": "auto"
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.tools).toEqual([
        {
          name: 'get_weather',
          description: 'Get weather information for a city',
          input_schema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: 'The city to get weather for'
              }
            },
            required: ['city']
          }
        }
      ]);
    });

    test('should convert OpenAI assistant message with tool calls to Anthropic format', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'What\'s the weather in Beijing?' },
          {
            role: 'assistant' as const,
            content: 'Let me check',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function' as const,
                function: {
                  name: 'get_weather',
                  arguments: '{"city": "Beijing"}'
                }
              }
            ]
          }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.messages[1].content).toEqual([
        { type: 'text', text: 'Let me check' },
        {
          type: 'tool_use',
          id: 'call_123',
          name: 'get_weather',
          input: { city: 'Beijing' }
        }
      ]);
    });

    test('should convert OpenAI tool result message to Anthropic format', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'What\'s the weather in Beijing?' },
          {
            role: 'assistant' as const,
            content: 'Let me check',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function' as const,
                function: {
                  name: 'get_weather',
                  arguments: '{"city": "Beijing"}'
                }
              }
            ]
          },
          {
            role: 'tool' as const,
            content: 'Sunny, 25°C',
            tool_call_id: 'call_123'
          }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.messages[2].content).toEqual([
        {
          type: 'tool_result',
          tool_use_id: 'call_123',
          content: 'Sunny, 25°C'
        }
      ]);
    });
  });

  describe('Anthropic to OpenAI with tools', () => {
    test('should convert Anthropic request with tools to OpenAI format', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'What\'s the weather in Beijing?' }]
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather information for a city',
            input_schema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'The city to get weather for'
                }
              },
              required: ['city']
            }
          }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather information for a city',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'The city to get weather for'
                }
              },
              required: ['city']
            }
          }
        }
      ]);
    });

    test('should convert Anthropic assistant message with tool_use to OpenAI format', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'What\'s the weather in Beijing?' }]
          },
          {
            role: 'assistant' as const,
            content: [
              { type: 'text' as const, text: 'Let me check' },
              {
                type: 'tool_use' as const,
                id: 'call_123',
                name: 'get_weather',
                input: '{"city": "Beijing"}'
              }
            ]
          }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages[1].tool_calls).toEqual([
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city": "Beijing"}'
          }
        }
      ]);
    });

    test('should convert Anthropic user message with tool_result to OpenAI format', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: 'What\'s the weather in Beijing?' }
            ]
          },
          {
            role: 'assistant' as const,
            content: [
              { type: 'text' as const, text: 'Let me check' },
              {
                type: 'tool_use' as const,
                id: 'call_123',
                name: 'get_weather',
                input: '{"city": "Beijing"}'
              }
            ]
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: 'call_123',
                content: 'Sunny, 25°C'
              }
            ]
          }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages[2].role).toBe('tool');
      expect(result.messages[2].content).toBe('Sunny, 25°C');
      expect(result.messages[2].tool_call_id).toBe('call_123');
    });
  });

  describe('Response conversion with tools', () => {
    test('should convert Anthropic response with tool_use to OpenAI format', () => {
      const anthropicResponse = {
        id: 'msg_123',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: 'Let me check' },
          {
            type: 'tool_use' as const,
            id: 'call_123',
            name: 'get_weather',
            input: '{"city": "Beijing"}'
          }
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'tool_use' as const,
        usage: {
          input_tokens: 50,
          output_tokens: 20
        }
      };

      const result = convertAnthropicResponseToOpenAI(anthropicResponse);

      expect(result.choices[0].message.tool_calls).toEqual([
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"city": "Beijing"}'
          }
        }
      ]);
    });

    test('should convert OpenAI response with tool_calls to Anthropic format', () => {
      const openAIResponse = {
        id: 'chatcmpl_123',
        object: 'chat.completion' as const,
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Let me check',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function' as const,
                function: {
                  name: 'get_weather',
                  arguments: '{"city": "Beijing"}'
                }
              }
            ]
          },
          finish_reason: 'tool_calls' as const
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        }
      };

      const result = convertOpenAIResponseToAnthropic(openAIResponse);

      expect(result.content).toEqual([
        { type: 'text', text: 'Let me check' },
        {
          type: 'tool_use',
          id: 'call_123',
          name: 'get_weather',
          input: { city: 'Beijing' }
        }
      ]);
    });
  });

  describe('Tool Call Edge Cases', () => {
    test('should handle OpenAI tool call with missing function arguments', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'What\'s the weather?' },
          {
            role: 'assistant' as const,
            content: 'Let me check',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function' as const,
                function: {
                  name: 'get_weather',
                  arguments: ''
                }
              }
            ]
          }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.messages[1].content[1]).toEqual({
        type: 'tool_use' as const,
        id: 'call_123',
        name: 'get_weather',
        input: {}
      });
    });

    test('should handle Anthropic tool_use with missing input', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'What\'s the weather?' }]
          },
          {
            role: 'assistant' as const,
            content: [
              { type: 'text' as const, text: 'Let me check' },
              {
                type: 'tool_use' as const,
                id: 'call_123',
                name: 'get_weather',
                input: ''
              }
            ]
          }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages[1].tool_calls).toEqual([
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{}'
          }
        }
      ]);
    });

    test('should handle OpenAI tool result with empty content', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'What\'s the weather?' },
          {
            role: 'assistant' as const,
            content: 'Let me check',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function' as const,
                function: {
                  name: 'get_weather',
                  arguments: '{"city": "Beijing"}'
                }
              }
            ]
          },
          {
            role: 'tool' as const,
            content: '',
            tool_call_id: 'call_123'
          }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.messages[2].content).toEqual([
        {
          type: 'tool_result' as const,
          tool_use_id: 'call_123',
          content: ''
        }
      ]);
    });

    test('should handle Anthropic tool_result with empty content', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'What\'s the weather?' }]
          },
          {
            role: 'assistant' as const,
            content: [
              { type: 'text' as const, text: 'Let me check' },
              {
                type: 'tool_use' as const,
                id: 'call_123',
                name: 'get_weather',
                input: '{"city": "Beijing"}'
              }
            ]
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: 'call_123',
                content: ''
              }
            ]
          }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages[2].role).toBe('tool');
      expect(result.messages[2].content).toBe('');
      expect(result.messages[2].tool_call_id).toBe('call_123');
    });

    test('should handle tool_choice parameter conversion', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'What\'s the weather?' }
        ],
        tools: [
          {
            type: 'function' as const,
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  city: { type: 'string' }
                },
                required: ['city']
              }
            }
          }
        ],
        tool_choice: 'get_weather'
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.tool_choice).toBe('get_weather');
    });

    test('should handle Anthropic tool_choice object format', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'What\'s the weather?' }]
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather information',
            input_schema: {
              type: 'object',
              properties: {
                city: { type: 'string' }
              },
              required: ['city']
            }
          }
        ],
        tool_choice: { type: 'tool' as const, name: 'get_weather' }
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.tool_choice).toEqual({
        type: 'function',
        function: { name: 'get_weather' }
      });
    });

    test('should handle Anthropic tool_choice auto format', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'What\'s the weather?' }]
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather information',
            input_schema: {
              type: 'object',
              properties: {
                city: { type: 'string' }
              },
              required: ['city']
            }
          }
        ],
        tool_choice: { type: 'auto' as const }
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.tool_choice).toBe('auto');
    });

    test('should handle Anthropic tool_choice none format', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'What\'s the weather?' }]
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather information',
            input_schema: {
              type: 'object',
              properties: {
                city: { type: 'string' }
              },
              required: ['city']
            }
          }
        ],
        tool_choice: { type: 'none' as const }
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.tool_choice).toBe('none');
    });
  });

  describe('System Message Handling', () => {
    test('should handle Anthropic system message as string', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'Hello' }]
          }
        ],
        system: 'You are a helpful assistant.'
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toBe('You are a helpful assistant.');
    });

    test('should handle Anthropic system message as list of text blocks', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'Hello' }]
          }
        ],
        system: [
          { type: 'text' as const, text: 'Part 1.' },
          { type: 'text' as const, text: 'Part 2.' }
        ]
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toContain('Part 1.');
      expect(result.messages[0].content).toContain('Part 2.');
    });

    test('should handle OpenAI system message extraction', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'Hello' }
        ]
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.system).toBe('You are a helpful assistant.');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty messages', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: []
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.messages).toEqual([]);
    });

    test('should handle Anthropic empty messages', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: []
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.messages).toEqual([]);
    });

    test('should handle extra parameters', () => {
      const openAIRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user' as const, content: 'Hello' }
        ],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 50,
        stop: ['END'],
        stream: true
      };

      const result = convertOpenAIRequestToAnthropic(openAIRequest);

      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
      expect(result.max_tokens).toBe(50);
      expect(result.stop_sequences).toEqual(['END']);
    });

    test('should handle Anthropic extra parameters', () => {
      const anthropicRequest = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'text' as const, text: 'Hello' }]
          }
        ],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 50,
        stop_sequences: ['END'],
        stream: true
      };

      const result = convertAnthropicRequestToOpenAI(anthropicRequest);

      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
      expect(result.max_tokens).toBe(50);
      expect(result.stop).toBe('END');
    });
  });
});
