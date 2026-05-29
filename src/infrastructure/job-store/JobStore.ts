import type { SubtitleChunk } from '../../domain/subtitle/index.js';
import type { TranslatedChunk, TranslationChunkTask, TranslationJob } from '../../domain/translation/index.js';

export interface JobStore {
  create(job: TranslationJob): Promise<void>;
  get(jobId: string): Promise<TranslationJob | null>;
  update(job: TranslationJob): Promise<void>;
  writeChunkInput(jobId: string, chunk: SubtitleChunk): Promise<void>;
  writeChunkOutput(jobId: string, chunk: TranslatedChunk): Promise<void>;
  writeChunkRaw(jobId: string, chunkId: string, raw: string): Promise<void>;
}

export function updateChunkTask(
  job: TranslationJob,
  chunkId: string,
  patch: Partial<TranslationChunkTask>
): TranslationJob {
  return {
    ...job,
    updatedAt: new Date().toISOString(),
    chunks: job.chunks.map((chunk) => (chunk.chunkId === chunkId ? { ...chunk, ...patch } : chunk))
  };
}
