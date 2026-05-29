import { describe, expect, it } from 'vitest';

import { TranslateSubtitleUseCase } from '../../../src/app/TranslateSubtitleUseCase.js';
import type { FileSystem } from '../../../src/infrastructure/fs/FileSystem.js';
import type { TranslationCache } from '../../../src/infrastructure/cache/TranslationCache.js';
import type { JobStore } from '../../../src/infrastructure/job-store/JobStore.js';
import { MockLlmProvider } from '../../../src/providers/mock/MockLlmProvider.js';
import { DefaultSubtitleChunker } from '../../../src/subtitle/chunkers/DefaultSubtitleChunker.js';
import { SrtExporter } from '../../../src/subtitle/exporters/SrtExporter.js';
import { SrtParser } from '../../../src/subtitle/parsers/SrtParser.js';

const promptTemplate = [
  'Current items:',
  '{{currentLines}}',
  '',
  'Next context:',
  '{{nextLines}}',
  'Target language: {{targetLanguage}}'
].join('\n');

describe('TranslateSubtitleUseCase', () => {
  it('translates an SRT document with the mock provider and preserves timeline', async () => {
    const fileSystem = new MemoryFileSystem({
      'input.srt': [
        '1',
        '00:00:01,000 --> 00:00:03,000',
        'Hello',
        '',
        '2',
        '00:00:04,000 --> 00:00:06,000',
        'World'
      ].join('\n')
    });
    const useCase = new TranslateSubtitleUseCase({
      fileSystem,
      parser: new SrtParser(),
      exporter: new SrtExporter(),
      chunker: new DefaultSubtitleChunker(),
      provider: new MockLlmProvider(),
      promptTemplate
    });

    const result = await useCase.execute({
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      targetLanguage: 'zh-CN'
    });

    expect(result).toMatchObject({ jobId: expect.any(String), lineCount: 2, chunkCount: 1, outputFile: 'output.srt' });
    expect(fileSystem.files.get('output.srt')).toContain('00:00:01,000 --> 00:00:03,000');
    expect(fileSystem.files.get('output.srt')).toContain('[mock:mock-translate] Hello');
  });

  it('uses cache hits and records chunk state in the job store', async () => {
    const fileSystem = new MemoryFileSystem({
      'input.srt': ['1', '00:00:01,000 --> 00:00:03,000', 'Hello'].join('\n')
    });
    const cache = new MemoryCache();
    const jobStore = new MemoryJobStore();
    const useCase = new TranslateSubtitleUseCase({
      fileSystem,
      parser: new SrtParser(),
      exporter: new SrtExporter(),
      chunker: new DefaultSubtitleChunker(),
      provider: new MockLlmProvider(),
      promptTemplate,
      cache,
      jobStore
    });

    await useCase.execute({
      jobId: 'job-1',
      inputFile: 'input.srt',
      outputFile: 'first.srt',
      targetLanguage: 'zh-CN'
    });
    await useCase.execute({
      jobId: 'job-2',
      inputFile: 'input.srt',
      outputFile: 'second.srt',
      targetLanguage: 'zh-CN'
    });

    expect(jobStore.jobs.get('job-1')?.chunks[0]).toMatchObject({ status: 'SUCCESS', cacheHit: false });
    expect(jobStore.jobs.get('job-2')?.chunks[0]).toMatchObject({ status: 'SKIPPED', cacheHit: true });
    expect(fileSystem.files.get('second.srt')).toContain('[mock:mock-translate] Hello');
  });
});

class MemoryFileSystem implements FileSystem {
  readonly files: Map<string, string>;

  constructor(initialFiles: Record<string, string>) {
    this.files = new Map(Object.entries(initialFiles));
  }

  async readText(path: string): Promise<string> {
    const content = this.files.get(path);

    if (content === undefined) {
      throw new Error(`缺少测试文件：${path}`);
    }

    return content;
  }

  async writeText(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}

class MemoryCache implements TranslationCache {
  readonly values = new Map<string, NonNullable<Awaited<ReturnType<TranslationCache['get']>>>>();

  async get(key: string): Promise<Awaited<ReturnType<TranslationCache['get']>>> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: NonNullable<Awaited<ReturnType<TranslationCache['get']>>>): Promise<void> {
    this.values.set(key, value);
  }
}

class MemoryJobStore implements JobStore {
  readonly jobs = new Map<string, Parameters<JobStore['create']>[0]>();

  async create(job: Parameters<JobStore['create']>[0]): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  async get(jobId: string): Promise<Awaited<ReturnType<JobStore['get']>>> {
    return this.jobs.get(jobId) ?? null;
  }

  async update(job: Parameters<JobStore['update']>[0]): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  async writeChunkInput(): Promise<void> {
    // 内存实现只验证调用路径，不持久化 chunk 详情。
  }

  async writeChunkOutput(): Promise<void> {
    // 内存实现只验证调用路径，不持久化 chunk 详情。
  }

  async writeChunkRaw(): Promise<void> {
    // 内存实现只验证调用路径，不持久化原始响应。
  }
}
