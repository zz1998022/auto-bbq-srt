import { describe, expect, it } from 'vitest';

import { OpenAiCompatibleProvider } from '../../../src/providers/openai-compatible/OpenAiCompatibleProvider.js';
import type { ProviderFetch } from '../../../src/providers/shared/ProviderHttp.js';
import { ConfigError } from '../../../src/shared/errors/AppError.js';

describe('OpenAiCompatibleProvider', () => {
  it('uses the explicitly configured compatible base URL', async () => {
    const fake = createJsonFetch({
      choices: [{ message: { content: '{"items":[]}' } }],
      usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 }
    });
    const provider = new OpenAiCompatibleProvider({
      apiKey: 'compatible-key',
      baseUrl: 'https://llm.example.com/v1/',
      model: 'deepseek-chat',
      fetchFn: fake.fetchFn
    });

    const result = await provider.chat({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hello' }],
      responseFormat: 'json'
    });

    expect(fake.calls[0]?.url).toBe('https://llm.example.com/v1/chat/completions');
    expect(fake.calls[0]?.headers.authorization).toBe('Bearer compatible-key');
    expect(fake.calls[0]?.body.response_format).toEqual({ type: 'json_object' });
    expect(result.usage).toEqual({ inputTokens: 2, outputTokens: 4, totalTokens: 6 });
  });

  it('requires baseUrl because compatible providers are third-party endpoints', () => {
    expect(
      () => new OpenAiCompatibleProvider({ apiKey: 'compatible-key', baseUrl: '', model: 'deepseek-chat' })
    ).toThrow(ConfigError);
  });
});

interface CapturedFetchCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function createJsonFetch(responseBody: unknown, status = 200): { fetchFn: ProviderFetch; calls: CapturedFetchCall[] } {
  const calls: CapturedFetchCall[] = [];
  const fetchFn: ProviderFetch = async (input, init) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    });

    return new Response(JSON.stringify(responseBody), { status });
  };

  return { fetchFn, calls };
}
