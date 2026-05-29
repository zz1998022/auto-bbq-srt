import type { LlmChatRequest, LlmChatResponse, LlmProvider, LlmUsage } from '../../domain/llm/index.js';
import { LlmProviderError } from '../../shared/errors/AppError.js';
import { joinApiPath, postJson, resolveApiKey } from '../shared/ProviderHttp.js';
import type { OpenAiProviderConfig } from './OpenAiProviderConfig.js';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: NonNullable<OpenAiProviderConfig['fetchFn']>;

  constructor(private readonly config: OpenAiProviderConfig) {
    this.apiKey = resolveApiKey(this.name, config.apiKey, config.apiKeyEnv);
    this.baseUrl = config.baseUrl ?? OPENAI_BASE_URL;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const raw = await postJson({
      providerName: this.name,
      fetchFn: this.fetchFn,
      url: joinApiPath(this.baseUrl, '/chat/completions'),
      headers: {
        authorization: `Bearer ${this.apiKey}`
      },
      body: buildOpenAiRequestBody(request, this.config.model),
      timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
      signal: request.signal
    });
    const content = extractOpenAiContent(raw);
    const usage = extractOpenAiUsage(raw);

    return {
      content,
      raw,
      ...(usage ? { usage } : {})
    };
  }
}

function buildOpenAiRequestBody(request: LlmChatRequest, fallbackModel: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model || fallbackModel,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content
    }))
  };

  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  if (request.maxOutputTokens !== undefined) {
    body.max_tokens = request.maxOutputTokens;
  }

  if (request.responseFormat === 'json') {
    // OpenAI 官方 Chat Completions 支持 JSON object 响应格式，兼容阶段内的字幕 JSON 输出契约。
    body.response_format = { type: 'json_object' };
  }

  return body;
}

function extractOpenAiContent(raw: unknown): string {
  if (!isRecord(raw) || !Array.isArray(raw.choices)) {
    throw new LlmProviderError('openai API 响应缺少 choices。');
  }

  const first = raw.choices[0];

  if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== 'string') {
    throw new LlmProviderError('openai API 响应缺少文本内容。');
  }

  return first.message.content;
}

function extractOpenAiUsage(raw: unknown): LlmUsage | undefined {
  if (!isRecord(raw) || !isRecord(raw.usage)) {
    return undefined;
  }

  const usage: LlmUsage = {};

  if (typeof raw.usage.prompt_tokens === 'number') {
    usage.inputTokens = raw.usage.prompt_tokens;
  }

  if (typeof raw.usage.completion_tokens === 'number') {
    usage.outputTokens = raw.usage.completion_tokens;
  }

  if (typeof raw.usage.total_tokens === 'number') {
    usage.totalTokens = raw.usage.total_tokens;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
