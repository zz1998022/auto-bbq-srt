import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FileTranslationCache } from '../../../src/infrastructure/cache/FileTranslationCache.js';

describe('FileTranslationCache', () => {
  it('stores and reads translated chunks by cache key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'auto-bbq-cache-'));

    try {
      const cache = new FileTranslationCache(dir);

      await cache.set('cache-key', {
        chunkId: 'chunk-0001',
        items: [{ id: '1', translation: '你好' }]
      });

      await expect(cache.get('cache-key')).resolves.toEqual({
        chunkId: 'chunk-0001',
        items: [{ id: '1', translation: '你好' }]
      });
      await expect(cache.get('missing-key')).resolves.toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
