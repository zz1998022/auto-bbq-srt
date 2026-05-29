import { randomUUID } from 'node:crypto';
import pLimit from 'p-limit';

import type { LlmProvider } from '../domain/llm/index.js';
import type { SubtitleChunk, SubtitleDocument } from '../domain/subtitle/index.js';
import type { TranslatedChunk, TranslationJob, TranslationOptions } from '../domain/translation/index.js';
import { createHash } from '../infrastructure/hash/createHash.js';
import type { JobStore } from '../infrastructure/job-store/JobStore.js';
import { updateChunkTask } from '../infrastructure/job-store/JobStore.js';
import { NullTranslationCache } from '../infrastructure/cache/NullTranslationCache.js';
import type { TranslationCache } from '../infrastructure/cache/TranslationCache.js';
import type { FileSystem } from '../infrastructure/fs/FileSystem.js';
import type { SubtitleExporter } from '../subtitle/exporters/SubtitleExporter.js';
import type { SubtitleParser } from '../subtitle/parsers/SubtitleParser.js';
import type { SubtitleChunker } from '../subtitle/chunkers/SubtitleChunker.js';
import { TranslationPromptBuilder } from '../translation/TranslationPromptBuilder.js';
import { TranslationResponseParser } from '../translation/TranslationResponseParser.js';
import {
  CountMatchValidator,
  EmptyTranslationValidator,
  LengthLimitValidator,
  MissingIdValidator,
  UntranslatedTextValidator,
  mergeValidationResults,
  type TranslationValidator
} from '../translation/validators/index.js';
import { TranslationValidationError } from '../shared/errors/AppError.js';

const DEFAULT_PROVIDER_REQUESTS_PER_MINUTE = 1000;
const DEFAULT_MAX_CONCURRENT_CHUNKS = Math.ceil(DEFAULT_PROVIDER_REQUESTS_PER_MINUTE / 60);

export interface TranslateSubtitleRequest {
  inputFile: string;
  outputFile: string;
  targetLanguage: string;
  jobId?: string;
  sourceLanguage?: string;
  style?: string;
  model?: string;
  maxRetries?: number;
}

export interface TranslateSubtitleResult {
  jobId: string;
  lineCount: number;
  chunkCount: number;
  outputFile: string;
}

export type TranslateSubtitleProgressEvent =
  | {
      type: 'started';
      jobId: string;
      lineCount: number;
      chunkCount: number;
    }
  | {
      type: 'chunk-start';
      jobId: string;
      chunkId: string;
      completedChunks: number;
      chunkCount: number;
    }
  | {
      type: 'chunk-success';
      jobId: string;
      chunkId: string;
      completedChunks: number;
      chunkCount: number;
      cacheHit: boolean;
    }
  | {
      type: 'chunk-retry';
      jobId: string;
      chunkId: string;
      completedChunks: number;
      chunkCount: number;
      retryCount: number;
      maxRetries: number;
      error: string;
    }
  | {
      type: 'chunk-failed';
      jobId: string;
      chunkId: string;
      completedChunks: number;
      chunkCount: number;
      error: string;
    }
  | {
      type: 'finished';
      jobId: string;
      completedChunks: number;
      chunkCount: number;
    };

export interface TranslateSubtitleUseCaseDependencies {
  fileSystem: FileSystem;
  parser: SubtitleParser;
  exporter: SubtitleExporter;
  chunker: SubtitleChunker;
  provider: LlmProvider;
  promptTemplate: string;
  validators?: TranslationValidator[];
  cache?: TranslationCache;
  jobStore?: JobStore;
  onProgress?: (event: TranslateSubtitleProgressEvent) => void;
  providerRequestsPerMinute?: number;
  maxConcurrentChunks?: number;
}

export class TranslateSubtitleUseCase {
  private readonly responseParser = new TranslationResponseParser();
  private readonly promptBuilder: TranslationPromptBuilder;
  private readonly validators: TranslationValidator[];
  private readonly cache: TranslationCache;

  constructor(private readonly dependencies: TranslateSubtitleUseCaseDependencies) {
    this.promptBuilder = new TranslationPromptBuilder({ template: dependencies.promptTemplate });
    this.cache = dependencies.cache ?? new NullTranslationCache();
    this.validators = dependencies.validators ?? [
      new CountMatchValidator(),
      new MissingIdValidator(),
      new EmptyTranslationValidator(),
      new UntranslatedTextValidator(),
      new LengthLimitValidator()
    ];
  }

