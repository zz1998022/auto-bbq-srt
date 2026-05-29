import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { TranslateSubtitleUseCase } from '../../app/TranslateSubtitleUseCase.js';
import { FileTranslationCache } from '../../infrastructure/cache/FileTranslationCache.js';
import { LocalCliConfigStore } from '../../infrastructure/config/LocalCliConfigStore.js';
import { resolveTranslateConfig } from '../../infrastructure/config/LlmProviderConfigResolver.js';
import { NodeFileSystem } from '../../infrastructure/fs/NodeFileSystem.js';
import { FileJobStore } from '../../infrastructure/job-store/FileJobStore.js';
import { createLlmProvider } from '../../providers/LlmProviderFactory.js';
import { DefaultSubtitleChunker } from '../../subtitle/chunkers/DefaultSubtitleChunker.js';
import { SrtExporter } from '../../subtitle/exporters/SrtExporter.js';
import { SrtParser } from '../../subtitle/parsers/SrtParser.js';
import { fetchHitokoto } from '../progress/HitokotoClient.js';
import { TranslateProgressRenderer } from '../progress/TranslateProgressRenderer.js';

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
      const config = await new LocalCliConfigStore().load();
      const resolved = resolveTranslateConfig(config, options.provider);
      const progress = new TranslateProgressRenderer(fetchHitokoto);
      const promptTemplate = await readFile(new URL('../../prompts/subtitle-translate.md', import.meta.url), 'utf8');
      const useCase = new TranslateSubtitleUseCase({
        fileSystem: new NodeFileSystem(),
        parser: new SrtParser(),
        exporter: new SrtExporter(),
        chunker: new DefaultSubtitleChunker(),
        provider: createLlmProvider(resolved.providerConfig),
        promptTemplate,
        cache: new FileTranslationCache('.auto-bbq/cache'),
        jobStore: new FileJobStore('.auto-bbq/jobs'),
        onProgress: (event) => progress.update(event)
      });

      progress.start();

      try {
        const result = await useCase.execute({
          inputFile: input,
          outputFile: options.output,
          targetLanguage: options.target ?? resolved.defaults.targetLanguage,
          style: resolved.defaults.style,
          model: resolved.defaults.model,
          maxRetries: resolved.defaults.maxRetries
        });

        progress.stop();

        console.log(`Job: ${result.jobId}`);
        console.log(`Translated ${result.lineCount} subtitle lines in ${result.chunkCount} chunk(s).`);
        console.log(`Output: ${result.outputFile}`);
      } catch (error) {
        progress.stop();
        throw error;
      }
    });
}
