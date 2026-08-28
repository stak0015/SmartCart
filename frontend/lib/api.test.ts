import { afterEach, describe, expect, it, vi } from "vitest";

import { searchItems } from "./api";

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

    await searchItems("milk", 2, ["DAIRY", "FRESH DRINKS"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/items/search?q=milk&page=2&category=DAIRY&category=FRESH+DRINKS",
      { signal: undefined },
    );
  });
});
