import { describe, expect, it } from 'vitest';

import { AnthropicProvider } from '../../../src/providers/anthropic/AnthropicProvider.js';
import type { ProviderFetch } from '../../../src/providers/shared/ProviderHttp.js';

describe('AnthropicProvider', () => {
  it('maps system messages to Anthropic top-level system field', async () => {
    const fake = createJsonFetch({
      content: [
        { type: 'text', text: '{"items":' },
        { type: 'text', text: '[]}' }
      ],
      usage: { input_tokens: 11, output_tokens: 5 }
    });
    const provider = new AnthropicProvider({
      apiKey: 'ant-key',
      model: 'claude-default',
      anthropicVersion: '2023-06-01',
      fetchFn: fake.fetchFn
    });

    const result = await provider.chat({
      model: 'claude-test',
      messages: [
        { role: 'system', content: '系统规则 A' },
        { role: 'system', content: '系统规则 B' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ],
      maxOutputTokens: 256,
      responseFormat: 'json'
    });

    expect(fake.calls[0]?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(fake.calls[0]?.headers['x-api-key']).toBe('ant-key');
    expect(fake.calls[0]?.headers['anthropic-version']).toBe('2023-06-01');
    expect(fake.calls[0]?.body).toMatchObject({
      model: 'claude-test',
      max_tokens: 256,
      system: '系统规则 A\n\n系统规则 B'
    });
    expect(fake.calls[0]?.body.messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' }
    ]);
    expect(fake.calls[0]?.body).not.toHaveProperty('response_format');
    expect(result).toMatchObject({
      content: '{"items":[]}',
      usage: { inputTokens: 11, outputTokens: 5, totalTokens: 16 }
    });
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
