export class SubtitleParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubtitleParseError';
  }
}
