import { describe, expect, it } from 'vitest';

import type { SubtitleDocument } from '../../../src/domain/subtitle/index.js';
import { DefaultSubtitleChunker } from '../../../src/subtitle/chunkers/DefaultSubtitleChunker.js';

describe('DefaultSubtitleChunker', () => {
  it('splits subtitles by line count and keeps nearby context outside current lines', () => {
    const document = createDocument(['one', 'two', 'three', 'four']);
    const chunker = new DefaultSubtitleChunker({
      maxLines: 2,
      maxChars: 100,
      contextBeforeLines: 1,
      contextAfterLines: 1
    });

    const chunks = chunker.chunk(document);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      chunkId: 'chunk-0001',
      startIndex: 1,
      endIndex: 2
    });
    expect(chunks[0]?.lines.map((line) => line.id)).toEqual(['1', '2']);
    expect(chunks[0]?.context?.nextLines?.map((line) => line.id)).toEqual(['3']);
    expect(chunks[1]?.context?.previousLines?.map((line) => line.id)).toEqual(['2']);
  });

  it('splits subtitles by character budget without dropping long lines', () => {
    const document = createDocument(['short', 'this line is too long for the first chunk', 'tail']);
    const chunker = new DefaultSubtitleChunker({
      maxLines: 10,
      maxChars: 10,
      contextBeforeLines: 0,
      contextAfterLines: 0
    });

    const chunks = chunker.chunk(document);

    expect(chunks.map((chunk) => chunk.lines.map((line) => line.id))).toEqual([['1'], ['2'], ['3']]);
  });
});

function createDocument(texts: string[]): SubtitleDocument {
  return {
    format: 'srt',
    lines: texts.map((text, index) => ({
      id: String(index + 1),
      index: index + 1,
      timeRange: { startMs: index * 1000, endMs: index * 1000 + 900 },
      sourceText: text
    }))
  };
}
