import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('sample.srt', () => {
  it('provides a minimal fixture for the first translation pipeline', async () => {
    const content = await readFile(resolve('tests/fixtures/sample.srt'), 'utf8');

    expect(content).toContain('00:00:01,000 --> 00:00:03,000');
    expect(content).toContain('Hello, welcome to the show.');
  });
});
