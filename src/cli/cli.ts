import { Command } from 'commander';

import { registerCacheCommand } from './commands/cache.command.js';
import { registerConfigCommand } from './commands/config.command.js';
import { registerInitCommand } from './commands/init.command.js';
import { registerInspectCommand } from './commands/inspect.command.js';
import { registerResumeCommand } from './commands/resume.command.js';
import { registerTranslateCommand } from './commands/translate.command.js';

export function createCli(): Command {
  const program = new Command();

  program.name('auto-bbq').description('Translate subtitle files with a pluggable LLM pipeline.').version('0.1.0');

  registerInitCommand(program);
  registerConfigCommand(program);
  registerTranslateCommand(program);
  registerResumeCommand(program);
  registerInspectCommand(program);
  registerCacheCommand(program);

  return program;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = createCli();
  await program.parseAsync(argv);
}
