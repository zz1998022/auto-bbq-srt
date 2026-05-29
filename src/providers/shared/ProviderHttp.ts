import { ConfigError, LlmProviderError } from '../../shared/errors/AppError.js';

export type ProviderFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface PostJsonOptions {
  providerName: string;
  fetchFn: ProviderFetch;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs?: number | undefined;
  signal?: AbortSignal | undefined;
}

export function resolveApiKey(providerName: string, apiKey?: string, apiKeyEnv?: string): string {
  const resolved = apiKey ?? (apiKeyEnv ? process.env[apiKeyEnv] : undefined);

  if (!resolved) {
    throw new ConfigError(`${providerName} 缺少 API Key，请先通过 CLI 配置或环境变量提供。`);
  }

  return resolved;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function joinApiPath(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`;
}

export async function postJson(options: PostJsonOptions): Promise<unknown> {
  const controller = new AbortController();
  const timeout = createTimeout(options.timeoutMs, controller);
  const abortFromParent = (): void => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    abortFromParent();
  } else {
    options.signal?.addEventListener('abort', abortFromParent, { once: true });
  }

  try {
    const response = await options.fetchFn(options.url, {
      method: 'POST',
      headers: {
        ...options.headers,
        'content-type': 'application/json'
      },
      body: JSON.stringify(options.body),
      signal: controller.signal
    });
    const text = await response.text();

    if (!response.ok) {
      throw new LlmProviderError(`${options.providerName} API 请求失败：HTTP ${response.status} ${trimBody(text)}`);
    }

    return parseJsonBody(options.providerName, text);
  } catch (error) {
    if (error instanceof LlmProviderError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new LlmProviderError(`${options.providerName} API 请求超时或被取消。`);
    }

    throw new LlmProviderError(`${options.providerName} API 请求失败：${formatUnknownError(error)}`);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    options.signal?.removeEventListener('abort', abortFromParent);
  }
}

function createTimeout(timeoutMs: number | undefined, controller: AbortController): NodeJS.Timeout | undefined {
  if (timeoutMs === undefined) {
    return undefined;
  }

  return setTimeout(() => controller.abort(), timeoutMs);
}

function parseJsonBody(providerName: string, text: string): unknown {
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new LlmProviderError(`${providerName} API 返回了非法 JSON。`);
  }
}

function trimBody(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}
