import { describe, expect, it } from 'vitest';

import { createLlmProvider } from '../../../src/providers/LlmProviderFactory.js';
import { AnthropicProvider } from '../../../src/providers/anthropic/AnthropicProvider.js';
import { MockLlmProvider } from '../../../src/providers/mock/MockLlmProvider.js';
import { OpenAiCompatibleProvider } from '../../../src/providers/openai-compatible/OpenAiCompatibleProvider.js';
import { OpenAiProvider } from '../../../src/providers/openai/OpenAiProvider.js';
import type { ProviderFetch } from '../../../src/providers/shared/ProviderHttp.js';

describe('createLlmProvider', () => {
  it('creates all supported provider implementations', () => {
    const fetchFn = createJsonFetch({ choices: [{ message: { content: '{}' } }] });

    expect(createLlmProvider({ llm: { provider: 'mock' } })).toBeInstanceOf(MockLlmProvider);
    expect(
      createLlmProvider({ llm: { provider: 'openai', openai: { apiKey: 'key', model: 'gpt-test', fetchFn } } })
    ).toBeInstanceOf(OpenAiProvider);
    expect(
      createLlmProvider({
        llm: { provider: 'anthropic', anthropic: { apiKey: 'key', model: 'claude-test', fetchFn } }
      })
    ).toBeInstanceOf(AnthropicProvider);
    expect(
      createLlmProvider({
        llm: {
          provider: 'openai-compatible',
          openaiCompatible: { apiKey: 'key', baseUrl: 'https://llm.example.com/v1', model: 'model', fetchFn }
        }
      })
    ).toBeInstanceOf(OpenAiCompatibleProvider);
  });
});

function createJsonFetch(responseBody: unknown): ProviderFetch {
  return async () => new Response(JSON.stringify(responseBody));
}
