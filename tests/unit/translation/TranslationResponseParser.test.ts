import { describe, expect, it } from 'vitest';

import { TranslationValidationError } from '../../../src/shared/errors/AppError.js';
import { TranslationResponseParser } from '../../../src/translation/TranslationResponseParser.js';

describe('TranslationResponseParser', () => {
  it('parses strict JSON responses', () => {
    const parsed = new TranslationResponseParser().parse('{"items":[{"id":"1","translation":"你好"}]}', 'chunk-0001');

    expect(parsed).toMatchObject({
      chunkId: 'chunk-0001',
      items: [{ id: '1', translation: '你好' }]
    });
  });

  it('extracts JSON from a Markdown code fence', () => {
    const parsed = new TranslationResponseParser().parse(
      '```json\n{"items":[{"id":"1","translation":"你好"}]}\n```',
      'chunk-0001'
    );

    expect(parsed.items[0]).toEqual({ id: '1', translation: '你好' });
  });

  it('rejects invalid response shapes', () => {
    expect(() => new TranslationResponseParser().parse('{"items":{}}', 'chunk-0001')).toThrow(
      TranslationValidationError
    );
  });
});
