import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, ValidationResult } from '../../domain/translation/index.js';
import type { TranslationValidator } from './TranslationValidator.js';

export class MissingIdValidator implements TranslationValidator {
  validate(source: SubtitleChunk, translated: TranslatedChunk): ValidationResult {
    const translatedIds = new Set(translated.items.map((item) => item.id));
    const missing = source.lines.filter((line) => !translatedIds.has(line.id));

    return {
      passed: missing.length === 0,
      errors: missing.map((line) => ({
        code: 'MISSING_ID',
        message: `缺少字幕 ${line.id} 的翻译结果。`,
        lineId: line.id,
        severity: 'error'
      })),
      warnings: []
    };
  }
}
