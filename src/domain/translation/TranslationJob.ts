export interface TranslationJob {
  jobId: string;
  inputFile: string;
  outputFile: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  style?: string;
  model?: string;
  provider?: string;
  status: JobStatus;
  chunks: TranslationChunkTask[];
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = 'PENDING' | 'RUNNING' | 'PARTIAL_SUCCESS' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface TranslationChunkTask {
  chunkId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  retryCount: number;
  cacheHit: boolean;
  error?: string;
}
