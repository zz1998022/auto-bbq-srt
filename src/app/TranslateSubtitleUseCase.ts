import { randomUUID } from 'node:crypto';

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

export interface TranslateSubtitleRequest {
  inputFile: string;
  outputFile: string;
  targetLanguage: string;
  jobId?: string;
  sourceLanguage?: string;
  style?: string;
  model?: string;
}

export interface TranslateSubtitleResult {
  jobId: string;
  lineCount: number;
  chunkCount: number;
  outputFile: string;
}

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

    await this.dependencies.jobStore?.create(job);

    const translatedChunks: TranslatedChunk[] = [];

    for (const chunk of chunks) {
      await this.dependencies.jobStore?.writeChunkInput(job.jobId, chunk);
      job = updateChunkTask(job, chunk.chunkId, { status: 'RUNNING' });
      await this.dependencies.jobStore?.update(job);

      try {
        const translated = await this.translateChunk(chunk, options);
        translatedChunks.push(translated);
        await this.dependencies.jobStore?.writeChunkOutput(job.jobId, translated);

        if (translated.rawResponse) {
          await this.dependencies.jobStore?.writeChunkRaw(job.jobId, chunk.chunkId, translated.rawResponse);
        }

        job = updateChunkTask(job, chunk.chunkId, {
          status: translated.rawResponse ? 'SUCCESS' : 'SKIPPED',
          cacheHit: !translated.rawResponse
        });
        await this.dependencies.jobStore?.update(job);
      } catch (error) {
        job = updateChunkTask(job, chunk.chunkId, {
          status: 'FAILED',
          error: error instanceof Error ? error.message : '未知翻译错误'
        });
        job = { ...job, status: 'FAILED', updatedAt: new Date().toISOString() };
        await this.dependencies.jobStore?.update(job);
        throw error;
      }
    }

    const translatedDocument = mergeTranslatedChunks(document, translatedChunks);
    const exported = this.dependencies.exporter.export(translatedDocument);

    await this.dependencies.fileSystem.writeText(request.outputFile, exported);

    job = {
      ...job,
      status: job.chunks.some((chunk) => chunk.status === 'FAILED') ? 'FAILED' : 'SUCCESS',
      updatedAt: new Date().toISOString()
    };
    await this.dependencies.jobStore?.update(job);

    return {
      jobId: job.jobId,
      lineCount: document.lines.length,
      chunkCount: chunks.length,
      outputFile: request.outputFile
    };
  }

  private async translateChunk(chunk: SubtitleChunk, options: TranslationOptions): Promise<TranslatedChunk> {
    const cacheKey = createCacheKey(chunk, options, this.dependencies.provider.name);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const prompt = this.promptBuilder.build(chunk, options);
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
    model: request.model ?? 'mock-translate'
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
