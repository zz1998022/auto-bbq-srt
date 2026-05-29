import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli/cli.js';

const originalConfigPath = process.env.AUTO_BBQ_CONFIG_PATH;

describe('translate CLI', () => {
  afterEachEnv();

  it('runs the mock translation command and writes an output SRT', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'auto-bbq-srt-'));
    const outputFile = join(tempDir, 'output.zh.srt');
    const configPath = join(tempDir, 'config.json');

    process.env.AUTO_BBQ_CONFIG_PATH = configPath;

    try {
      await runCli([
        'node',
        'auto-bbq',
        'translate',
        resolve('tests/fixtures/sample.srt'),
        '-o',
        outputFile,
        '--provider',
        'mock'
      ]);
      const output = await readFile(outputFile, 'utf8');
      const jobIds = await readdir('.auto-bbq/jobs');
      const jobId = jobIds[0];

      if (!jobId) {
        throw new Error('缺少 CLI 生成的任务 ID。');
      }

      await runCli(['node', 'auto-bbq', 'resume', jobId]);

      expect(output).toContain('00:00:01,000 --> 00:00:03,000');
      expect(output).toContain('[mock:mock-translate] Hello, welcome to the show.');
      expect(jobIds.length).toBeGreaterThan(0);
    } finally {
      await rm('.auto-bbq', { recursive: true, force: true });
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('uses local CLI config when provider is not passed explicitly', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'auto-bbq-srt-'));
    const outputFile = join(tempDir, 'output.zh.srt');
    const configPath = join(tempDir, 'config.json');

    process.env.AUTO_BBQ_CONFIG_PATH = configPath;

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          llm: { provider: 'mock', model: 'mock-from-config' },
          translation: { targetLanguage: 'ja-JP' }
        }),
        'utf8'
      );
      await runCli(['node', 'auto-bbq', 'translate', resolve('tests/fixtures/sample.srt'), '-o', outputFile]);

      const output = await readFile(outputFile, 'utf8');

      expect(output).toContain('[mock:mock-from-config] Hello, welcome to the show.');
    } finally {
      await rm('.auto-bbq', { recursive: true, force: true });
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function afterEachEnv(): void {
  afterEach(() => {
    if (originalConfigPath === undefined) {
      delete process.env.AUTO_BBQ_CONFIG_PATH;
    } else {
      process.env.AUTO_BBQ_CONFIG_PATH = originalConfigPath;
    }
  });
}
