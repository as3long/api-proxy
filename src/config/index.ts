import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 配置接口
interface Config {
  port: number;
  anthropicApiKey: string;
  openaiApiKey: string;
  defaultModel: string;
  defaultOpenAIModel: string;
  timeout: number;
  anthropicApiUrl: string;
  openaiApiUrl: string;
}

// 配置对象
const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  defaultModel: process.env.DEFAULT_MODEL || 'claude-3-opus-20240229',
  defaultOpenAIModel: process.env.DEFAULT_OPENAI_MODEL || 'gpt-3.5-turbo',
  timeout: parseInt(process.env.TIMEOUT || '30000', 10),
  anthropicApiUrl: process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
  openaiApiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
};

// 验证配置
if (!config.anthropicApiKey) {
  console.warn('ANTHROPIC_API_KEY is not set');
}
if (!config.openaiApiKey) {
  console.warn('OPENAI_API_KEY is not set');
}

export default config;