import { readFile, writeFile } from 'node:fs/promises';

import type { FileSystem } from './FileSystem.js';

export class NodeFileSystem implements FileSystem {
  async readText(path: string): Promise<string> {
    return await readFile(path, 'utf8');
  }

  async writeText(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf8');
  }
}
