import type { TranslatedChunk } from '../domain/translation/index.js';
import { TranslationValidationError } from '../shared/errors/AppError.js';

interface TranslationResponseShape {
  items?: unknown;
}

export class TranslationResponseParser {
  parse(content: string, chunkId: string): TranslatedChunk {
    const parsed = parseJsonObject(extractJson(content));
    const response = parsed as TranslationResponseShape;

    if (!Array.isArray(response.items)) {
      throw new TranslationValidationError('模型响应缺少 items 数组。');
    }

    return {
      chunkId,
      rawResponse: content,
      items: response.items.map((item, index) => parseItem(item, index))
    };
  }
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  const codeFenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return codeFenceMatch?.[1]?.trim() ?? trimmed;
}

function parseJsonObject(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new TranslationValidationError('模型响应不是合法 JSON。');
  }
}

function parseItem(item: unknown, index: number): { id: string; translation: string } {
  if (!isRecord(item)) {
    throw new TranslationValidationError(`第 ${index + 1} 个翻译项不是对象。`);
  }

  if (typeof item.id !== 'string' || item.id.length === 0) {
    throw new TranslationValidationError(`第 ${index + 1} 个翻译项缺少 id。`);
  }

  if (typeof item.translation !== 'string') {
    throw new TranslationValidationError(`翻译项 ${item.id} 缺少 translation。`);
  }

  return { id: item.id, translation: item.translation };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
