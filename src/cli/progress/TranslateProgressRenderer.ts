import type { TranslateSubtitleProgressEvent } from '../../app/TranslateSubtitleUseCase.js';
import type { HitokotoSentence } from './HitokotoClient.js';

export type HitokotoFetcher = () => Promise<HitokotoSentence | null>;

export class TranslateProgressRenderer {
  private readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;
  private completedChunks = 0;
  private chunkCount = 0;
  private currentChunk = '';
  private renderTimer: NodeJS.Timeout | null = null;
  private quoteTimer: NodeJS.Timeout | null = null;
  private quote: HitokotoSentence | null = null;
  private refreshingQuote = false;

  constructor(
    private readonly fetchQuote: HitokotoFetcher,
    private readonly stream: NodeJS.WriteStream = process.stdout
  ) {}

  start(): void {
    if (!this.stream.isTTY) {
      return;
    }

    void this.refreshQuote();
    this.quoteTimer = setInterval(() => void this.refreshQuote(), 5000);
    this.renderTimer = setInterval(() => this.render(), 120);
  }

  update(event: TranslateSubtitleProgressEvent): void {
    if (!this.stream.isTTY) {
      return;
    }

    if (event.type === 'started') {
      this.completedChunks = 0;
      this.chunkCount = event.chunkCount;
      this.currentChunk = '准备开始';
    }

    if (event.type === 'chunk-start') {
      this.completedChunks = event.completedChunks;
      this.chunkCount = event.chunkCount;
      this.currentChunk = `正在翻译 ${event.chunkId}`;
    }

    if (event.type === 'chunk-success') {
      this.completedChunks = event.completedChunks;
      this.chunkCount = event.chunkCount;
      this.currentChunk = event.cacheHit ? `${event.chunkId} 命中缓存` : `${event.chunkId} 已完成`;
    }

    if (event.type === 'chunk-retry') {
      this.currentChunk = `${event.chunkId} 重试 ${event.retryCount}/${event.maxRetries}: ${event.error}`;
    }

    if (event.type === 'chunk-failed') {
      this.currentChunk = `${event.chunkId} 失败：${event.error}`;
    }

    if (event.type === 'finished') {
      this.completedChunks = event.completedChunks;
      this.chunkCount = event.chunkCount;
      this.currentChunk = '全部完成';
    }

    this.render();
  }

  stop(): void {
    if (this.renderTimer) {
      clearInterval(this.renderTimer);
      this.renderTimer = null;
    }

    if (this.quoteTimer) {
      clearInterval(this.quoteTimer);
      this.quoteTimer = null;
    }

    if (this.stream.isTTY) {
      this.render();
      this.stream.write('\n');
    }
  }

  private async refreshQuote(): Promise<void> {
    if (this.refreshingQuote) {
      return;
    }

    this.refreshingQuote = true;

    try {
      this.quote = await this.fetchQuote();
      this.render();
    } finally {
      this.refreshingQuote = false;
    }
  }

  private render(): void {
    const total = Math.max(this.chunkCount, 1);
    const ratio = Math.min(this.completedChunks / total, 1);
    const width = 28;
    const filled = Math.round(ratio * width);
    const bar = `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
    const percent = `${Math.round(ratio * 100)}`.padStart(3, ' ');
    const frame = this.frames[this.frameIndex % this.frames.length] ?? '-';
    const quoteText = this.quote ? `  一言: ${this.quote.text}${this.quote.from ? ` -- ${this.quote.from}` : ''}` : '';

    this.frameIndex += 1;
    this.stream.write(
      `\r\x1b[2K${cyan(frame)} ${green(`[${bar}]`)} ${percent}% ${this.completedChunks}/${this.chunkCount} ${this.currentChunk}${dim(quoteText)}`
    );
  }
}

function cyan(value: string): string {
  return `\x1b[36m${value}\x1b[0m`;
}

function green(value: string): string {
  return `\x1b[32m${value}\x1b[0m`;
}

function dim(value: string): string {
  return `\x1b[2m${value}\x1b[0m`;
}
