import { describe, expect, it } from 'vitest';

import type { SubtitleChunk } from '../../../src/domain/subtitle/index.js';
import type { TranslatedChunk } from '../../../src/domain/translation/index.js';
import {
  CountMatchValidator,
  EmptyTranslationValidator,
  LengthLimitValidator,
  MissingIdValidator,
  UntranslatedTextValidator,
  mergeValidationResults
} from '../../../src/translation/validators/index.js';

describe('translation validators', () => {
  const source: SubtitleChunk = {
    chunkId: 'chunk-0001',
    startIndex: 1,
    endIndex: 2,
    lines: [
      { id: '1', index: 1, timeRange: { startMs: 0, endMs: 1000 }, sourceText: 'Hello' },
      { id: '2', index: 2, timeRange: { startMs: 1000, endMs: 2000 }, sourceText: 'World' }
    ]
  };

  it('passes a valid translated chunk', () => {
    const translated: TranslatedChunk = {
      chunkId: 'chunk-0001',
      items: [
        { id: '1', translation: '你好' },
        { id: '2', translation: '世界' }
      ]
    };

    const result = mergeValidationResults([
      new CountMatchValidator().validate(source, translated),
      new MissingIdValidator().validate(source, translated),
      new EmptyTranslationValidator().validate(source, translated)
    ]);

    expect(result.passed).toBe(true);
  });

  it('reports count, missing id, empty, untranslated, and length issues', () => {
    const translated: TranslatedChunk = {
      chunkId: 'chunk-0001',
      items: [{ id: '1', translation: '' }]
    };

    const result = mergeValidationResults([
      new CountMatchValidator().validate(source, translated),
      new MissingIdValidator().validate(source, translated),
      new EmptyTranslationValidator().validate(source, translated)
    ]);

    expect(result.passed).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(['COUNT_MISMATCH', 'MISSING_ID', 'EMPTY_TRANSLATION']);

    const warnings = mergeValidationResults([
      new UntranslatedTextValidator().validate(source, {
        chunkId: 'chunk-0001',
        items: [{ id: '1', translation: 'Hello' }]
      }),
      new LengthLimitValidator(3).validate(source, {
        chunkId: 'chunk-0001',
        items: [{ id: '2', translation: '很长很长' }]
      })
    ]);

    expect(warnings.warnings.map((warning) => warning.code)).toEqual(['POSSIBLY_UNTRANSLATED', 'LONG_TRANSLATION']);
  });
});
