import type { SubtitleDocument, SubtitleLine, TimeRange } from '../../domain/subtitle/index.js';
import { SubtitleParseError } from '../../shared/errors/AppError.js';
import type { ParseSubtitleOptions, SubtitleParser } from './SubtitleParser.js';

const TIMING_SEPARATOR = ' --> ';
const TIME_PATTERN = /^(\d{2,}):([0-5]\d):([0-5]\d),(\d{3})$/;

export class SrtParser implements SubtitleParser {
  parse(content: string, options: ParseSubtitleOptions = {}): SubtitleDocument {
    const normalized = content
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    if (normalized.length === 0) {
      throw new SubtitleParseError('SRT 内容不能为空。');
    }

    const blocks = normalized.split(/\n{2,}/);
    const lines = blocks.map((block, blockIndex) => this.parseBlock(block, blockIndex + 1));

    return {
      format: 'srt',
      lines,
      ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
      ...(options.language ? { language: options.language } : {})
    };
  }

  private parseBlock(block: string, fallbackBlockNumber: number): SubtitleLine {
    const rows = block.split('\n');
    const rawIndex = rows[0]?.trim();
    const timingLine = rows[1]?.trim();
    const textRows = rows.slice(2);

    if (!rawIndex || !/^\d+$/.test(rawIndex)) {
      throw new SubtitleParseError(`第 ${fallbackBlockNumber} 个字幕块缺少有效序号。`);
    }

    if (!timingLine) {
      throw new SubtitleParseError(`字幕 ${rawIndex} 缺少时间轴。`);
    }

    if (textRows.length === 0) {
      throw new SubtitleParseError(`字幕 ${rawIndex} 缺少文本内容。`);
    }

    const timeRange = parseSrtTimeRange(timingLine, rawIndex);
    const sourceText = textRows.join('\n').trim();

    if (sourceText.length === 0) {
      throw new SubtitleParseError(`字幕 ${rawIndex} 文本内容不能为空。`);
    }

    return {
      id: rawIndex,
      index: Number.parseInt(rawIndex, 10),
      timeRange,
      sourceText
    };
  }
}

export function parseSrtTimestamp(value: string): number {
  const match = TIME_PATTERN.exec(value);

  if (!match) {
    throw new SubtitleParseError(`非法 SRT 时间戳：${value}`);
  }

  const [, hours, minutes, seconds, milliseconds] = match;

  if (!hours || !minutes || !seconds || !milliseconds) {
    throw new SubtitleParseError(`非法 SRT 时间戳：${value}`);
  }

  // SRT 时间戳精度是毫秒，本地统一用 number 类型的毫秒保存，避免让模型碰时间轴。
  return (
    Number.parseInt(hours, 10) * 60 * 60 * 1000 +
    Number.parseInt(minutes, 10) * 60 * 1000 +
    Number.parseInt(seconds, 10) * 1000 +
    Number.parseInt(milliseconds, 10)
  );
}

function parseSrtTimeRange(timingLine: string, subtitleId: string): TimeRange {
  const [start, end] = timingLine.split(TIMING_SEPARATOR);

  if (!start || !end) {
    throw new SubtitleParseError(`字幕 ${subtitleId} 的时间轴格式不正确。`);
  }

  const startMs = parseSrtTimestamp(start.trim());
  const endMs = parseSrtTimestamp(end.trim());

  if (endMs <= startMs) {
    throw new SubtitleParseError(`字幕 ${subtitleId} 的结束时间必须晚于开始时间。`);
  }

  return { startMs, endMs };
}
