import type { Command } from 'commander';

export function registerTranslateCommand(program: Command): void {
  program
    .command('translate')
    .description('Translate a subtitle file.')
    .argument('<input>', 'Input subtitle file path.')
    .requiredOption('-o, --output <path>', 'Output subtitle file path.')
    .option('--provider <provider>', 'LLM provider name.')
    .option('--target <language>', 'Target language.')
    .option('--dry-run', 'Parse and validate without calling a real provider.')
    .action(() => {
      throw new Error('translate command is not implemented yet.');
    });
}
