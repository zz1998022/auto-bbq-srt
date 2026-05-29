import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LocalCliConfigStore,
  parseSetting,
  renderConfig
} from '../../../src/infrastructure/config/LocalCliConfigStore.js';
import { ConfigError } from '../../../src/shared/errors/AppError.js';

describe('LocalCliConfigStore', () => {
  it('stores nested settings in a local JSON file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'auto-bbq-config-'));
    const configPath = join(dir, 'config.json');

    try {
      const store = new LocalCliConfigStore(configPath);

      await store.setSettings([
        'llm.provider=openai',
        'llm.apiKey=sk-test-secret',
        'llm.model=gpt-4.1-mini',
        'chunk.maxLines=30',
        'cache.enabled=true'
      ]);

      await expect(store.load()).resolves.toMatchObject({
        llm: {
          provider: 'openai',
          apiKey: 'sk-test-secret',
          model: 'gpt-4.1-mini'
        },
        chunk: {
          maxLines: 30
        },
        cache: {
          enabled: true
        }
      });
      await expect(readFile(configPath, 'utf8')).resolves.toContain('"apiKey": "sk-test-secret"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('masks secrets when rendering config for display', () => {
    expect(renderConfig({ llm: { apiKey: 'sk-1234567890', model: 'gpt' } })).toContain('sk-1...7890');
    expect(renderConfig({ llm: { apiKey: 'sk-1234567890', model: 'gpt' } })).not.toContain('sk-1234567890');
  });

  it('rejects malformed setting input', () => {
    expect(() => parseSetting('llm.provider')).toThrow(ConfigError);
    expect(() => parseSetting('llm..provider=openai')).toThrow(ConfigError);
  });
});
