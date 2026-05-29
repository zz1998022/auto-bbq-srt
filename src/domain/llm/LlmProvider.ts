import type { LlmMessage } from './LlmMessage.js';
import type { LlmUsage } from './LlmUsage.js';

export interface LlmProvider {
  name: string;
  chat(request: LlmChatRequest): Promise<LlmChatResponse>;
}

export interface LlmChatRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: 'text' | 'json';
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface LlmChatResponse {
  content: string;
  usage?: LlmUsage;
  raw?: unknown;
}
