import { afterEach, describe, expect, it, vi } from "vitest";

import { getBasketAlternatives, reverseLocation } from "./api-client";

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

describe("reverseLocation", () => {
  it("posts coordinates and forwards an abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ label: "10 Example Street" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await reverseLocation(-37.8136, 144.9631, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/locations/reverse",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ latitude: -37.8136, longitude: 144.9631 }),
        signal: controller.signal,
      }),
    );
  });
});
