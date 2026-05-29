import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { ResumeTranslationUseCase } from '../../app/ResumeTranslationUseCase.js';
import { TranslateSubtitleUseCase } from '../../app/TranslateSubtitleUseCase.js';
import { FileTranslationCache } from '../../infrastructure/cache/FileTranslationCache.js';
import { NodeFileSystem } from '../../infrastructure/fs/NodeFileSystem.js';
import { FileJobStore } from '../../infrastructure/job-store/FileJobStore.js';
import { MockLlmProvider } from '../../providers/mock/MockLlmProvider.js';
import { DefaultSubtitleChunker } from '../../subtitle/chunkers/DefaultSubtitleChunker.js';
import { SrtExporter } from '../../subtitle/exporters/SrtExporter.js';
import { SrtParser } from '../../subtitle/parsers/SrtParser.js';

export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Resume an existing translation job.')
    .argument('<jobId>', 'Translation job id.')
    .action(async (jobId: string) => {
      const promptTemplate = await readFile(new URL('../../prompts/subtitle-translate.md', import.meta.url), 'utf8');
      const jobStore = new FileJobStore('.auto-bbq/jobs');
      const translator = new TranslateSubtitleUseCase({
        fileSystem: new NodeFileSystem(),
        parser: new SrtParser(),
        exporter: new SrtExporter(),
        chunker: new DefaultSubtitleChunker(),
        provider: new MockLlmProvider(),
        promptTemplate,
        cache: new FileTranslationCache('.auto-bbq/cache'),
        jobStore
      });
      const result = await new ResumeTranslationUseCase({ jobStore, translator }).execute({ jobId });

      if (!result.resumed) {
        console.log(`Job: ${result.jobId}`);
        console.log(`Status: ${result.status}`);
        console.log(`Output: ${result.outputFile}`);
        return;
      }

      console.log(`Job: ${result.jobId}`);
      console.log(`Resumed ${result.chunkCount} chunk(s).`);
      console.log(`Output: ${result.outputFile}`);
    });
}
