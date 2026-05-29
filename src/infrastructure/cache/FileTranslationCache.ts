import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { TranslatedChunk } from '../../domain/translation/index.js';
import type { TranslationCache } from './TranslationCache.js';

export class FileTranslationCache implements TranslationCache {
  constructor(private readonly cacheDir: string) {}

  async get(key: string): Promise<TranslatedChunk | null> {
    try {
      const content = await readFile(this.resolvePath(key), 'utf8');
      return JSON.parse(content) as TranslatedChunk;
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async set(key: string, value: TranslatedChunk): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    await writeFile(this.resolvePath(key), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  private resolvePath(key: string): string {
    return join(this.cacheDir, `${key}.json`);
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
