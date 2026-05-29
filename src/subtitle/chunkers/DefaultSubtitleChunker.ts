import type { SubtitleChunk, SubtitleDocument, SubtitleLine } from '../../domain/subtitle/index.js';
import type { SubtitleChunker } from './SubtitleChunker.js';

export interface DefaultSubtitleChunkerOptions {
  maxLines: number;
  maxChars: number;
  contextBeforeLines: number;
  contextAfterLines: number;
}

export const DEFAULT_CHUNKER_OPTIONS: DefaultSubtitleChunkerOptions = {
  maxLines: 30,
  maxChars: 2500,
  contextBeforeLines: 5,
  contextAfterLines: 2
};

export class DefaultSubtitleChunker implements SubtitleChunker {
  constructor(private readonly options: DefaultSubtitleChunkerOptions = DEFAULT_CHUNKER_OPTIONS) {}

  chunk(document: SubtitleDocument): SubtitleChunk[] {
    const chunks: SubtitleChunk[] = [];
    let start = 0;

    while (start < document.lines.length) {
      const endExclusive = this.findChunkEnd(document.lines, start);
      const lines = document.lines.slice(start, endExclusive);
      const chunkNumber = chunks.length + 1;

      chunks.push({
        chunkId: `chunk-${chunkNumber.toString().padStart(4, '0')}`,
        startIndex: lines[0]?.index ?? 0,
        endIndex: lines.at(-1)?.index ?? 0,
        lines,
        context: {
          previousLines: document.lines.slice(Math.max(0, start - this.options.contextBeforeLines), start),
          nextLines: document.lines.slice(endExclusive, endExclusive + this.options.contextAfterLines)
        }
      });

      start = endExclusive;
    }

    return chunks;
  }

  private findChunkEnd(lines: SubtitleLine[], start: number): number {
    let end = start;
    let chars = 0;

    while (end < lines.length && end - start < this.options.maxLines) {
      const line = lines[end];

      if (!line) {
        break;
      }

      const nextChars = chars + line.sourceText.length;

      // 如果当前 chunk 已有内容，下一行会超出字符上限，就留给下一个 chunk。
      if (end > start && nextChars > this.options.maxChars) {
        break;
      }

      chars = nextChars;
      end += 1;
    }

    return end;
  }
}
