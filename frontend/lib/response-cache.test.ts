import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedJson } from "./response-cache";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("catalogue response caching", () => {
  it("reuses successful lookups, isolates store contexts, and expires prices", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ price: 2 }) });
    vi.stubGlobal("fetch", fetcher);
    const first = await cachedJson<{ price: number }>("/items?context=A", 30_000);
    first.price = 99;
    expect(await cachedJson("/items?context=A", 30_000)).toEqual({ price: 2 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await cachedJson("/items?context=B", 30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(31_001);
    await cachedJson("/items?context=A", 30_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("does not cache errors or let cancelled lookups complete", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetcher);
    await expect(cachedJson("/failure", 60_000)).rejects.toThrow("503");
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ available: true }) });
    await cachedJson("/failure", 60_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const controller = new AbortController();
    controller.abort();
    await expect(cachedJson("/failure", 60_000, controller.signal)).rejects.toThrow();
  });
});
