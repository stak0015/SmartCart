import { describe, expect, it } from "vitest";

import type { BasketAlternativeLine } from "./contracts";
import { applyBasketSwap, currentSwapSavingRm, undoBasketSwap, type BasketItem } from "./basket-state";

const basket: BasketItem[] = [{
  id: "db-1",
  name: "Sardines 425g",
  size: "425 g",
  qty: 2,
  saraEligible: null,
  saraCategoryCandidate: true,
}];

const suggestion: BasketAlternativeLine = {
  quantity: 2,
  source: {
    itemId: "1", itemName: "Sardines 425g", unit: "425 g", packageSize: "425 g",
    unitPriceRm: 8, lineTotalRm: 16, observedDate: "2026-08-31", priceObservedDaysAgo: 0,
    saraEligible: null, saraCategoryCandidate: true, isSaraCreditCandidate: true,
  },
  alternative: {
    itemId: "2", itemName: "Sardines Value 425g", unit: "425 g", packageSize: "425 g",
    unitPriceRm: 5, lineTotalRm: 10, observedDate: "2026-08-31", priceObservedDaysAgo: 0,
    saraEligible: null, saraCategoryCandidate: true, isSaraCreditCandidate: true,
  },
  savingsRm: 6,
};

describe("basket swaps", () => {
  it("replaces the source, preserves quantity, and records provenance", () => {
    const swapped = applyBasketSwap(basket, suggestion, { id: "10", name: "Test Store" });
    expect(swapped[0].id).toBe("db-2");
    expect(swapped[0].qty).toBe(2);
    expect(swapped[0].swap?.original.id).toBe("db-1");
    expect(currentSwapSavingRm(swapped[0])).toBe(6);
  });

  it("restores the original item and quantity on undo", () => {
    const swapped = applyBasketSwap(basket, suggestion, { id: "10", name: "Test Store" });
    const restored = undoBasketSwap(swapped, "db-2");
    expect(restored).toEqual(basket);
  });

  it("does not create a duplicate target item", () => {
    const withTarget = [...basket, { ...basket[0], id: "db-2", name: "Already selected" }];
    expect(applyBasketSwap(withTarget, suggestion, { id: "10", name: "Test Store" })).toBe(withTarget);
  });
});
