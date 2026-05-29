import type { Command } from 'commander';

import { renderConfigMenu } from '../config-menu/ConfigMenuModel.js';

function collectSetting(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Open the interactive settings menu or manage local CLI configuration.')
    .action(() => {
      console.log(renderConfigMenu());
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
    .action(() => {
      throw new Error('config set command is not implemented yet.');
    });

  config
    .command('show')
    .description('Show non-secret local CLI configuration.')
    .action(() => {
      throw new Error('config show command is not implemented yet.');
    });
}
