import type { Command } from 'commander';

export function registerInspectCommand(program: Command): void {
  program
    .command('inspect')
    .description('Inspect a translation job.')
    .argument('<jobId>', 'Translation job id.')
    .action(() => {
      throw new Error('inspect command is not implemented yet.');
    });
}