  async execute(request: TranslateSubtitleRequest): Promise<TranslateSubtitleResult> {
    const content = await this.dependencies.fileSystem.readText(request.inputFile);
    const document = this.dependencies.parser.parse(content, { sourceFile: request.inputFile });
    const chunks = this.dependencies.chunker.chunk(document);
    const options = buildTranslationOptions(request);
    let job = createJob(request, chunks, this.dependencies.provider.name);
    const jobMutex = new AsyncMutex();
    const rateLimiter = new RequestRateLimiter(
      this.dependencies.providerRequestsPerMinute ?? DEFAULT_PROVIDER_REQUESTS_PER_MINUTE
    );
    const limit = pLimit(this.dependencies.maxConcurrentChunks ?? DEFAULT_MAX_CONCURRENT_CHUNKS);

    await this.dependencies.jobStore?.create(job);
    this.dependencies.onProgress?.({
      type: 'started',
      jobId: job.jobId,
      lineCount: document.lines.length,
      chunkCount: chunks.length
    });

    const translatedChunks: TranslatedChunk[] = [];
    let completedChunks = 0;
    const processChunk = async (chunk: SubtitleChunk): Promise<void> => {
      await this.dependencies.jobStore?.writeChunkInput(job.jobId, chunk);
      await jobMutex.runExclusive(async () => {
        job = updateChunkTask(job, chunk.chunkId, { status: 'RUNNING' });
        await this.dependencies.jobStore?.update(job);
        this.dependencies.onProgress?.({
          type: 'chunk-start',
          jobId: job.jobId,
          chunkId: chunk.chunkId,
          completedChunks,
          chunkCount: chunks.length
        });
      });

      try {
        const translated = await this.translateChunkWithRetries(
          chunk,
          options,
          rateLimiter,
          async (retryCount, error) => {
            const errorMessage = error instanceof Error ? error.message : '未知翻译错误';
            await jobMutex.runExclusive(async () => {
              job = updateChunkTask(job, chunk.chunkId, {
                retryCount,
                error: errorMessage
              });
              await this.dependencies.jobStore?.update(job);
              this.dependencies.onProgress?.({
                type: 'chunk-retry',
                jobId: job.jobId,
                chunkId: chunk.chunkId,
                completedChunks,
                chunkCount: chunks.length,
                retryCount,
                maxRetries: options.maxRetries,
                error: errorMessage
              });
            });
          }
        );
        translatedChunks.push(translated);
        await this.dependencies.jobStore?.writeChunkOutput(job.jobId, translated);

        if (translated.rawResponse) {
          await this.dependencies.jobStore?.writeChunkRaw(job.jobId, chunk.chunkId, translated.rawResponse);
        }

        await jobMutex.runExclusive(async () => {
          job = updateChunkTask(job, chunk.chunkId, {
            status: translated.rawResponse ? 'SUCCESS' : 'SKIPPED',
            cacheHit: !translated.rawResponse
          });
          await this.dependencies.jobStore?.update(job);
          completedChunks += 1;
          this.dependencies.onProgress?.({
            type: 'chunk-success',
            jobId: job.jobId,
            chunkId: chunk.chunkId,
            completedChunks,
            chunkCount: chunks.length,
            cacheHit: !translated.rawResponse
          });
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知翻译错误';
        await jobMutex.runExclusive(async () => {
          job = updateChunkTask(job, chunk.chunkId, {
            status: 'FAILED',
            error: errorMessage
          });
          job = { ...job, status: 'FAILED', updatedAt: new Date().toISOString() };
          await this.dependencies.jobStore?.update(job);
          this.dependencies.onProgress?.({
            type: 'chunk-failed',
            jobId: job.jobId,
            chunkId: chunk.chunkId,
            completedChunks,
            chunkCount: chunks.length,
            error: errorMessage
          });
        });
        throw error;
      }
    };

    const results = await Promise.allSettled(
      chunks.map((chunk) =>
        limit(async () => {
          await processChunk(chunk);
        })
      )
    );

    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

    if (failed) {
      throw failed.reason;
    }

    const translatedDocument = mergeTranslatedChunks(document, translatedChunks);
    const exported = this.dependencies.exporter.export(translatedDocument);

    await this.dependencies.fileSystem.writeText(request.outputFile, exported);

    await jobMutex.runExclusive(async () => {
      job = {
        ...job,
        status: job.chunks.some((chunk) => chunk.status === 'FAILED') ? 'FAILED' : 'SUCCESS',
        updatedAt: new Date().toISOString()
      };
      await this.dependencies.jobStore?.update(job);
      this.dependencies.onProgress?.({
        type: 'finished',
        jobId: job.jobId,
        completedChunks,
        chunkCount: chunks.length
      });
    });

    return {
      jobId: job.jobId,
      lineCount: document.lines.length,
      chunkCount: chunks.length,
      outputFile: request.outputFile
    };
  }

  private async translateChunk(
    chunk: SubtitleChunk,
    options: TranslationOptions,
    rateLimiter: RequestRateLimiter
  ): Promise<TranslatedChunk> {
    const cacheKey = createCacheKey(chunk, options, this.dependencies.provider.name);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const prompt = this.promptBuilder.build(chunk, options);
    await rateLimiter.waitForTurn();
    const response = await this.dependencies.provider.chat({
      model: options.model,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json'
    });
    const translated = this.responseParser.parse(response.content, chunk.chunkId);
    const validation = mergeValidationResults(
      this.validators.map((validator) => validator.validate(chunk, translated))
    );

    if (!validation.passed) {
      const errorText = validation.errors.map((error) => error.message).join('; ');
      throw new TranslationValidationError(errorText);
    }

    const translatedWithUsage: TranslatedChunk = {
      ...translated,
      ...(response.usage ? { usage: response.usage } : {})
    };
    const cacheValue: TranslatedChunk = {
      chunkId: translatedWithUsage.chunkId,
      items: translatedWithUsage.items,
      ...(translatedWithUsage.usage ? { usage: translatedWithUsage.usage } : {})
    };

    await this.cache.set(cacheKey, cacheValue);
    return translatedWithUsage;
  }

  private async translateChunkWithRetries(
    chunk: SubtitleChunk,
    options: TranslationOptions,
    rateLimiter: RequestRateLimiter,
    onRetry: (retryCount: number, error: unknown) => Promise<void>
  ): Promise<TranslatedChunk> {
    let retryCount = 0;

    while (true) {
      try {
        return await this.translateChunk(chunk, options, rateLimiter);
      } catch (error) {
        if (retryCount >= options.maxRetries) {
          throw error;
        }

        retryCount += 1;
        await onRetry(retryCount, error);
        await delay(calculateRetryDelayMs(retryCount));
      }
    }
  }
}

class AsyncMutex {
  private queue = Promise.resolve();

  async runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release: () => void = () => undefined;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }
}

class RequestRateLimiter {
  private nextStartAt = 0;
  private queue = Promise.resolve();
  private readonly intervalMs: number;

