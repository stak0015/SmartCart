import { afterEach, describe, expect, it, vi } from "vitest";

import { listCategories, searchItems } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchItems", () => {
  it("requests the default catalogue when the query and filters are empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchItems("");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/items/search?q=&page=1",
      { signal: undefined },
    );
  });

  it("sends every selected category as a separate query parameter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchItems("milk", 2, ["drinks-milk", "fresh-produce"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/items/search?q=milk&page=2&category=drinks-milk&category=fresh-produce",
      { signal: undefined },
    );
  });

  it("uses nested broad category summaries from the catalogue response", async () => {
    const category = { id: "fresh-produce", labelEn: "Fresh Produce", labelMs: "Hasil Segar", spendingClass: "essential" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 1, items: [{ item_id: 1, category, item_category: "BAWANG" }] }),
    }));
    const result = await searchItems("onion");
    expect(result.items[0].category).toEqual(category);
  });

  it("loads broad category filter summaries", async () => {
    const category = { id: "fresh-produce", labelEn: "Fresh Produce", labelMs: "Hasil Segar", spendingClass: "essential" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 1, categories: [category] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await listCategories()).toEqual({ count: 1, categories: [category] });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/items/categories", { signal: undefined });
  });
});
