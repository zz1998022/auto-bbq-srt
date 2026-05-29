import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, TranslationJob } from '../../domain/translation/index.js';
import type { JobStore } from './JobStore.js';

export class FileJobStore implements JobStore {
  constructor(private readonly jobsDir: string) {}

  async create(job: TranslationJob): Promise<void> {
    await this.writeManifest(job);
  }

  async get(jobId: string): Promise<TranslationJob | null> {
    try {
      const content = await readFile(this.manifestPath(jobId), 'utf8');
      return JSON.parse(content) as TranslationJob;
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async update(job: TranslationJob): Promise<void> {
    await this.writeManifest(job);
  }

  async writeChunkInput(jobId: string, chunk: SubtitleChunk): Promise<void> {
    await this.writeChunkJson(jobId, `${chunk.chunkId}.input.json`, chunk);
  }

  async writeChunkOutput(jobId: string, chunk: TranslatedChunk): Promise<void> {
    await this.writeChunkJson(jobId, `${chunk.chunkId}.output.json`, chunk);
  }

  async writeChunkRaw(jobId: string, chunkId: string, raw: string): Promise<void> {
    const chunksDir = this.chunksDir(jobId);
    await mkdir(chunksDir, { recursive: true });
    await writeFile(join(chunksDir, `${chunkId}.raw.txt`), raw, 'utf8');
  }

  private async writeManifest(job: TranslationJob): Promise<void> {
    const jobDir = this.jobDir(job.jobId);
    await mkdir(jobDir, { recursive: true });
    await writeFile(this.manifestPath(job.jobId), `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  }

  private async writeChunkJson(jobId: string, fileName: string, value: unknown): Promise<void> {
    const chunksDir = this.chunksDir(jobId);
    await mkdir(chunksDir, { recursive: true });
    await writeFile(join(chunksDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  private manifestPath(jobId: string): string {
    return join(this.jobDir(jobId), 'manifest.json');
  }

  private chunksDir(jobId: string): string {
    return join(this.jobDir(jobId), 'chunks');
  }

  private jobDir(jobId: string): string {
    return join(this.jobsDir, jobId);
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
