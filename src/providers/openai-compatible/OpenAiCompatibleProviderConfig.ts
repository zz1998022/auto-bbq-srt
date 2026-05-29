import type { ProviderFetch } from '../shared/ProviderHttp.js';

export interface OpenAiCompatibleProviderConfig {
  apiKey?: string;
  apiKeyEnv?: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetchFn?: ProviderFetch;
}
