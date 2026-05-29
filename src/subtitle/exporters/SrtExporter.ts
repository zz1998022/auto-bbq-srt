import type { SubtitleDocument, SubtitleLine } from '../../domain/subtitle/index.js';
import type { SubtitleExporter } from './SubtitleExporter.js';

export class SrtExporter implements SubtitleExporter {
  export(document: SubtitleDocument): string {
    const blocks = document.lines.map((line) => exportLine(line));
    return `${blocks.join('\n\n')}\n`;
  }
}

export function formatSrtTimestamp(totalMs: number): string {
  if (!Number.isInteger(totalMs) || totalMs < 0) {
    throw new Error(`非法字幕时间：${totalMs}`);
  }

  const milliseconds = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}

function exportLine(line: SubtitleLine): string {
  const text = line.translatedText ?? line.sourceText;
  const start = formatSrtTimestamp(line.timeRange.startMs);
  const end = formatSrtTimestamp(line.timeRange.endMs);

  // 导出时只复用本地保存的时间轴，翻译文本不会参与时间轴生成。
  return [line.index.toString(), `${start} --> ${end}`, text].join('\n');
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0');
}
