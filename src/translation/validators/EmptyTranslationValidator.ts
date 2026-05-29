import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, ValidationResult } from '../../domain/translation/index.js';
import type { TranslationValidator } from './TranslationValidator.js';

export class EmptyTranslationValidator implements TranslationValidator {
  validate(_source: SubtitleChunk, translated: TranslatedChunk): ValidationResult {
    const emptyItems = translated.items.filter((item) => item.translation.trim().length === 0);

    return {
      passed: emptyItems.length === 0,
      errors: emptyItems.map((item) => ({
        code: 'EMPTY_TRANSLATION',
        message: `字幕 ${item.id} 的翻译结果为空。`,
        lineId: item.id,
        severity: 'error'
      })),
      warnings: []
    };
  }
}
