import { describe, expect, it } from "vitest";

import type { BasketAlternativeLine, PackSizeOption } from "./contracts";
import {
  applyBasketReplacement,
  currentReplacementImpactRm,
  lowerCostReplacementChoice,
  packReplacementChoice,
  undoBasketReplacement,
  type BasketItem,
} from "./basket-state";

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

const pack: PackSizeOption = {
  itemId: "3",
  itemName: "Sardines Family Pack 850g",
  packageSize: "850 g",
  totalPriceRm: 12,
  pricePerUnitRm: 14.12,
  unitKind: "KG",
  observedDate: "2026-08-31",
  saraEligible: true,
  saraCategoryCandidate: true,
  isSaraCreditCandidate: true,
  isBestValue: true,
};

describe("basket replacements", () => {
  it("replaces the source, preserves quantity, and records provenance", () => {
    const choice = lowerCostReplacementChoice(suggestion)!;
    const swapped = applyBasketReplacement(basket, choice, { id: "10", name: "Test Store" });
    expect(swapped[0].id).toBe("db-2");
    expect(swapped[0].qty).toBe(2);
    expect(swapped[0].replacement?.original.id).toBe("db-1");
    expect(swapped[0].replacement?.kind).toBe("lower_cost");
    expect(currentReplacementImpactRm(swapped[0])).toBe(6);
  });

  it("restores the original item and quantity on undo", () => {
    const swapped = applyBasketReplacement(basket, lowerCostReplacementChoice(suggestion)!, { id: "10", name: "Test Store" });
    const restored = undoBasketReplacement(swapped, "db-2");
    expect(restored).toEqual(basket);
  });

  it("allows a higher-cost pack, retains pack count, and records a signed impact", () => {
    const choice = packReplacementChoice(suggestion, pack)!;
    const changed = applyBasketReplacement(basket, choice, { id: "10", name: "Test Store" });
    expect(changed[0].id).toBe("db-3");
    expect(changed[0].qty).toBe(2);
    expect(changed[0].replacement?.kind).toBe("pack");
    expect(currentReplacementImpactRm(changed[0])).toBe(-8);
  });

  it("changes an active choice without losing the original baseline", () => {
    const swapped = applyBasketReplacement(basket, lowerCostReplacementChoice(suggestion)!, { id: "10", name: "Test Store" });
    const changed = applyBasketReplacement(swapped, packReplacementChoice(suggestion, pack)!, { id: "10", name: "Test Store" });
    expect(changed[0].id).toBe("db-3");
    expect(changed[0].replacement?.original.id).toBe("db-1");
    expect(undoBasketReplacement(changed, "db-3")).toEqual(basket);
  });

  it("does not create a duplicate target item", () => {
    const withTarget = [...basket, { ...basket[0], id: "db-2", name: "Already selected" }];
    expect(applyBasketReplacement(withTarget, lowerCostReplacementChoice(suggestion)!, { id: "10", name: "Test Store" })).toBe(withTarget);
  });
});
