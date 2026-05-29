import { describe, expect, it } from 'vitest';

import type { SubtitleDocument } from '../../../src/domain/subtitle/index.js';
import { SrtExporter, formatSrtTimestamp } from '../../../src/subtitle/exporters/SrtExporter.js';

describe('SrtExporter', () => {
  it('exports source text while preserving original timeline', () => {
    const document: SubtitleDocument = {
      format: 'srt',
      lines: [
        {
          id: '1',
          index: 1,
          timeRange: { startMs: 1000, endMs: 3000 },
          sourceText: 'Hello'
        },
        {
          id: '2',
          index: 2,
          timeRange: { startMs: 4000, endMs: 6500 },
          sourceText: 'World'
        }
      ]
    };

    expect(new SrtExporter().export(document)).toBe(
      ['1', '00:00:01,000 --> 00:00:03,000', 'Hello', '', '2', '00:00:04,000 --> 00:00:06,500', 'World', ''].join('\n')
    );
  });

  it('exports translated text without changing id, index, or timeline', () => {
    const document: SubtitleDocument = {
      format: 'srt',
      lines: [
        {
          id: '7',
          index: 7,
          timeRange: { startMs: 3723456, endMs: 3724999 },
          sourceText: 'Original line',
          translatedText: '翻译后的字幕'
        }
      ]
    };

    expect(new SrtExporter().export(document)).toBe(
      ['7', '01:02:03,456 --> 01:02:04,999', '翻译后的字幕', ''].join('\n')
    );
  });

  it('keeps multi-line subtitle text intact', () => {
    const document: SubtitleDocument = {
      format: 'srt',
      lines: [
        {
          id: '1',
          index: 1,
          timeRange: { startMs: 0, endMs: 1500 },
          sourceText: 'Line one\nLine two'
        }
      ]
    };

    expect(new SrtExporter().export(document)).toBe(
      ['1', '00:00:00,000 --> 00:00:01,500', 'Line one\nLine two', ''].join('\n')
    );
  });

  it('formats millisecond timestamps as SRT timestamps', () => {
    expect(formatSrtTimestamp(3723456)).toBe('01:02:03,456');
  });
});
