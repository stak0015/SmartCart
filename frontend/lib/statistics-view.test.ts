import { describe, expect, it } from "vitest";
import type { ItemCategory } from "./contracts";
import { buildStatisticsView } from "./statistics-view";
import type { TripRecord } from "./trip-history";

const staples: ItemCategory = {
  id: "staples", labelEn: "Rice, Noodles & Bread", labelMs: "Beras, Mi & Roti", spendingClass: "essential",
};

function trip(id: string, recordedAt: string, withMissingPrice = false): TripRecord {
  return {
    version: 3,
    id,
    recordedAt,
    checklistId: `checklist-${id}`,
    store: { premiseId: "1", premiseCode: "P1", name: "Store", address: null },
    plannedSubtotalRm: null,
    estimatedRoundTripCostRm: null,
    plannedCombinedTotalRm: null,
    alternativeStoreEstimates: [],
    estimatedSavings: null,
    actualTotalRm: withMissingPrice ? 5 : 7.5,
    lines: [
      {
        id: `priced-${id}`, source: "catalogue", catalogueItemId: "22",
        itemName: "Rice", itemNameEn: "Rice", itemNameMs: "Beras", category: staples,
        packageSize: "1 kg", quantity: 3, actualQuantity: null, quantitySource: "planned",
        unitPriceRm: 2.5, priceSource: "store", observedDate: null, actualPriceRm: null,
        actualLineTotalRm: 7.5, status: "bought",
      },
      ...(withMissingPrice ? [{
        id: `unpriced-${id}`, source: "manual" as const, catalogueItemId: null,
        itemName: "Manual", itemNameEn: null, itemNameMs: null, category: null,
        packageSize: null, quantity: 1, actualQuantity: null, quantitySource: "planned" as const,
        unitPriceRm: null, priceSource: "manual" as const, observedDate: null, actualPriceRm: null,
        actualLineTotalRm: null, status: "bought" as const,
      }] : []),
    ],
  };
}

describe("Statistics view behavior", () => {
  const now = "2026-09-26T12:00:00.000Z";

  it("shows null spending and empty category rows for an empty current period", () => {
    const view = buildStatisticsView([], "weekly", now, "en");
    expect(view.hasCurrentActivity).toBe(false);
    expect(view.hasConfirmedSpending).toBe(false);
    expect(view.analytics.current.actualSpendingRm).toBeNull();
    expect(view.categoryRows).toEqual([]);
    expect(view.hasComparisonActivity).toBe(false);
  });

  it("keeps priced totals while marking partial bought-line data and category rows", () => {
    const view = buildStatisticsView([trip("current", "2026-09-22T03:00:00.000Z", true)], "weekly", now, "ms");
    expect(view.hasCurrentActivity).toBe(true);
    expect(view.hasConfirmedSpending).toBe(true);
    expect(view.hasPartialSpending).toBe(true);
    expect(view.analytics.current.actualSpendingRm).toBe(7.5);
    expect(view.categoryRows).toMatchObject([{ categoryId: "staples", amountRm: 7.5, partial: true, percent: 100 }]);
    expect(view.currentRangeLabel).toContain("21");
  });

  it("groups newer and older catalogue trips by the broad category", () => {
    const current = trip("current", "2026-09-22T03:00:00.000Z");
    current.lines[0].sourceCategory = { id: "BERAS", labelEn: "Rice", labelMs: "Beras" };
    const old = trip("old", "2026-09-23T03:00:00.000Z");
    const view = buildStatisticsView([current, old], "weekly", now, "en");
    expect(view.categoryRows).toEqual([
      { categoryId: "staples", spendingClass: "essential", amountRm: 15, partial: false, percent: 100 },
    ]);
  });

  it("uses explicit inclusive date ranges and identifies a populated comparison period", () => {
    const view = buildStatisticsView([
      trip("current", "2026-09-22T03:00:00.000Z"),
      trip("previous", "2026-09-15T03:00:00.000Z"),
    ], "weekly", now, "en");
    expect(view.currentRangeLabel).toContain("21 Sept 2026");
    expect(view.currentRangeLabel).toContain("27 Sept 2026");
    expect(view.comparisonRangeLabel).toContain("14 Sept 2026");
    expect(view.comparisonRangeLabel).toContain("20 Sept 2026");
    expect(view.hasComparisonActivity).toBe(true);
  });

  it("keeps a no-previous state distinct from an empty current period", () => {
    const view = buildStatisticsView([trip("current", "2026-09-22T03:00:00.000Z")], "monthly", now, "en");
    expect(view.hasCurrentActivity).toBe(true);
    expect(view.hasComparisonActivity).toBe(false);
    expect(view.analytics.previous.tripCount).toBe(0);
    expect(view.comparisonRangeLabel).toContain("1 Aug 2026");
    expect(view.comparisonRangeLabel).toContain("31 Aug 2026");
  });
});
