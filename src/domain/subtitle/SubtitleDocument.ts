import type { SubtitleFormat } from './SubtitleFormat.js';
import type { SubtitleLine } from './SubtitleLine.js';

export interface SubtitleDocument {
  sourceFile?: string;
  format: SubtitleFormat;
  language?: string;
  lines: SubtitleLine[];
  metadata?: Record<string, unknown>;
}
