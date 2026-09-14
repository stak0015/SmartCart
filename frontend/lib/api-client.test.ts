import { afterEach, describe, expect, it, vi } from "vitest";

import { getBasketAlternatives, prepareRecommendationCandidates, reverseLocation } from "./api-client";

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

describe("prepareRecommendationCandidates", () => {
  it("warms travel candidates without sending a basket", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidateCacheId: "cache-1234567890", candidateCount: 2, reachableCount: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const travel = {
      origin: {
        label: "Kota Bharu",
        latitude: 6.1254,
        longitude: 102.2381,
        source: "search" as const,
      },
      transportMode: "motorcycle" as const,
      limit: { type: "distance" as const, value: 5 },
      saraFilter: "any" as const,
    };

    await prepareRecommendationCandidates(travel);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/recommendations/prepare",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ travel }),
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
