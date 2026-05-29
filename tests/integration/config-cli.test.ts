import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli/cli.js';

const originalConfigPath = process.env.AUTO_BBQ_CONFIG_PATH;

describe('config CLI', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'auto-bbq-cli-config-'));
    configPath = join(tempDir, 'config.json');
    process.env.AUTO_BBQ_CONFIG_PATH = configPath;
  });

  afterEach(async () => {
    if (originalConfigPath === undefined) {
      delete process.env.AUTO_BBQ_CONFIG_PATH;
    } else {
      process.env.AUTO_BBQ_CONFIG_PATH = originalConfigPath;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  it('persists settings through the script-friendly setting option', async () => {
    await runCli([
      'node',
      'auto-bbq',
      'config',
      'set',
      '--setting',
      'llm.provider=openai',
      '--setting',
      'llm.apiKey=sk-test-secret',
      '--setting',
      'llm.model=gpt-4.1-mini'
    ]);

    await expect(readFile(configPath, 'utf8')).resolves.toContain('"provider": "openai"');
    await expect(readFile(configPath, 'utf8')).resolves.toContain('"apiKey": "sk-test-secret"');
  });
});
