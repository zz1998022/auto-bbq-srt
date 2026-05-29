import type { LlmChatRequest, LlmChatResponse, LlmProvider, LlmUsage } from '../../domain/llm/index.js';
import { ConfigError, LlmProviderError } from '../../shared/errors/AppError.js';
import { joinApiPath, postJson, resolveApiKey } from '../shared/ProviderHttp.js';
import type { OpenAiCompatibleProviderConfig } from './OpenAiCompatibleProviderConfig.js';

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = 'openai-compatible';
  private readonly apiKey: string;
  private readonly fetchFn: NonNullable<OpenAiCompatibleProviderConfig['fetchFn']>;

  constructor(private readonly config: OpenAiCompatibleProviderConfig) {
    if (!config.baseUrl) {
      throw new ConfigError('openai-compatible 必须显式配置 baseUrl。');
    }

    this.apiKey = resolveApiKey(this.name, config.apiKey, config.apiKeyEnv);
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const raw = await postJson({
      providerName: this.name,
      fetchFn: this.fetchFn,
      url: joinApiPath(this.config.baseUrl, '/chat/completions'),
      headers: {
        authorization: `Bearer ${this.apiKey}`
      },
      body: buildCompatibleRequestBody(request, this.config.model),
      timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
      signal: request.signal
    });
    const content = extractCompatibleContent(raw);
    const usage = extractCompatibleUsage(raw);

    return {
      content,
      raw,
      ...(usage ? { usage } : {})
    };
  }
}

function buildCompatibleRequestBody(request: LlmChatRequest, fallbackModel: string): Record<string, unknown> {
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
    // 第三方兼容接口通常沿用 OpenAI JSON object 参数；不支持时由 Provider 错误路径暴露响应体。
    body.response_format = { type: 'json_object' };
  }

  return body;
}

function extractCompatibleContent(raw: unknown): string {
  if (!isRecord(raw) || !Array.isArray(raw.choices)) {
    throw new LlmProviderError('openai-compatible API 响应缺少 choices。');
  }

  const first = raw.choices[0];

  if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== 'string') {
    throw new LlmProviderError('openai-compatible API 响应缺少文本内容。');
  }

  return first.message.content;
}

function extractCompatibleUsage(raw: unknown): LlmUsage | undefined {
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
