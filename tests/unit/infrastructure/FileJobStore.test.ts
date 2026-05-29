import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { TranslationJob } from '../../../src/domain/translation/index.js';
import { FileJobStore } from '../../../src/infrastructure/job-store/FileJobStore.js';

describe('FileJobStore', () => {
  it('persists job manifest and chunk artifacts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'auto-bbq-jobs-'));

    try {
      const store = new FileJobStore(dir);
      const job: TranslationJob = {
        jobId: 'job-1',
        inputFile: 'input.srt',
        outputFile: 'output.srt',
        status: 'RUNNING',
        chunks: [{ chunkId: 'chunk-0001', status: 'PENDING', retryCount: 0, cacheHit: false }],
        createdAt: '2026-05-29T00:00:00.000Z',
        updatedAt: '2026-05-29T00:00:00.000Z'
      };

      await store.create(job);
      await store.writeChunkInput('job-1', {
        chunkId: 'chunk-0001',
        startIndex: 1,
        endIndex: 1,
        lines: [{ id: '1', index: 1, timeRange: { startMs: 0, endMs: 1000 }, sourceText: 'Hello' }]
      });
      await store.writeChunkOutput('job-1', {
        chunkId: 'chunk-0001',
        items: [{ id: '1', translation: '你好' }]
      });
      await store.writeChunkRaw('job-1', 'chunk-0001', '{"items":[]}');

      await expect(store.get('job-1')).resolves.toMatchObject({ jobId: 'job-1', status: 'RUNNING' });
      await expect(store.get('missing-job')).resolves.toBeNull();
      await expect(readFile(join(dir, 'job-1', 'chunks', 'chunk-0001.raw.txt'), 'utf8')).resolves.toBe('{"items":[]}');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
