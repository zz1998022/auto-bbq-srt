import type { LlmUsage } from '../llm/LlmUsage.js';

export interface TranslatedChunk {
  chunkId: string;
  items: TranslatedItem[];
  rawResponse?: string;
  usage?: LlmUsage;
}

export interface TranslatedItem {
  id: string;
  translation: string;
}
