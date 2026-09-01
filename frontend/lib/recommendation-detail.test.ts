import { describe, expect, it } from "vitest";

import type { BasketAlternativeLine, StoreRecommendation } from "./contracts";
import {
  applyBasketReplacement,
  lowerCostReplacementChoice,
  packReplacementChoice,
  undoBasketReplacement,
  type BasketItem,
} from "./basket-state";
import {
  buildRecommendationDetailRows,
  recommendationDetailTotals,
  targetAlreadyInBasket,
} from "./recommendation-detail";

const line: BasketAlternativeLine = {
  quantity: 1,
  source: {
    itemId: "1", itemName: "Original oil", unit: "1 kg", packageSize: "1 kg",
    unitPriceRm: 10, lineTotalRm: 10, observedDate: "2026-08-31", priceObservedDaysAgo: 1,
    saraEligible: null, saraCategoryCandidate: true, isSaraCreditCandidate: true,
  },
  alternative: {
    itemId: "2", itemName: "Lower-price oil", unit: "1 kg", packageSize: "1 kg",
    unitPriceRm: 8, lineTotalRm: 8, observedDate: "2026-08-31", priceObservedDaysAgo: 1,
    saraEligible: false, saraCategoryCandidate: false, isSaraCreditCandidate: false,
  },
  savingsRm: 2,
  packOptions: [
    {
      itemId: "3", itemName: "Family oil", packageSize: "3 kg", totalPriceRm: 24,
      pricePerUnitRm: 8, unitKind: "KG", observedDate: "2026-09-01",
      saraEligible: true, saraCategoryCandidate: true, isSaraCreditCandidate: true,
      isBestValue: true,
    },
    {
      itemId: "1", itemName: "Original oil", packageSize: "1 kg", totalPriceRm: 10,
      pricePerUnitRm: 10, unitKind: "KG", observedDate: "2026-08-31",
      saraEligible: null, saraCategoryCandidate: true, isSaraCreditCandidate: true,
      isBestValue: false,
    },
  ],
};

const store: StoreRecommendation = {
  premiseId: "10",
  premiseCode: "P10",
  name: "Test Store",
  address: null,
  district: null,
  state: null,
  straightLineDistanceKm: 1,
  routeDistanceKm: 1.2,
  estimatedTravelMinutes: 5,
  estimatedRoundTripCostRm: 1,
  basketCostRm: 8,
  estimatedTotalCostRm: 9,
  pricedItemCount: 1,
  basketItemCount: 1,
  isCompleteBasket: true,
  basketPrices: [{
    itemId: "2", itemName: "Lower-price oil", packageSize: "1 kg", quantity: 1,
    unitPriceRm: 8, lineTotalRm: 8, priceObservedDate: "2026-08-31",
    saraEligible: false, saraCategoryCandidate: false,
  }],
  saraStatus: "candidate",
  basketSubtotalRm: 8,
  missingItems: [],
  pricedCount: 1,
  basketLineCount: 1,
  saraCreditRm: 0,
  cashNeededRm: 8,
  priceObservedDaysAgo: 1,
  combinedTotalRm: 9,
  basketLines: [{
    itemId: "2", itemName: "Lower-price oil", unit: "1 kg", quantity: 1,
    unitPriceRm: 8, lineTotalRm: 8, observedDate: "2026-08-31",
  }],
};

const originalBasket: BasketItem[] = [{
  id: "db-1", name: "Original oil", size: "1 kg", qty: 1,
  saraEligible: null, saraCategoryCandidate: true,
}];

