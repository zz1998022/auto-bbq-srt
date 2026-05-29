import type { SubtitleChunk, SubtitleLine } from '../domain/subtitle/index.js';
import type { TranslationOptions } from '../domain/translation/index.js';

export const SUBTITLE_TRANSLATE_PROMPT_VERSION = 'subtitle-translate-v1';

export interface TranslationPromptBuilderOptions {
  template: string;
}

export class TranslationPromptBuilder {
  constructor(private readonly options: TranslationPromptBuilderOptions) {}

  build(chunk: SubtitleChunk, translationOptions: TranslationOptions): string {
    return this.options.template
      .replaceAll('{{sourceLanguage}}', translationOptions.sourceLanguage)
      .replaceAll('{{targetLanguage}}', translationOptions.targetLanguage)
      .replaceAll('{{style}}', translationOptions.style)
      .replaceAll('{{previousLines}}', formatContextLines(chunk.context?.previousLines ?? []))
      .replaceAll('{{currentLines}}', formatCurrentLines(chunk.lines))
      .replaceAll('{{nextLines}}', formatContextLines(chunk.context?.nextLines ?? []));
  }
}

function formatCurrentLines(lines: SubtitleLine[]): string {
  return JSON.stringify(
    lines.map((line) => ({ id: line.id, text: line.sourceText })),
    null,
    2
  );
}

function formatContextLines(lines: SubtitleLine[]): string {
  if (lines.length === 0) {
    return '(none)';
  }

  return lines.map((line) => `[${line.id}] ${line.sourceText}`).join('\n');
}
