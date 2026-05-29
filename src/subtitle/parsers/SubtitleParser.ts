import type { SubtitleDocument } from '../../domain/subtitle/index.js';

export interface SubtitleParser {
  parse(content: string, options?: ParseSubtitleOptions): SubtitleDocument;
}

export interface ParseSubtitleOptions {
  sourceFile?: string;
  language?: string;
}
