import { describe, expect, it } from 'vitest';

import { OpenAiProvider } from '../../../src/providers/openai/OpenAiProvider.js';
import type { ProviderFetch } from '../../../src/providers/shared/ProviderHttp.js';
import { LlmProviderError } from '../../../src/shared/errors/AppError.js';

describe('OpenAiProvider', () => {
  it('maps internal chat requests to official OpenAI chat completions', async () => {
    const fake = createJsonFetch({
      choices: [{ message: { content: '{"items":[]}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 }
    });
    const provider = new OpenAiProvider({ apiKey: 'test-key', model: 'gpt-default', fetchFn: fake.fetchFn });

    const result = await provider.chat({
      model: 'gpt-test',
      messages: [
        { role: 'system', content: '只输出 JSON' },
        { role: 'user', content: 'Hello' }
      ],
      temperature: 0.2,
      maxOutputTokens: 128,
      responseFormat: 'json'
    });

    expect(fake.calls[0]?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(fake.calls[0]?.headers.authorization).toBe('Bearer test-key');
    expect(fake.calls[0]?.body).toMatchObject({
      model: 'gpt-test',
      temperature: 0.2,
      max_tokens: 128,
      response_format: { type: 'json_object' }
    });
    expect(fake.calls[0]?.body.messages).toEqual([
      { role: 'system', content: '只输出 JSON' },
      { role: 'user', content: 'Hello' }
    ]);
    expect(result).toMatchObject({
      content: '{"items":[]}',
      usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 }
    });
  });

  it('wraps OpenAI API errors with provider context', async () => {
    const fake = createJsonFetch({ error: { message: 'rate limited' } }, 429);
    const provider = new OpenAiProvider({ apiKey: 'test-key', model: 'gpt-test', fetchFn: fake.fetchFn });

    await expect(provider.chat({ model: 'gpt-test', messages: [] })).rejects.toThrow(LlmProviderError);
    await expect(provider.chat({ model: 'gpt-test', messages: [] })).rejects.toThrow('HTTP 429');
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
