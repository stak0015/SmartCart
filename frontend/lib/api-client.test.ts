import { afterEach, describe, expect, it, vi } from "vitest";

import { getBasketAlternatives } from "./api-client";

afterEach(() => vi.unstubAllGlobals());

describe("getBasketAlternatives", () => {
  it("posts the selected premise and basket lines", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ premiseId: "10", lines: [], generatedAt: "2026-08-31T00:00:00Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getBasketAlternatives("10", [{ itemId: "1", quantity: 2 }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/premises/10/basket-alternatives",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ basket: [{ itemId: "1", quantity: 2 }] }),
      }),
    );
  });
});
