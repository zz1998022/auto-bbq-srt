import type { TranslatedChunk } from '../../domain/translation/index.js';

export interface TranslationCache {
  get(key: string): Promise<TranslatedChunk | null>;
  set(key: string, value: TranslatedChunk): Promise<void>;
}
