import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, ValidationResult } from '../../domain/translation/index.js';
import type { TranslationValidator } from './TranslationValidator.js';

export class LengthLimitValidator implements TranslationValidator {
  constructor(private readonly maxCharsPerLine = 80) {}

  validate(_source: SubtitleChunk, translated: TranslatedChunk): ValidationResult {
    const longItems = translated.items.filter((item) => item.translation.length > this.maxCharsPerLine);

    return {
      passed: true,
      errors: [],
      warnings: longItems.map((item) => ({
        code: 'LONG_TRANSLATION',
        message: `字幕 ${item.id} 的翻译结果超过 ${this.maxCharsPerLine} 个字符。`,
        lineId: item.id,
        severity: 'warning'
      }))
    };
  }
}
