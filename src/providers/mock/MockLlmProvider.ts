import type { LlmChatRequest, LlmChatResponse, LlmProvider } from '../../domain/llm/index.js';

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const userMessage = [...request.messages].reverse().find((message) => message.role === 'user');
    const items = extractPromptItems(userMessage?.content ?? '');
    const translatedItems = items.map((item) => ({
      id: item.id,
      translation: `[mock:${request.model}] ${item.text}`
    }));

    return {
      content: JSON.stringify({ items: translatedItems }),
      usage: {
        inputTokens: userMessage?.content.length ?? 0,
        outputTokens: translatedItems.length,
        totalTokens: (userMessage?.content.length ?? 0) + translatedItems.length
      }
    };
  }
}

interface PromptItem {
  id: string;
  text: string;
}

function extractPromptItems(prompt: string): PromptItem[] {
  const marker = 'Current items:';
  const start = prompt.indexOf(marker);

  if (start < 0) {
    return [];
  }

  const afterMarker = prompt.slice(start + marker.length);
  const nextMarker = afterMarker.indexOf('\n\nNext context:');
  const jsonText = (nextMarker >= 0 ? afterMarker.slice(0, nextMarker) : afterMarker).trim();

  try {
    const parsed = JSON.parse(jsonText) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPromptItem).map((item) => ({ id: item.id, text: item.text }));
  } catch {
    return [];
  }
}

function isPromptItem(value: unknown): value is PromptItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as PromptItem).id === 'string' &&
    typeof (value as PromptItem).text === 'string'
  );
}
