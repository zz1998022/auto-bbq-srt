import { describe, expect, it } from 'vitest';

import { resolveTranslateConfig } from '../../../src/infrastructure/config/LlmProviderConfigResolver.js';
import { ConfigError } from '../../../src/shared/errors/AppError.js';

describe('resolveTranslateConfig', () => {
  it('uses mock defaults when no local config is present', () => {
    expect(resolveTranslateConfig({})).toMatchObject({
      providerConfig: { llm: { provider: 'mock' } },
      defaults: {
        provider: 'mock',
        model: 'mock-translate',
        targetLanguage: 'zh-CN',
        style: 'natural-subtitle',
        maxRetries: 3
      }
    });
  });

  it('maps local OpenAI settings to provider factory config', () => {
    expect(
      resolveTranslateConfig({
        llm: {
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4.1-mini'
        },
        translation: {
          targetLanguage: 'ja-JP',
          style: '口语化，适合综艺字幕',
          maxRetries: 5
        }
      })
    ).toMatchObject({
      providerConfig: {
        llm: {
          provider: 'openai',
          openai: {
            apiKey: 'sk-test',
            model: 'gpt-4.1-mini'
          }
        }
      },
      defaults: {
        provider: 'openai',
        model: 'gpt-4.1-mini',
        targetLanguage: 'ja-JP',
        style: '口语化，适合综艺字幕',
        maxRetries: 5
      }
    });
  });

  it('requires baseUrl for OpenAI-compatible providers', () => {
    expect(() =>
      resolveTranslateConfig({
        llm: {
          provider: 'openai-compatible',
          apiKey: 'sk-test',
          model: 'deepseek-chat'
        }
      })
    ).toThrow(ConfigError);
  });

  it('allows CLI provider override while reusing local credentials', () => {
    expect(
      resolveTranslateConfig(
        {
          llm: {
            provider: 'mock',
            apiKey: 'sk-test',
            model: 'claude-sonnet-4-5'
          }
        },
        'anthropic'
      )
    ).toMatchObject({
      providerConfig: {
        llm: {
          provider: 'anthropic',
          anthropic: {
            apiKey: 'sk-test',
            model: 'claude-sonnet-4-5'
          }
        }
      }
    });
  });
});
