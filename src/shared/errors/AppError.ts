export class SubtitleParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubtitleParseError';
  }
}

export class TranslationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationValidationError';
  }
}

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
