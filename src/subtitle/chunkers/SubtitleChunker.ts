import type { SubtitleChunk, SubtitleDocument } from '../../domain/subtitle/index.js';

export interface SubtitleChunker {
  chunk(document: SubtitleDocument): SubtitleChunk[];
}
