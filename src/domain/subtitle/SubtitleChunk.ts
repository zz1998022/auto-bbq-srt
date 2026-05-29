import type { GlossaryTerm } from '../translation/GlossaryTerm.js';
import type { SubtitleLine } from './SubtitleLine.js';

export interface SubtitleChunk {
  chunkId: string;
  startIndex: number;
  endIndex: number;
  lines: SubtitleLine[];
  context?: ChunkContext;
}

export interface ChunkContext {
  previousLines?: SubtitleLine[];
  nextLines?: SubtitleLine[];
  glossary?: GlossaryTerm[];
  styleGuide?: string;
  previousSummary?: string;
}
