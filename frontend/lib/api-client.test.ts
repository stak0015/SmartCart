import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteRecommendationCandidates,
  getBasketAlternatives,
  getRecommendations,
  prepareRecommendationCandidates,
  reverseLocation,
} from "./api-client";
import type { TravelPreferencesRequest } from "./contracts";

afterEach(() => vi.unstubAllGlobals());

const travel: TravelPreferencesRequest = {
  origin: { label: "Test location", latitude: 3.14, longitude: 101.69, source: "search" },
  transportMode: "public_transport",
  limit: { type: "both", distanceKm: 10, timeMinutes: 45 },
  saraFilter: "any",
};

describe("candidate preparation requests", () => {
  it("posts travel preferences and forwards an abort signal", async () => {
    const response = {
      preparationId: "candidate-preparation-123456",
      candidateCount: 8,
      totalCandidatesEvaluated: 10,
      status: "ready",
      routeProvider: "google",
      routeWarning: null,
      generatedAt: "2026-09-14T00:00:00Z",
      expiresAt: "2026-09-14T00:30:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(prepareRecommendationCandidates(travel, controller.signal)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/recommendation-candidates",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ travel }),
        signal: controller.signal,
      }),
    );
  });

  it("deletes a preparation by encoded ID and accepts the 204 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteRecommendationCandidates("id/with space")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/recommendation-candidates/id%2Fwith%20space",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("posts a fresh basket with the opaque preparation ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recommendations: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getRecommendations({
      candidatePreparationId: "candidate-preparation-123456",
      basket: [{ itemId: "42", quantity: 2 }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/recommendations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          candidatePreparationId: "candidate-preparation-123456",
          basket: [{ itemId: "42", quantity: 2 }],
        }),
      }),
    );
  });

  it("exposes the prepared-candidate expiry code without remapping it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({
        error: { code: "CANDIDATE_PREPARATION_EXPIRED", message: "Prepare candidates again." },
      }),
    }));

    await expect(getRecommendations({ candidatePreparationId: "expired-handle", basket: [] }))
      .rejects.toMatchObject({
        code: "CANDIDATE_PREPARATION_EXPIRED",
        status: 410,
      });
  });
});

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
