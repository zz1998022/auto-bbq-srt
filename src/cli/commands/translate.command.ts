import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { TranslateSubtitleUseCase } from '../../app/TranslateSubtitleUseCase.js';
import { FileTranslationCache } from '../../infrastructure/cache/FileTranslationCache.js';
import { NodeFileSystem } from '../../infrastructure/fs/NodeFileSystem.js';
import { FileJobStore } from '../../infrastructure/job-store/FileJobStore.js';
import { MockLlmProvider } from '../../providers/mock/MockLlmProvider.js';
import { DefaultSubtitleChunker } from '../../subtitle/chunkers/DefaultSubtitleChunker.js';
import { SrtExporter } from '../../subtitle/exporters/SrtExporter.js';
import { SrtParser } from '../../subtitle/parsers/SrtParser.js';

interface TranslateCommandOptions {
  output: string;
  provider?: string;
  target?: string;
  dryRun?: boolean;
}

export function registerTranslateCommand(program: Command): void {
  program
    .command('translate')
    .description('Translate a subtitle file.')
    .argument('<input>', 'Input subtitle file path.')
    .requiredOption('-o, --output <path>', 'Output subtitle file path.')
    .option('--provider <provider>', 'LLM provider name.')
    .option('--target <language>', 'Target language.')
    .option('--dry-run', 'Parse and validate without calling a real provider.')
    .action(async (input: string, options: TranslateCommandOptions) => {
      const providerName = options.provider ?? 'mock';

      if (providerName !== 'mock') {
        throw new Error(
          '当前 MVP 的 CLI 翻译入口只接入 mock provider；真实 Provider 适配器已完成，后续会接入 CLI 配置。'
        );
      }

      const promptTemplate = await readFile(new URL('../../prompts/subtitle-translate.md', import.meta.url), 'utf8');
      const useCase = new TranslateSubtitleUseCase({
        fileSystem: new NodeFileSystem(),
        parser: new SrtParser(),
        exporter: new SrtExporter(),
        chunker: new DefaultSubtitleChunker(),
        provider: new MockLlmProvider(),
        promptTemplate,
        cache: new FileTranslationCache('.auto-bbq/cache'),
        jobStore: new FileJobStore('.auto-bbq/jobs')
      });

      const result = await useCase.execute({
        inputFile: input,
        outputFile: options.output,
        targetLanguage: options.target ?? 'zh-CN'
      });

      console.log(`Job: ${result.jobId}`);
      console.log(`Translated ${result.lineCount} subtitle lines in ${result.chunkCount} chunk(s).`);
      console.log(`Output: ${result.outputFile}`);
    });
}
