import type { SubtitleDocument } from '../../domain/subtitle/index.js';

export interface SubtitleExporter {
  export(document: SubtitleDocument): string;
}
