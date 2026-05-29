import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli/cli.js';

describe('translate CLI', () => {
  it('runs the mock translation command and writes an output SRT', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'auto-bbq-srt-'));
    const outputFile = join(tempDir, 'output.zh.srt');

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

      expect(output).toContain('00:00:01,000 --> 00:00:03,000');
      expect(output).toContain('[mock:mock-translate] Hello, welcome to the show.');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
