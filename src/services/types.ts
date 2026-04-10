// 定义OpenAI工具调用格式
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 定义OpenAI消息格式
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

// 定义OpenAI请求格式
export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
  tool_choice?: 'none' | 'auto' | string | {
    type: 'function';
    function: {
      name: string;
    };
  };
}

// 定义Anthropic Content Block格式
export type AnthropicContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: 'thinking'; thinking: string };

// 定义Anthropic消息格式
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContentBlock[];
}

// 定义Anthropic请求格式
export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string | Array<{
    type: 'text';
    text: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop_sequences?: string[];
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, any>;
  }>;
  tool_choice?: 'none' | 'auto' | string | {
    type: 'tool';
    name: string;
  } | {
    type: 'auto';
  } | {
    type: 'none';
  };
}

// 定义Anthropic响应格式
export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// 定义OpenAI响应格式
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 定义OpenAI聊天完成响应格式
export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 模型映射
export const modelMapping: Record<string, string> = {
  'gpt-3.5-turbo': 'claude-3-haiku-20240229',
  'gpt-4': 'claude-3-opus-20240229',
  'gpt-4-turbo': 'claude-3-opus-20240229',
};

// 反向模型映射
export const reverseModelMapping: Record<string, string> = {
  'claude-3-haiku-20240229': 'gpt-3.5-turbo',
  'claude-3-opus-20240229': 'gpt-4',
  'claude-3-sonnet-20240229': 'gpt-4',
};