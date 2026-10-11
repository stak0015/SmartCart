import { describe, expect, it } from "vitest";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { applyBasketReplacement, lowerCostReplacementChoice, undoBasketReplacement } from "./basket-state";
import { editedPlan, planDetailRows, repriceComparisonOptions } from "./plan-detail-edits";
import { calculatePlanEstimatedSavings } from "./estimated-savings";
import { createPlanShoppingChecklist } from "./shopping-checklist";
import type { BasketAlternativeLine } from "./contracts";

const suggestions: BasketAlternativeLine[] = [{
  quantity: 2, source: { ...plan.assignments[0], itemName: "Rice", packageSize: "5 kg", priceObservedDaysAgo: 1,
    saraEligible: true, saraCategoryCandidate: true, isSaraCreditCandidate: true, category: null },
  alternative: { itemId: "3", itemName: "Cheaper rice", unit: "5 kg", packageSize: "5 kg", unitPriceRm: 20,
    lineTotalRm: 40, observedDate: "2026-10-08", priceObservedDaysAgo: 1, priceSource: "store",
    saraEligible: false, saraCategoryCandidate: false, isSaraCreditCandidate: false, category: null },
  savingsRm: 20, packOptions: [],
}];

describe("editable multi-store plans", () => {
  it("recalculates quantities for both stores and preserves route costs and assignments in the checklist", () => {
    const changedBasket = basket.map(item => ({ ...item, qty: item.qty + 1 }));
    const rows = Object.fromEntries(stores.map(store => [store.premiseId, planDetailRows(plan, store, changedBasket)]));
    const changed = editedPlan(plan, rows);
    expect(changed.basketSubtotalRm).toBe(100);
    expect(changed.combinedTotalRm).toBe(103);
    expect(changed.assignments.map(line => line.quantity)).toEqual([3, 2]);
    const checklist = createPlanShoppingChecklist(changed, stores, changedBasket);
    expect(checklist.items.map(line => [line.quantity, line.storePremiseId])).toEqual([[3, "1"], [2, "2"]]);
    expect(checklist.plannedCombinedTotalRm).toBe(103);
    expect(repriceComparisonOptions([{ kind: "plan", plan }], changedBasket)[0]).toMatchObject({ plan: { combinedTotalRm: 103 } });
  });

  it("keeps accepted replacements priced during request failures, supports undo and snapshots the replacement", () => {
    const replacement = lowerCostReplacementChoice(suggestions[0])!;
    const changedBasket = applyBasketReplacement(basket, replacement, { id: "1", name: stores[0].name });
    const riceRows = planDetailRows(plan, stores[0], changedBasket); // API unavailable
    const changed = editedPlan(plan, { "1": riceRows, "2": planDetailRows(plan, stores[1], changedBasket) });
    expect(changed.basketSubtotalRm).toBe(45);
    expect(changed.assignments[0]).toMatchObject({ itemId: "3", quantity: 2, unitPriceRm: 20, storePremiseId: "1" });
    const savings = calculatePlanEstimatedSavings(plan, [{kind: "plan", plan}, {kind: "plan", plan: {...plan, planId: "other", combinedTotalRm: 78}}], "google", changed);
    expect(savings.itemChangeImpactRm).toBe(20);
    expect(savings.netSavingRm).toBe(25);
    const checklist = createPlanShoppingChecklist(changed, stores, changedBasket, {estimatedSavings: savings});
    expect(checklist.items[0]).toMatchObject({ itemName: "Cheaper rice", unitPriceRm: 20, storePremiseId: "1" });
    expect(checklist.estimatedSavings).toEqual(savings);
    const undone = planDetailRows(plan, stores[0], undoBasketReplacement(changedBasket, "db-3"), suggestions);
    expect(undone[0].current).toMatchObject({ itemId: "1", lineTotalRm: 60 });
  });

  it("keeps missing prices unknown and does not apply another store's replacement price", () => {
    const missing = {...plan, assignments: plan.assignments.map(line => ({...line, unitPriceRm: null, lineTotalRm: null}))};
    const rows = Object.fromEntries(stores.map(store => [store.premiseId, planDetailRows(missing, store, basket)]));
    expect(editedPlan(missing, rows)).toMatchObject({basketSubtotalRm: null, combinedTotalRm: null, isComplete: false});
    const changedBasket = applyBasketReplacement(basket, lowerCostReplacementChoice(suggestions[0])!, { id: "2", name: stores[1].name });
    expect(planDetailRows(plan, stores[0], changedBasket)[0].current.unitPriceRm).toBe(30);
  });
});
