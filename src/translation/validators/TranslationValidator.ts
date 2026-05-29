import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, ValidationResult } from '../../domain/translation/index.js';

export interface TranslationValidator {
  validate(source: SubtitleChunk, translated: TranslatedChunk): ValidationResult;
}

export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);
  const warnings = results.flatMap((result) => result.warnings);

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}
