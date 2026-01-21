import OpenAI from 'openai';

export const getAIClient = () => {
  const apiKey = process.env.MS_API_KEY;
  const baseURL = process.env.MS_BASE_URL || 'https://api.modelscope.cn/v1';

  if (!apiKey) {
    console.warn('MS_API_KEY is not set');
  }

  return new OpenAI({
    apiKey: apiKey || 'dummy-key',
    baseURL: baseURL,
  });
};

export const DEFAULT_MODEL = process.env.MS_MODEL || 'deepseek-ai/DeepSeek-R1-distill-Qwen-7B';
