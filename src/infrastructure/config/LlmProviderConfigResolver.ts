import type { LlmProviderFactoryConfig, LlmProviderType } from '../../providers/LlmProviderFactory.js';
import { ConfigError } from '../../shared/errors/AppError.js';
import type { CliConfig } from './LocalCliConfigStore.js';

export interface TranslationCliDefaults {
  provider: LlmProviderType;
  model: string;
  targetLanguage: string;
  style: string;
  maxRetries: number;
}

export interface ResolvedTranslateConfig {
  providerConfig: LlmProviderFactoryConfig;
  defaults: TranslationCliDefaults;
}

export function resolveTranslateConfig(config: CliConfig, providerOverride?: string): ResolvedTranslateConfig {
  const provider = parseProvider(providerOverride ?? readString(config, 'llm.provider') ?? 'mock');
  const model =
    provider === 'mock'
      ? (readString(config, 'llm.model') ?? 'mock-translate')
      : requireModel(provider, readString(config, 'llm.model'));
  const targetLanguage = readString(config, 'translation.targetLanguage') ?? 'zh-CN';
  const style = readString(config, 'translation.style') ?? 'natural-subtitle';
  const maxRetries = readNumber(config, 'translation.maxRetries') ?? 3;
  const apiKey = readString(config, 'llm.apiKey');
  const baseUrl = readString(config, 'llm.baseUrl');

  return {
    providerConfig: buildProviderConfig({ provider, model, apiKey, baseUrl }),
    defaults: { provider, model, targetLanguage, style, maxRetries }
  };
}

function buildProviderConfig(options: {
  provider: LlmProviderType;
  model: string;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
}): LlmProviderFactoryConfig {
  switch (options.provider) {
    case 'mock':
      return { llm: { provider: 'mock' } };
    case 'openai':
      return {
        llm: {
          provider: 'openai',
          openai: {
            apiKey: requireApiKey(options.provider, options.apiKey),
            model: options.model,
            ...(options.baseUrl ? { baseUrl: options.baseUrl } : {})
          }
        }
      };
    case 'anthropic':
      return {
        llm: {
          provider: 'anthropic',
          anthropic: {
            apiKey: requireApiKey(options.provider, options.apiKey),
            model: options.model,
            ...(options.baseUrl ? { baseUrl: options.baseUrl } : {})
          }
        }
      };
    case 'openai-compatible':
      return {
        llm: {
          provider: 'openai-compatible',
          openaiCompatible: {
            apiKey: requireApiKey(options.provider, options.apiKey),
            baseUrl: requireBaseUrl(options.provider, options.baseUrl),
            model: options.model
          }
        }
      };
  }
}

function parseProvider(provider: string): LlmProviderType {
  if (provider === 'openai' || provider === 'anthropic' || provider === 'openai-compatible' || provider === 'mock') {
    return provider;
  }

  throw new ConfigError(`不支持的 LLM Provider：${provider}`);
}

function requireApiKey(provider: LlmProviderType, apiKey: string | undefined): string {
  if (!apiKey) {
    throw new ConfigError(`${provider} 缺少 API Key，请先执行 auto-bbq config set --setting llm.apiKey=...`);
  }

  return apiKey;
}

function requireModel(provider: LlmProviderType, model: string | undefined): string {
  if (!model) {
    throw new ConfigError(`${provider} 缺少模型，请先执行 auto-bbq config set --setting llm.model=...`);
  }

  return model;
}

function requireBaseUrl(provider: LlmProviderType, baseUrl: string | undefined): string {
  if (!baseUrl) {
    throw new ConfigError(`${provider} 必须配置 baseUrl，请先执行 auto-bbq config set --setting llm.baseUrl=...`);
  }

  return baseUrl;
}

function readString(config: CliConfig, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((cursor, part) => {
    if (!isRecord(cursor)) {
      return undefined;
    }

    return cursor[part];
  }, config);

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(config: CliConfig, path: string): number | undefined {
  const value = path.split('.').reduce<unknown>((cursor, part) => {
    if (!isRecord(cursor)) {
      return undefined;
    }

    return cursor[part];
  }, config);

  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
