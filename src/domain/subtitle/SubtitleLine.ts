import type { TimeRange } from './TimeRange.js';

export interface SubtitleLine {
  id: string;
  index: number;
  timeRange: TimeRange;
  sourceText: string;
  translatedText?: string;
  metadata?: Record<string, unknown>;
}
