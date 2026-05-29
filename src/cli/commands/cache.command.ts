import type { Command } from 'commander';

export function registerCacheCommand(program: Command): void {
  const cache = program.command('cache').description('Manage local translation cache.');

  cache
    .command('clean')
    .description('Clean local translation cache.')
    .action(() => {
      throw new Error('cache clean command is not implemented yet.');
    });
}
