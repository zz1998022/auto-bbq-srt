import type { LlmProvider } from '../domain/llm/index.js';
import type { SubtitleChunk, SubtitleDocument } from '../domain/subtitle/index.js';
import type { TranslatedChunk, TranslationOptions } from '../domain/translation/index.js';
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
  sourceLanguage?: string;
  style?: string;
  model?: string;
}

export interface TranslateSubtitleResult {
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
}

export class TranslateSubtitleUseCase {
  private readonly responseParser = new TranslationResponseParser();
  private readonly promptBuilder: TranslationPromptBuilder;
  private readonly validators: TranslationValidator[];

  constructor(private readonly dependencies: TranslateSubtitleUseCaseDependencies) {
    this.promptBuilder = new TranslationPromptBuilder({ template: dependencies.promptTemplate });
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
    const translatedChunks = await Promise.all(chunks.map((chunk) => this.translateChunk(chunk, options)));
    const translatedDocument = mergeTranslatedChunks(document, translatedChunks);
    const exported = this.dependencies.exporter.export(translatedDocument);

    await this.dependencies.fileSystem.writeText(request.outputFile, exported);

    return {
      lineCount: document.lines.length,
      chunkCount: chunks.length,
      outputFile: request.outputFile
    };
  }

  private async translateChunk(chunk: SubtitleChunk, options: TranslationOptions): Promise<TranslatedChunk> {
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

    return {
      ...translated,
      ...(response.usage ? { usage: response.usage } : {})
    };
  }
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
