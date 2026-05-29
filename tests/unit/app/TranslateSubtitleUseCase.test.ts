import { describe, expect, it } from 'vitest';

import { TranslateSubtitleUseCase } from '../../../src/app/TranslateSubtitleUseCase.js';
import type { FileSystem } from '../../../src/infrastructure/fs/FileSystem.js';
import { MockLlmProvider } from '../../../src/providers/mock/MockLlmProvider.js';
import { DefaultSubtitleChunker } from '../../../src/subtitle/chunkers/DefaultSubtitleChunker.js';
import { SrtExporter } from '../../../src/subtitle/exporters/SrtExporter.js';
import { SrtParser } from '../../../src/subtitle/parsers/SrtParser.js';

const promptTemplate = [
  'Current items:',
  '{{currentLines}}',
  '',
  'Next context:',
  '{{nextLines}}',
  'Target language: {{targetLanguage}}'
].join('\n');

describe('TranslateSubtitleUseCase', () => {
  it('translates an SRT document with the mock provider and preserves timeline', async () => {
    const fileSystem = new MemoryFileSystem({
      'input.srt': [
        '1',
        '00:00:01,000 --> 00:00:03,000',
        'Hello',
        '',
        '2',
        '00:00:04,000 --> 00:00:06,000',
        'World'
      ].join('\n')
    });
    const useCase = new TranslateSubtitleUseCase({
      fileSystem,
      parser: new SrtParser(),
      exporter: new SrtExporter(),
      chunker: new DefaultSubtitleChunker(),
      provider: new MockLlmProvider(),
      promptTemplate
    });

    const result = await useCase.execute({
      inputFile: 'input.srt',
      outputFile: 'output.srt',
      targetLanguage: 'zh-CN'
    });

    expect(result).toEqual({ lineCount: 2, chunkCount: 1, outputFile: 'output.srt' });
    expect(fileSystem.files.get('output.srt')).toContain('00:00:01,000 --> 00:00:03,000');
    expect(fileSystem.files.get('output.srt')).toContain('[mock:mock-translate] Hello');
  });
});

class MemoryFileSystem implements FileSystem {
  readonly files: Map<string, string>;

  constructor(initialFiles: Record<string, string>) {
    this.files = new Map(Object.entries(initialFiles));
  }

  async readText(path: string): Promise<string> {
    const content = this.files.get(path);

    if (content === undefined) {
      throw new Error(`缺少测试文件：${path}`);
    }

    return content;
  }

  async writeText(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}
