import { describe, expect, it } from 'vitest';

import { CONFIG_MENU_ITEMS, renderConfigMenu } from '../../../src/cli/config-menu/ConfigMenuModel.js';
import { createCli } from '../../../src/cli/cli.js';

describe('createCli', () => {
  it('registers the planned stage-zero commands', () => {
    const program = createCli();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual(expect.arrayContaining(['init', 'config', 'translate', 'resume', 'inspect', 'cache']));
  });

  it('registers translate options needed by the MVP path', () => {
    const translate = createCli().commands.find((command) => command.name() === 'translate');

    expect(translate).toBeDefined();
    expect(translate?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining(['--output', '--provider', '--target', '--dry-run'])
    );
  });

  it('keeps advanced defaults out of the translate command', () => {
    const translate = createCli().commands.find((command) => command.name() === 'translate');

    expect(translate?.options.map((option) => option.long)).not.toEqual(
      expect.arrayContaining(['--model', '--mode', '--concurrency', '--max-retries', '--glossary', '--verbose'])
    );
  });

  it('registers config commands for CLI-first provider setup', () => {
    const config = createCli().commands.find((command) => command.name() === 'config');

    expect(config?.commands.map((command) => command.name())).toEqual(expect.arrayContaining(['set', 'show']));
  });

  it('uses a single setting option for advanced CLI configuration', () => {
    const configSet = createCli()
      .commands.find((command) => command.name() === 'config')
      ?.commands.find((command) => command.name() === 'set');

    expect(configSet?.options.map((option) => option.long)).toEqual(expect.arrayContaining(['--setting']));
  });

  it('defines an interactive numbered settings menu', () => {
    expect(CONFIG_MENU_ITEMS.map((item) => item.label)).toEqual(['LLM Provider']);
    expect(renderConfigMenu()).toContain('Press a key [1...1 / 0]:');
    expect(renderConfigMenu()).not.toContain('Translation');
    expect(renderConfigMenu()).not.toContain('Chunk');
    expect(renderConfigMenu()).not.toContain('Output');
  });
});
