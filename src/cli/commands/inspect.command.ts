import type { Command } from 'commander';

import { FileJobStore } from '../../infrastructure/job-store/FileJobStore.js';

export function registerInspectCommand(program: Command): void {
  program
    .command('inspect')
    .description('Inspect a translation job.')
    .argument('<jobId>', 'Translation job id.')
    .action(async (jobId: string) => {
      const store = new FileJobStore('.auto-bbq/jobs');
      const job = await store.get(jobId);

      if (!job) {
        throw new Error(`未找到任务：${jobId}`);
      }

      console.log(`Job: ${job.jobId}`);
      console.log(`Status: ${job.status}`);
      console.log(`Input: ${job.inputFile}`);
      console.log(`Output: ${job.outputFile}`);
      console.log(`Chunks: ${job.chunks.length}`);

      for (const chunk of job.chunks) {
        const cacheText = chunk.cacheHit ? 'cache-hit' : 'cache-miss';
        const errorText = chunk.error ? ` error=${chunk.error}` : '';
        console.log(`- ${chunk.chunkId}: ${chunk.status} ${cacheText} retries=${chunk.retryCount}${errorText}`);
      }
    });
}
