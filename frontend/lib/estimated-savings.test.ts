import { describe, expect, it } from "vitest";
import type { StoreRecommendation } from "./contracts";
import { calculateEstimatedSavings, isEstimatedSavingsSnapshot } from "./estimated-savings";

function store(
  premiseId: string,
  combinedTotalRm: number | null,
  lineIds = ["1", "2"],
  options: Partial<StoreRecommendation> = {},
): StoreRecommendation {
  return {
    premiseId,
    premiseCode: premiseId,
    name: `Store ${premiseId}`,
    address: null,
    district: null,
    state: null,
    straightLineDistanceKm: 1,
    routeDistanceKm: 1,
    estimatedTravelMinutes: 5,
    estimatedRoundTripCostRm: 4,
    basketCostRm: combinedTotalRm == null ? 0 : combinedTotalRm - 4,
    estimatedTotalCostRm: combinedTotalRm,
    pricedItemCount: lineIds.length,
    basketItemCount: lineIds.length,
    isCompleteBasket: true,
    basketPrices: [],
    saraStatus: "unverified",
    basketSubtotalRm: combinedTotalRm == null ? null : combinedTotalRm - 4,
    missingItems: [],
    pricedCount: lineIds.length,
    basketLineCount: lineIds.length,
    saraCreditRm: null,
    cashNeededRm: null,
    priceObservedDaysAgo: null,
    combinedTotalRm,
    basketLines: lineIds.map(itemId => ({
      itemId,
      itemName: `Item ${itemId}`,
      itemNameEn: null,
      itemNameMs: null,
      unit: null,
      quantity: 1,
      unitPriceRm: 5,
      lineTotalRm: 5,
      observedDate: null,
      priceSource: "store",
      category: null,
    })),
    exceedsLimit: false,
    ...options,
  };
}

describe("calculateEstimatedSavings", () => {
  it("combines median store choice and item changes without double-counting", () => {
    const selected = store("a", 50);
    const result = calculateEstimatedSavings(
      selected,
      [selected, store("b", 54), store("c", 58)],
      46,
      40,
      "google",
    );

    expect(result.medianCombinedCostRm).toBe(54);
    expect(result.selectedBaselineCombinedCostRm).toBe(50);
    expect(result.selectedCurrentCombinedCostRm).toBe(44);
    expect(result.storeChoiceImpactRm).toBe(4);
    expect(result.itemChangeImpactRm).toBe(6);
    expect(result.netSavingRm).toBe(10);
  });

  it("keeps an above-median store choice signed so it offsets swap savings", () => {
    const selected = store("a", 60);
    const result = calculateEstimatedSavings(
      selected,
      [store("b", 48), store("c", 52), selected],
      56,
      51,
      "google",
    );

    expect(result.storeChoiceImpactRm).toBe(-8);
    expect(result.itemChangeImpactRm).toBe(5);
    expect(result.netSavingRm).toBe(-3);
  });

  it("excludes out-of-limit and differently priced partial baskets", () => {
    const selected = store("a", 50);
    const result = calculateEstimatedSavings(
      selected,
      [
        selected,
        store("b", 40, ["1"]),
        store("c", 42, ["1", "2"], { exceedsLimit: true }),
      ],
      46,
      44,
      "straight_line",
    );

    expect(result.medianCombinedCostRm).toBeNull();
    expect(result.storeChoiceImpactRm).toBeNull();
    expect(result.netSavingRm).toBe(2);
    expect(result.comparableStoreCount).toBe(1);
    expect(result.routeEstimated).toBe(true);
  });

  it("validates persisted snapshots", () => {
    const selected = store("a", 50);
    const snapshot = calculateEstimatedSavings(selected, [selected, store("b", 54)], 46, 46, "google");
    expect(isEstimatedSavingsSnapshot(snapshot)).toBe(true);
    expect(isEstimatedSavingsSnapshot({ ...snapshot, comparableStoreCount: -1 })).toBe(false);
  });
});
