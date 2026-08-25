import { describe, expect, it } from "vitest";
import { rankReachableStores, type RankedRouteInput } from "./recommendation";
import { estimateRoundTripCostRm } from "./travel-cost";

const costRate = {
  baseFarePerLegRm: 0,
  perKilometreRm: 0.5,
  description: "test rate",
};

function route(overrides: Partial<RankedRouteInput> = {}): RankedRouteInput {
  return {
    premiseId: "1",
    premiseCode: "P1",
    name: "Test Store",
    address: null,
    district: "Kota Bharu",
    state: "Kelantan",
    straightLineDistanceKm: 1,
    saraStatus: "unverified",
    distanceMeters: 2_000,
    durationSeconds: 600,
    ...overrides,
  };
}

describe("travel-cost recommendation ranking", () => {
  it("calculates a return trip from the one-way route distance", () => {
    expect(estimateRoundTripCostRm(2_000, costRate)).toBe(2);
  });

  it("filters using routed distance rather than straight-line distance", () => {
    const recommendations = rankReachableStores({
      routes: [route({ straightLineDistanceKm: 1.5, distanceMeters: 5_100 })],
      limitType: "distance",
      limitValue: 5,
      costRate,
    });

    expect(recommendations).toEqual([]);
  });

  it("filters a time limit using exact seconds", () => {
    const recommendations = rankReachableStores({
      routes: [
        route({ premiseId: "1", durationSeconds: 1_200 }),
        route({ premiseId: "2", durationSeconds: 1_201 }),
      ],
      limitType: "time",
      limitValue: 20,
      costRate,
    });

    expect(recommendations.map(store => store.premiseId)).toEqual(["1"]);
  });

  it("sorts by estimated cost, then duration and distance", () => {
    const recommendations = rankReachableStores({
      routes: [
        route({ premiseId: "1", name: "Far", distanceMeters: 3_000, durationSeconds: 500 }),
        route({ premiseId: "2", name: "Slow", distanceMeters: 2_000, durationSeconds: 700 }),
        route({ premiseId: "3", name: "Fast", distanceMeters: 2_000, durationSeconds: 600 }),
      ],
      limitType: "distance",
      limitValue: 10,
      costRate,
    });

    expect(recommendations.map(store => store.premiseId)).toEqual(["3", "2", "1"]);
  });
});
