import type { Command } from 'commander';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize local auto-bbq workspace metadata.')
    .action(() => {
      throw new Error('init command is not implemented yet.');
    });
}