describe("recommendation detail replacement model", () => {
  it("shows a comparable no-change baseline before any choice", () => {
    const rows = buildRecommendationDetailRows(originalBasket, store, [line]);
    const totals = recommendationDetailTotals(rows);
    expect(totals.hasReplacements).toBe(false);
    expect(totals.savingsComparable).toBe(true);
    expect(totals.originalSubtotalRm).toBe(10);
    expect(totals.currentSubtotalRm).toBe(10);
    expect(totals.netSavingRm).toBe(0);
  });

  it("restores the original row and recommendation immediately after re-entry undo", () => {
    const swapped = applyBasketReplacement(
      originalBasket,
      lowerCostReplacementChoice(line)!,
      { id: "10", name: "Test Store" },
    );
    const reenteredRows = buildRecommendationDetailRows(swapped, store, [line]);
    expect(reenteredRows[0].source.itemId).toBe("1");
    expect(reenteredRows[0].current.itemId).toBe("2");
    expect(reenteredRows[0].replacement?.original.id).toBe("db-1");
    expect(recommendationDetailTotals(reenteredRows).netSavingRm).toBe(2);

    const restored = undoBasketReplacement(swapped, "db-2");
    const restoredRows = buildRecommendationDetailRows(restored, store, [line]);
    expect(restoredRows[0].current.itemId).toBe("1");
    expect(restoredRows[0].alternatives.alternative?.itemId).toBe("2");
    expect(restoredRows[0].replacement).toBeNull();
  });

  it("keeps pack count and reports a higher upfront total", () => {
    const twoPacks = [{ ...originalBasket[0], qty: 2 }];
    const twoPackLine = {
      ...line,
      quantity: 2,
      source: { ...line.source, lineTotalRm: 20 },
      alternative: line.alternative ? { ...line.alternative, lineTotalRm: 16 } : null,
      savingsRm: 4,
    };
    const changed = applyBasketReplacement(
      twoPacks,
      packReplacementChoice(twoPackLine, twoPackLine.packOptions![0])!,
      { id: "10", name: "Test Store" },
    );
    const rows = buildRecommendationDetailRows(changed, store, [twoPackLine]);
    const totals = recommendationDetailTotals(rows);
    expect(changed[0].qty).toBe(2);
    expect(rows[0].current.lineTotalRm).toBe(48);
    expect(totals.originalSubtotalRm).toBe(20);
    expect(totals.netSavingRm).toBe(-28);
    expect(totals.saraCreditRm).toBe(48);
    expect(totals.cashNeededRm).toBe(0);
  });

  it("suppresses a savings claim when the original comparison price is missing", () => {
    const missingSource = { ...line, source: { ...line.source, unitPriceRm: null, lineTotalRm: null } };
    const changed = applyBasketReplacement(
      originalBasket,
      packReplacementChoice(missingSource, missingSource.packOptions![0])!,
      { id: "10", name: "Test Store" },
    );
    const totals = recommendationDetailTotals(buildRecommendationDetailRows(changed, store, [missingSource]));
    expect(totals.hasReplacements).toBe(true);
    expect(totals.savingsComparable).toBe(false);
    expect(totals.netSavingRm).toBeNull();
  });

  it("reports incomplete coverage without presenting a comparable total", () => {
    const missingLine: BasketAlternativeLine = {
      ...line,
      source: {
        ...line.source,
        itemId: "4",
        itemName: "Unpriced rice",
        unitPriceRm: null,
        lineTotalRm: null,
      },
      alternative: null,
      savingsRm: null,
      packOptions: [],
    };
    const rows = buildRecommendationDetailRows(
      [...originalBasket, {
        id: "db-4", name: "Unpriced rice", size: "5 kg", qty: 1,
        saraEligible: true, saraCategoryCandidate: true,
      }],
      store,
      [line, missingLine],
    );
    const totals = recommendationDetailTotals(rows);
    expect(totals.pricedCount).toBe(1);
    expect(totals.lineCount).toBe(2);
    expect(totals.savingsComparable).toBe(false);
    expect(totals.netSavingRm).toBeNull();
  });

  it("detects a target already used by a separate basket line", () => {
    expect(targetAlreadyInBasket([
      ...originalBasket,
      { ...originalBasket[0], id: "db-3", name: "Already selected" },
    ], "1", "3")).toBe(true);
    expect(targetAlreadyInBasket(originalBasket, "1", "1")).toBe(false);
  });
});
