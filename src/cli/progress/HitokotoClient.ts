export interface HitokotoSentence {
  text: string;
  from?: string;
}

interface HitokotoResponse {
  hitokoto?: unknown;
  from?: unknown;
}

export async function fetchHitokoto(fetchFn: typeof fetch = fetch): Promise<HitokotoSentence | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const url = 'https://v1.hitokoto.cn/?c=a&c=b&c=c&encode=json&max_length=40';
    const response = await fetchFn(url, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as HitokotoResponse;

    if (typeof data.hitokoto !== 'string' || data.hitokoto.length === 0) {
      return null;
    }

    return {
      text: data.hitokoto,
      ...(typeof data.from === 'string' && data.from.length > 0 ? { from: data.from } : {})
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
