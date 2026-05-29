import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, ValidationResult } from '../../domain/translation/index.js';
import type { TranslationValidator } from './TranslationValidator.js';

export class CountMatchValidator implements TranslationValidator {
  validate(source: SubtitleChunk, translated: TranslatedChunk): ValidationResult {
    if (source.lines.length === translated.items.length) {
      return { passed: true, errors: [], warnings: [] };
    }

    return {
      passed: false,
      errors: [
        {
          code: 'COUNT_MISMATCH',
          message: `翻译条数 ${translated.items.length} 与源字幕条数 ${source.lines.length} 不一致。`,
          severity: 'error'
        }
      ],
      warnings: []
    };
  }
}
