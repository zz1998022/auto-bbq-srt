import type { ProviderFetch } from '../shared/ProviderHttp.js';

export interface OpenAiProviderConfig {
  apiKey?: string;
  apiKeyEnv?: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: ProviderFetch;
}
