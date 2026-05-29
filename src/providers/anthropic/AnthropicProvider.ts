import type { LlmChatRequest, LlmChatResponse, LlmProvider, LlmMessage, LlmUsage } from '../../domain/llm/index.js';
import { LlmProviderError } from '../../shared/errors/AppError.js';
import { joinApiPath, postJson, resolveApiKey } from '../shared/ProviderHttp.js';
import type { AnthropicProviderConfig } from './AnthropicProviderConfig.js';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: NonNullable<AnthropicProviderConfig['fetchFn']>;

  constructor(private readonly config: AnthropicProviderConfig) {
    this.apiKey = resolveApiKey(this.name, config.apiKey, config.apiKeyEnv);
    this.baseUrl = config.baseUrl ?? ANTHROPIC_BASE_URL;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const raw = await postJson({
      providerName: this.name,
      fetchFn: this.fetchFn,
      url: joinApiPath(this.baseUrl, '/v1/messages'),
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.config.anthropicVersion ?? ANTHROPIC_VERSION
      },
      body: buildAnthropicRequestBody(request, this.config.model),
      timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
      signal: request.signal
    });
    const content = extractAnthropicContent(raw);
    const usage = extractAnthropicUsage(raw);

    return {
      content,
      raw,
      ...(usage ? { usage } : {})
    };
  }
}

function buildAnthropicRequestBody(request: LlmChatRequest, fallbackModel: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model || fallbackModel,
    max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
    messages: toAnthropicMessages(request.messages)
  };
  const system = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');

  if (system) {
    // Anthropic Messages API 把 system 作为顶层字段，不能混在 messages 数组里。
    body.system = system;
  }

  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  return body;
}

function toAnthropicMessages(messages: LlmMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.flatMap((message) => {
    if (message.role === 'system') {
      return [];
    }

    return [{ role: message.role, content: message.content }];
  });
}

function extractAnthropicContent(raw: unknown): string {
  if (!isRecord(raw) || !Array.isArray(raw.content)) {
    throw new LlmProviderError('anthropic API 响应缺少 content。');
  }

  const texts = raw.content
    .map((item) => (isRecord(item) && item.type === 'text' && typeof item.text === 'string' ? item.text : ''))
    .filter((text) => text.length > 0);

  if (texts.length === 0) {
    throw new LlmProviderError('anthropic API 响应缺少文本内容。');
  }

  return texts.join('');
}

function extractAnthropicUsage(raw: unknown): LlmUsage | undefined {
  if (!isRecord(raw) || !isRecord(raw.usage)) {
    return undefined;
  }

  const usage: LlmUsage = {};

  if (typeof raw.usage.input_tokens === 'number') {
    usage.inputTokens = raw.usage.input_tokens;
  }

  if (typeof raw.usage.output_tokens === 'number') {
    usage.outputTokens = raw.usage.output_tokens;
  }

  if (usage.inputTokens !== undefined && usage.outputTokens !== undefined) {
    usage.totalTokens = usage.inputTokens + usage.outputTokens;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
