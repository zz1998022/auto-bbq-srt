import { describe, expect, it } from 'vitest';

import { SubtitleParseError } from '../../../src/shared/errors/AppError.js';
import { SrtParser, parseSrtTimestamp } from '../../../src/subtitle/parsers/SrtParser.js';

describe('SrtParser', () => {
  it('parses sample SRT and preserves identity plus timeline fields', () => {
    const content = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'Hello, welcome to the show.',
      '',
      '2',
      '00:00:04,000 --> 00:00:06,500',
      'Today we are testing subtitles.'
    ].join('\n');

    const document = new SrtParser().parse(content, { sourceFile: 'sample.srt', language: 'en' });

    expect(document).toEqual({
      format: 'srt',
      sourceFile: 'sample.srt',
      language: 'en',
      lines: [
        {
          id: '1',
          index: 1,
          timeRange: { startMs: 1000, endMs: 3000 },
          sourceText: 'Hello, welcome to the show.'
        },
        {
          id: '2',
          index: 2,
          timeRange: { startMs: 4000, endMs: 6500 },
          sourceText: 'Today we are testing subtitles.'
        }
      ]
    });
  });

  it('handles CRLF input and multi-line subtitle text', () => {
    const content = '1\r\n00:01:02,003 --> 00:01:05,006\r\nLine one\r\nLine two\r\n';

    const document = new SrtParser().parse(content);

    expect(document.lines[0]).toMatchObject({
      id: '1',
      index: 1,
      timeRange: { startMs: 62003, endMs: 65006 },
      sourceText: 'Line one\nLine two'
    });
  });

  it('rejects invalid timestamp order', () => {
    const content = ['1', '00:00:03,000 --> 00:00:01,000', 'Backwards time'].join('\n');

    expect(() => new SrtParser().parse(content)).toThrow(SubtitleParseError);
  });

  it('rejects blocks without numeric SRT index', () => {
    const content = ['A', '00:00:01,000 --> 00:00:03,000', 'Bad index'].join('\n');

    expect(() => new SrtParser().parse(content)).toThrow('缺少有效序号');
  });

  it('parses SRT timestamps to milliseconds', () => {
    expect(parseSrtTimestamp('01:02:03,456')).toBe(3723456);
  });
});
