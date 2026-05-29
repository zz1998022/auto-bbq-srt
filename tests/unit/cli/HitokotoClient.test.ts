import { describe, expect, it } from 'vitest';

import { fetchHitokoto } from '../../../src/cli/progress/HitokotoClient.js';
import type { ProviderFetch } from '../../../src/providers/shared/ProviderHttp.js';

describe('fetchHitokoto', () => {
  it('requests animation comic and game sentences', async () => {
    let requestedUrl = '';
    const fetchFn: ProviderFetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ hitokoto: '愿你有好运气。', from: '测试出处' }));
    };

    await expect(fetchHitokoto(fetchFn as typeof fetch)).resolves.toEqual({
      text: '愿你有好运气。',
      from: '测试出处'
    });
    expect(requestedUrl).toContain('c=a');
    expect(requestedUrl).toContain('c=b');
    expect(requestedUrl).toContain('c=c');
    expect(requestedUrl).toContain('encode=json');
  });

  it('returns null when the service is unavailable', async () => {
    const fetchFn: ProviderFetch = async () => new Response('service unavailable', { status: 503 });

    await expect(fetchHitokoto(fetchFn as typeof fetch)).resolves.toBeNull();
  });
});