  constructor(requestsPerMinute: number) {
    this.intervalMs = Math.ceil(60_000 / Math.max(requestsPerMinute, 1));
  }

  async waitForTurn(): Promise<void> {
    const turn = this.queue.then(async () => {
      const waitMs = Math.max(0, this.nextStartAt - Date.now());

      if (waitMs > 0) {
        await delay(waitMs);
      }

      this.nextStartAt = Date.now() + this.intervalMs;
    });

    this.queue = turn.catch(() => undefined);
    await turn;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJob(request: TranslateSubtitleRequest, chunks: SubtitleChunk[], provider: string): TranslationJob {
  const now = new Date().toISOString();

  return {
    jobId: request.jobId ?? randomUUID(),
    inputFile: request.inputFile,
    outputFile: request.outputFile,
    targetLanguage: request.targetLanguage,
    sourceLanguage: request.sourceLanguage ?? 'auto',
    style: request.style ?? 'natural-subtitle',
    model: request.model ?? 'mock-translate',
    provider,
    status: 'RUNNING',
    chunks: chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      status: 'PENDING',
      retryCount: 0,
      cacheHit: false
    })),
    createdAt: now,
    updatedAt: now
  };
}

function buildTranslationOptions(request: TranslateSubtitleRequest): TranslationOptions {
  return {
    sourceLanguage: request.sourceLanguage ?? 'auto',
    targetLanguage: request.targetLanguage,
    style: request.style ?? 'natural-subtitle',
    model: request.model ?? 'mock-translate',
    maxRetries: request.maxRetries ?? 3
  };
}

function mergeTranslatedChunks(document: SubtitleDocument, chunks: TranslatedChunk[]): SubtitleDocument {
  const translationById = new Map(chunks.flatMap((chunk) => chunk.items.map((item) => [item.id, item.translation])));

  return {
    ...document,
    lines: document.lines.map((line) => {
      const translatedText = translationById.get(line.id) ?? line.translatedText;
      return translatedText ? { ...line, translatedText } : line;
    })
  };
}

function createCacheKey(chunk: SubtitleChunk, options: TranslationOptions, provider: string): string {
  return createHash({
    sourceTexts: chunk.lines.map((line) => line.sourceText),
    targetLanguage: options.targetLanguage,
    provider,
    model: options.model,
    promptVersion: 'subtitle-translate-v1',
    glossaryHash: '',
    style: options.style
  });
}

function calculateRetryDelayMs(retryCount: number): number {
  return Math.min(250 * 2 ** (retryCount - 1), 2000);
}
