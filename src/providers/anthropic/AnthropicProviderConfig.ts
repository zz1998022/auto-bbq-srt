import type { ProviderFetch } from '../shared/ProviderHttp.js';

export interface AnthropicProviderConfig {
  apiKey?: string;
  apiKeyEnv?: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  anthropicVersion?: string;
  fetchFn?: ProviderFetch;
}
