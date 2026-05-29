import { describe, expect, it } from 'vitest';

import { ResumeTranslationUseCase } from '../../../src/app/ResumeTranslationUseCase.js';
import type { TranslateSubtitleRequest, TranslateSubtitleResult } from '../../../src/app/TranslateSubtitleUseCase.js';
import type { TranslationJob } from '../../../src/domain/translation/index.js';
import type { JobStore } from '../../../src/infrastructure/job-store/JobStore.js';

describe('ResumeTranslationUseCase', () => {
  it('returns completed jobs without rerunning translation', async () => {
    const jobStore = new MemoryJobStore({
      jobId: 'done-job',
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      status: 'SUCCESS',
      chunks: [{ chunkId: 'chunk-0001', status: 'SUCCESS', retryCount: 0, cacheHit: false }],
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:01.000Z'
    });
    const translator = new RecordingTranslator();

    const result = await new ResumeTranslationUseCase({ jobStore, translator }).execute({ jobId: 'done-job' });

    expect(result).toMatchObject({ jobId: 'done-job', resumed: false, status: 'SUCCESS', outputFile: 'output.srt' });
    expect(translator.requests).toHaveLength(0);
  });

  it('reruns incomplete jobs with the original job information', async () => {
    const jobStore = new MemoryJobStore({
      jobId: 'failed-job',
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      targetLanguage: 'ja-JP',
      sourceLanguage: 'en',
      style: 'subtitle',
      model: 'mock-translate',
      status: 'FAILED',
      chunks: [{ chunkId: 'chunk-0001', status: 'FAILED', retryCount: 1, cacheHit: false, error: '格式错误' }],
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:01.000Z'
    });
    const translator = new RecordingTranslator();

    const result = await new ResumeTranslationUseCase({ jobStore, translator }).execute({ jobId: 'failed-job' });

    expect(translator.requests[0]).toEqual({
      jobId: 'failed-job',
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      targetLanguage: 'ja-JP',
      sourceLanguage: 'en',
      style: 'subtitle',
      model: 'mock-translate'
    });
    expect(result).toMatchObject({ jobId: 'failed-job', resumed: true, status: 'SUCCESS' });
  });
});

class RecordingTranslator {
  readonly requests: TranslateSubtitleRequest[] = [];

  async execute(request: TranslateSubtitleRequest): Promise<TranslateSubtitleResult> {
    this.requests.push(request);

    return {
      jobId: request.jobId ?? 'new-job',
      lineCount: 1,
      chunkCount: 1,
      outputFile: request.outputFile
    };
  }
}

class MemoryJobStore implements JobStore {
  constructor(private readonly job: TranslationJob | null) {}

  async create(): Promise<void> {
    // resume 测试不会创建新任务。
  }

  async get(jobId: string): Promise<TranslationJob | null> {
    return this.job?.jobId === jobId ? this.job : null;
  }

  async update(): Promise<void> {
    // resume 测试只关心读取和转调翻译入口。
  }

  async writeChunkInput(): Promise<void> {
    // resume 测试不持久化 chunk 详情。
  }

  async writeChunkOutput(): Promise<void> {
    // resume 测试不持久化 chunk 详情。
  }

  async writeChunkRaw(): Promise<void> {
    // resume 测试不持久化原始响应。
  }
}
