import type { LlmProvider } from '../domain/llm/index.js';
import { ConfigError } from '../shared/errors/AppError.js';
import { AnthropicProvider } from './anthropic/AnthropicProvider.js';
import type { AnthropicProviderConfig } from './anthropic/AnthropicProviderConfig.js';
import { MockLlmProvider } from './mock/MockLlmProvider.js';
import { OpenAiCompatibleProvider } from './openai-compatible/OpenAiCompatibleProvider.js';
import type { OpenAiCompatibleProviderConfig } from './openai-compatible/OpenAiCompatibleProviderConfig.js';
import { OpenAiProvider } from './openai/OpenAiProvider.js';
import type { OpenAiProviderConfig } from './openai/OpenAiProviderConfig.js';

export type LlmProviderType = 'openai' | 'anthropic' | 'openai-compatible' | 'mock';

export interface LlmProviderFactoryConfig {
  llm: {
    provider: LlmProviderType;
    openai?: OpenAiProviderConfig;
    anthropic?: AnthropicProviderConfig;
    openaiCompatible?: OpenAiCompatibleProviderConfig;
  };
}

export function createLlmProvider(config: LlmProviderFactoryConfig): LlmProvider {
  switch (config.llm.provider) {
    case 'openai':
      return new OpenAiProvider(requireProviderConfig(config.llm.openai, 'openai'));
    case 'anthropic':
      return new AnthropicProvider(requireProviderConfig(config.llm.anthropic, 'anthropic'));
    case 'openai-compatible':
      return new OpenAiCompatibleProvider(requireProviderConfig(config.llm.openaiCompatible, 'openai-compatible'));
    case 'mock':
      return new MockLlmProvider();
  }
}

function requireProviderConfig<T>(config: T | undefined, provider: LlmProviderType): T {
  if (!config) {
    throw new ConfigError(`${provider} 缺少 Provider 配置。`);
  }

  return config;
}
