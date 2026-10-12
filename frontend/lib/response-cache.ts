// Small, memory-only cache. Price URLs include the prepared store context.
const responses = new Map<string, { expiresAt: number; value: unknown }>();

export async function cachedJson<T>(url: string, ttlMs: number, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const now = Date.now();
  for (const [key, entry] of responses) {
    if (entry.expiresAt <= now) responses.delete(key);
  }
  const cached = responses.get(url);
  if (cached) return structuredClone(cached.value) as T;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  const value = await response.json() as T;
  signal?.throwIfAborted();
  if (responses.size >= 128) responses.delete(responses.keys().next().value!);
  responses.set(url, { expiresAt: Date.now() + ttlMs, value: structuredClone(value) });
  return value;
}
