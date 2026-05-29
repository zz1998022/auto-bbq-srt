import type { TranslationJob } from '../domain/translation/index.js';
import type { JobStore } from '../infrastructure/job-store/JobStore.js';
import type { TranslateSubtitleRequest, TranslateSubtitleResult } from './TranslateSubtitleUseCase.js';

export interface ResumeTranslationRequest {
  jobId: string;
}

export interface ResumeTranslationResult extends TranslateSubtitleResult {
  resumed: boolean;
  status: TranslationJob['status'];
}

export interface ResumeTranslationUseCaseDependencies {
  jobStore: JobStore;
  translator: {
    execute(request: TranslateSubtitleRequest): Promise<TranslateSubtitleResult>;
  };
}

export class ResumeTranslationUseCase {
  constructor(private readonly dependencies: ResumeTranslationUseCaseDependencies) {}

  async execute(request: ResumeTranslationRequest): Promise<ResumeTranslationResult> {
    const job = await this.dependencies.jobStore.get(request.jobId);

    if (!job) {
      throw new Error(`未找到任务：${request.jobId}`);
    }

    if (job.status === 'SUCCESS') {
      return {
        jobId: job.jobId,
        lineCount: 0,
        chunkCount: job.chunks.length,
        outputFile: job.outputFile,
        resumed: false,
        status: job.status
      };
    }

    const result = await this.dependencies.translator.execute({
      jobId: job.jobId,
      inputFile: job.inputFile,
      outputFile: job.outputFile,
      targetLanguage: job.targetLanguage ?? 'zh-CN',
      ...(job.sourceLanguage ? { sourceLanguage: job.sourceLanguage } : {}),
      ...(job.style ? { style: job.style } : {}),
      ...(job.model ? { model: job.model } : {})
    });

    return {
      ...result,
      resumed: true,
      status: 'SUCCESS'
    };
  }
}
