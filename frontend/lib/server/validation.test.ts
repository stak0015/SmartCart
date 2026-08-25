import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { parseRecommendationRequest } from "./validation";

const validRequest = {
  travel: {
    origin: {
      label: "Kota Bharu, Kelantan",
      latitude: 6.1254,
      longitude: 102.2381,
      source: "search",
    },
    transportMode: "motorcycle",
    limit: { type: "distance", value: 5 },
    saraFilter: "candidate",
  },
};

describe("recommendation request validation", () => {
  it("accepts complete travel preferences", () => {
    expect(parseRecommendationRequest(validRequest).travel.transportMode).toBe("motorcycle");
  });

  it("rejects coordinates outside valid ranges", () => {
    expect(() => parseRecommendationRequest({
      ...validRequest,
      travel: {
        ...validRequest.travel,
        origin: { ...validRequest.travel.origin, latitude: 91 },
      },
    })).toThrow(AppError);
  });

  it("rejects travel limits outside the supported range", () => {
    try {
      parseRecommendationRequest({
        ...validRequest,
        travel: { ...validRequest.travel, limit: { type: "time", value: 2 } },
      });
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("INVALID_TRAVEL_LIMIT");
    }
  });
});
