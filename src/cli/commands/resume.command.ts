import type { Command } from 'commander';

export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Resume an existing translation job.')
    .argument('<jobId>', 'Translation job id.')
    .action(() => {
      throw new Error('resume command is not implemented yet.');
    });
}
