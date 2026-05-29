import { describe, expect, it } from 'vitest';

import { TranslateSubtitleUseCase } from '../../../src/app/TranslateSubtitleUseCase.js';
import type { LlmChatRequest, LlmChatResponse, LlmProvider } from '../../../src/domain/llm/index.js';
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

  it('reports chunk progress while translating', async () => {
    const fileSystem = new MemoryFileSystem({
      'input.srt': ['1', '00:00:01,000 --> 00:00:03,000', 'Hello'].join('\n')
    });
    const eventTypes: string[] = [];
    const useCase = new TranslateSubtitleUseCase({
      fileSystem,
      parser: new SrtParser(),
      exporter: new SrtExporter(),
      chunker: new DefaultSubtitleChunker(),
      provider: new MockLlmProvider(),
      promptTemplate,
      onProgress: (event) => eventTypes.push(event.type)
    });

    await useCase.execute({
      jobId: 'progress-job',
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      targetLanguage: 'zh-CN'
    });

    expect(eventTypes).toEqual(['started', 'chunk-start', 'chunk-success', 'finished']);
  });

  it('translates multiple chunks concurrently', async () => {
    const fileSystem = new MemoryFileSystem({
      'input.srt': [
        '1',
        '00:00:01,000 --> 00:00:02,000',
        'Line 1',
        '',
        '2',
        '00:00:02,000 --> 00:00:03,000',
        'Line 2',
        '',
        '3',
        '00:00:03,000 --> 00:00:04,000',
        'Line 3',
        '',
        '4',
        '00:00:04,000 --> 00:00:05,000',
        'Line 4'
      ].join('\n')
    });
    const provider = new SlowJsonProvider();
    const useCase = new TranslateSubtitleUseCase({
      fileSystem,
      parser: new SrtParser(),
      exporter: new SrtExporter(),
      chunker: new DefaultSubtitleChunker({
        maxLines: 1,
        maxChars: 100,
        contextBeforeLines: 0,
        contextAfterLines: 0
      }),
      provider,
      promptTemplate,
      providerRequestsPerMinute: 60000,
      maxConcurrentChunks: 4
    });

    await useCase.execute({
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      targetLanguage: 'zh-CN'
    });

    expect(provider.maxActiveCalls).toBeGreaterThan(1);
    expect(fileSystem.files.get('output.srt')).toContain('[slow] Line 4');
  });

  it('retries invalid model responses before failing the chunk', async () => {
    const fileSystem = new MemoryFileSystem({
      'input.srt': ['1', '00:00:01,000 --> 00:00:03,000', 'Hello'].join('\n')
    });
    const provider = new FlakyJsonProvider();
    const retryEvents: number[] = [];
    const jobStore = new MemoryJobStore();
    const useCase = new TranslateSubtitleUseCase({
      fileSystem,
      parser: new SrtParser(),
      exporter: new SrtExporter(),
      chunker: new DefaultSubtitleChunker(),
      provider,
      promptTemplate,
      jobStore,
      onProgress: (event) => {
        if (event.type === 'chunk-retry') {
          retryEvents.push(event.retryCount);
        }
      }
    });

    await useCase.execute({
      jobId: 'retry-job',
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      targetLanguage: 'zh-CN',
      maxRetries: 3
    });

    expect(provider.calls).toBe(2);
    expect(retryEvents).toEqual([1]);
    expect(jobStore.jobs.get('retry-job')?.chunks[0]).toMatchObject({ retryCount: 1, status: 'SUCCESS' });
    expect(fileSystem.files.get('output.srt')).toContain('[flaky] Hello');
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

class SlowJsonProvider implements LlmProvider {
  readonly name = 'slow-json';
  activeCalls = 0;
  maxActiveCalls = 0;

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    this.activeCalls += 1;
    this.maxActiveCalls = Math.max(this.maxActiveCalls, this.activeCalls);

    try {
      await delay(30);
      const userMessage = [...request.messages].reverse().find((message) => message.role === 'user');
      const items = extractPromptItems(userMessage?.content ?? '');

      return {
        content: JSON.stringify({
          items: items.map((item) => ({ id: item.id, translation: `[slow] ${item.text}` }))
        })
      };
    } finally {
      this.activeCalls -= 1;
    }
  }
}

class FlakyJsonProvider implements LlmProvider {
  readonly name = 'flaky-json';
  calls = 0;

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    this.calls += 1;

    if (this.calls === 1) {
      return { content: '这不是 JSON' };
    }

    const userMessage = [...request.messages].reverse().find((message) => message.role === 'user');
    const items = extractPromptItems(userMessage?.content ?? '');

    return {
      content: JSON.stringify({
        items: items.map((item) => ({ id: item.id, translation: `[flaky] ${item.text}` }))
      })
    };
  }
}

interface PromptItem {
  id: string;
  text: string;
}

function extractPromptItems(prompt: string): PromptItem[] {
  const marker = 'Current items:';
  const start = prompt.indexOf(marker);

  if (start < 0) {
    return [];
  }

  const afterMarker = prompt.slice(start + marker.length);
  const nextMarker = afterMarker.indexOf('\n\nNext context:');
  const jsonText = (nextMarker >= 0 ? afterMarker.slice(0, nextMarker) : afterMarker).trim();

  return JSON.parse(jsonText) as PromptItem[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
