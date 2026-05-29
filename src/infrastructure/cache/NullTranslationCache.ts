import type { TranslatedChunk } from '../../domain/translation/index.js';
import type { TranslationCache } from './TranslationCache.js';

export class NullTranslationCache implements TranslationCache {
  async get(): Promise<TranslatedChunk | null> {
    return null;
  }

  async set(): Promise<void> {
    // 空缓存用于关闭缓存时保持调用方逻辑一致。
  }
}
