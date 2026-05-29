import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, ValidationResult } from '../../domain/translation/index.js';
import type { TranslationValidator } from './TranslationValidator.js';

export class UntranslatedTextValidator implements TranslationValidator {
  validate(source: SubtitleChunk, translated: TranslatedChunk): ValidationResult {
    const sourceById = new Map(source.lines.map((line) => [line.id, line.sourceText.trim()]));
    const unchanged = translated.items.filter((item) => sourceById.get(item.id) === item.translation.trim());

    return {
      passed: true,
      errors: [],
      warnings: unchanged.map((item) => ({
        code: 'POSSIBLY_UNTRANSLATED',
        message: `字幕 ${item.id} 的翻译结果与原文一致。`,
        lineId: item.id,
        severity: 'warning'
      }))
    };
  }
}
