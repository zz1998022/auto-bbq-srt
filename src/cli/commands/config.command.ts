import type { Command } from 'commander';

import { LocalCliConfigStore, renderConfig } from '../../infrastructure/config/LocalCliConfigStore.js';
import { runConfigMenu } from '../config-menu/runConfigMenu.js';

function collectSetting(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Open the interactive settings menu or manage local CLI configuration.')
    .action(async () => {
      await runConfigMenu();
    });

  config
    .command('set')
    .description('Set local defaults with one or more key=value settings.')
    .requiredOption(
      '--setting <key=value>',
      'Setting entry. Repeat this option for multiple entries.',
      collectSetting,
      []
    )
    .action(async (options: { setting: string[] }) => {
      const store = new LocalCliConfigStore();
      const saved = await store.setSettings(options.setting);

      console.log(`Saved ${options.setting.length} setting(s).`);
      console.log(renderConfig(saved));
    });

  config
    .command('show')
    .description('Show non-secret local CLI configuration.')
    .action(async () => {
      const store = new LocalCliConfigStore();
      console.log(renderConfig(await store.load()));
    });
}
