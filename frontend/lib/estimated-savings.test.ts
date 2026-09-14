import { describe, expect, it } from "vitest";

import type { StoreRecommendation } from "./contracts";
import type { BasketItem } from "./basket-state";
import { calculateEstimatedSavingsSnapshot } from "./estimated-savings";

function makeStore(
  premiseId: string,
  total: number | null,
  itemIds = ["a", "b"],
  options: { basketLineCount?: number; exceedsLimit?: boolean; medianIds?: string[] } = {},
): StoreRecommendation {
  const medianIds = new Set(options.medianIds ?? []);
  return {
    premiseId,
    premiseCode: `P-${premiseId}`,
    name: `Store ${premiseId}`,
    address: null,
    district: null,
    state: null,
    straightLineDistanceKm: 1,
    routeDistanceKm: 1,
    estimatedTravelMinutes: 5,
    estimatedRoundTripCostRm: 2,
    basketCostRm: total ?? 0,
    estimatedTotalCostRm: total,
    pricedItemCount: itemIds.length,
    basketItemCount: options.basketLineCount ?? 3,
    isCompleteBasket: itemIds.length === (options.basketLineCount ?? 3),
    basketPrices: itemIds.map((itemId, index) => ({
      itemId,
      itemName: `Item ${itemId}`,
      packageSize: null,
      quantity: 1,
      unitPriceRm: 1,
      lineTotalRm: index + 1,
      priceObservedDate: null,
      priceSource: medianIds.has(itemId) ? "median" : "store",
    })),
    saraStatus: "unverified",
    basketSubtotalRm: total,
    missingItems: [],
    pricedCount: itemIds.length,
    basketLineCount: options.basketLineCount ?? 3,
    saraCreditRm: null,
    cashNeededRm: null,
    priceObservedDaysAgo: null,
    combinedTotalRm: total,
    basketLines: [],
    exceedsLimit: options.exceedsLimit ?? false,
  };
}

const options = { routeProvider: "google" as const, routeWarning: null };

describe("calculateEstimatedSavingsSnapshot", () => {
  it("uses the median of selected and reachable stores with identical coverage", () => {
    const selected = makeStore("selected", 10);
    const snapshot = calculateEstimatedSavingsSnapshot(selected, [
      makeStore("other-a", 20),
      makeStore("other-b", 30),
      makeStore("unreachable", 100, ["a", "b"], { exceedsLimit: true }),
    ], [], options);

    expect(snapshot.comparableStoreCount).toBe(3);
    expect(snapshot.medianCombinedTotalRm).toBe(20);
    expect(snapshot.storeChoiceSavingsRm).toBe(10);
    expect(snapshot.totalEstimatedSavingsRm).toBe(10);
    expect(snapshot.coverage).toEqual({
      pricedItemIds: ["a", "b"],
      pricedItemCount: 2,
      basketLineCount: 3,
    });
  });

  it("averages the middle totals for an even median and rounds to cents", () => {
    const snapshot = calculateEstimatedSavingsSnapshot(
      makeStore("selected", 11.01),
      [makeStore("other", 13.02)],
      [],
      options,
    );

    expect(snapshot.medianCombinedTotalRm).toBe(12.02);
    expect(snapshot.storeChoiceSavingsRm).toBe(1.01);
  });

  it("does not compare a store with a different priced-item set or basket size", () => {
    const snapshot = calculateEstimatedSavingsSnapshot(
      makeStore("selected", 10),
      [
        makeStore("different-items", 1, ["a", "c"]),
        makeStore("different-size", 2, ["a", "b"], { basketLineCount: 4 }),
      ],
      [],
      options,
    );

    expect(snapshot.comparableStoreCount).toBe(1);
    expect(snapshot.medianCombinedTotalRm).toBeNull();
    expect(snapshot.storeChoiceSavingsRm).toBeNull();
    expect(snapshot.totalEstimatedSavingsRm).toBeNull();
  });

  it("keeps missing combined totals unavailable instead of treating them as zero", () => {
    const snapshot = calculateEstimatedSavingsSnapshot(
      makeStore("selected", null),
      [makeStore("other", 1)],
      [],
      options,
    );

    expect(snapshot.selectedCombinedTotalRm).toBeNull();
    expect(snapshot.comparableStoreCount).toBe(1);
    expect(snapshot.medianCombinedTotalRm).toBeNull();
    expect(snapshot.storeChoiceSavingsRm).toBeNull();
  });

  it("does not claim a zero saving when the selected store is not below the median", () => {
    const snapshot = calculateEstimatedSavingsSnapshot(
      makeStore("selected", 30),
      [makeStore("other", 10)],
      [],
      options,
    );

    expect(snapshot.storeChoiceSavingsRm).toBe(0);
    expect(snapshot.totalEstimatedSavingsRm).toBeNull();
  });

  it("counts only positive comparable swaps recorded at the selected premise", () => {
    const basket: BasketItem[] = [
      {
        id: "db-a", name: "Rice", size: "5 kg", qty: 2,
        saraEligible: null, saraCategoryCandidate: false,
        replacement: {
          original: { id: "db-old-a", name: "Rice", size: "5 kg", qty: 2, saraEligible: null, saraCategoryCandidate: false },
          premiseId: "selected", premiseName: "Selected", kind: "lower_cost",
          sourceUnitPriceRm: 15, alternativeUnitPriceRm: 12,
          sourceObservedDate: null, alternativeObservedDate: null,
        },
      },
      {
        id: "db-b", name: "Oil", size: "1 kg", qty: 1,
        saraEligible: null, saraCategoryCandidate: false,
        replacement: {
          original: { id: "db-old-b", name: "Oil", size: "1 kg", qty: 1, saraEligible: null, saraCategoryCandidate: false },
          premiseId: "another", premiseName: "Another", kind: "lower_cost",
          sourceUnitPriceRm: 50, alternativeUnitPriceRm: 1,
          sourceObservedDate: null, alternativeObservedDate: null,
        },
      },
      {
        id: "db-c", name: "Soap", size: "1", qty: 1,
        saraEligible: null, saraCategoryCandidate: false,
        replacement: {
          original: { id: "db-old-c", name: "Soap", size: "1", qty: 1, saraEligible: null, saraCategoryCandidate: false },
          premiseId: "selected", premiseName: "Selected", kind: "pack",
          sourceUnitPriceRm: 5, alternativeUnitPriceRm: 8,
          sourceObservedDate: null, alternativeObservedDate: null,
        },
      },
    ];
    const snapshot = calculateEstimatedSavingsSnapshot(
      makeStore("selected", 10),
      [],
      basket,
      { routeProvider: "straight_line", routeWarning: "Approximate travel estimate." },
    );

    expect(snapshot.comparableSwapCount).toBe(1);
    expect(snapshot.swapSavingsRm).toBe(6);
    expect(snapshot.totalEstimatedSavingsRm).toBe(6);
    expect(snapshot.disclosures).toMatchObject({
      routeProvider: "straight_line",
      routeWarning: "Approximate travel estimate.",
      estimatedTravelIncluded: true,
    });
  });

  it("records median-backed price coverage for the estimate disclosure", () => {
    const snapshot = calculateEstimatedSavingsSnapshot(
      makeStore("selected", 10, ["a", "b"], { medianIds: ["b"] }),
      [makeStore("other", 20)],
      [],
      options,
    );

    expect(snapshot.disclosures.medianPriceCount).toBe(1);
  });
});
