import { describe, expect, it } from "vitest";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { createPlanShoppingChecklist, parseShoppingChecklist, serializeShoppingChecklist, toggleChecklistItemStatus, editChecklistValues, revertChecklistItem } from "./shopping-checklist";
import { buildTripRecord } from "./trip-history";
import { buildChecklistExportModel } from "./checklist-export";

describe("two-store checklist snapshots", () => {
  it("keeps the whole basket, store assignments, estimates, images and trip cost after reload", () => {
    const checklist = createPlanShoppingChecklist(plan, stores, basket, { routeProvider: "straight_line" });
    const restored = parseShoppingChecklist(serializeShoppingChecklist(checklist))!;
    expect(restored).toEqual(checklist);
    expect(restored.stores?.map(store => store.premiseId)).toEqual(["1", "2"]);
    expect(restored.items.map(item => item.storePremiseId)).toEqual(["1", "2"]);
    expect(restored.items[1].priceSource).toBe("median");
    expect(restored.items[0].imageUrl).toBe(basket[0].imageUrl);
    expect(restored.plannedSubtotalRm).toBe(65);
    expect(restored.estimatedRoundTripCostRm).toBe(3);
    expect(restored.plannedCombinedTotalRm).toBe(68);
  });

  it("keeps store assignments through edits, bought status, export and recording", () => {
    const initial = createPlanShoppingChecklist(plan, stores, basket);
    const item = initial.items[1];
    const edited = editChecklistValues(initial, item.id, { itemName: "Milk", quantity: 2, unitPriceRm: 6 })!;
    expect(edited.items[1].storePremiseId).toBe("2");
    const reverted = revertChecklistItem(edited, item.id);
    expect(reverted.items[1].priceSource).toBe("median");
    const bought = toggleChecklistItemStatus(reverted, item.id, "bought");
    const record = buildTripRecord(bought);
    expect(record.actualTotalRm).toBe(5);
    expect(record.estimatedRoundTripCostRm).toBe(3);
    expect(record.lines[1].storePremiseId).toBe("2");
    expect(record.stores?.map(store => store.name)).toEqual(plan.storeNames);
    expect(buildChecklistExportModel(bought, "en").rows[1].name).toContain(stores[1].name);
  });

  it("rejects malformed saved assignment data", () => {
    const checklist = createPlanShoppingChecklist(plan, stores, basket);
    expect(parseShoppingChecklist(JSON.stringify({ ...checklist, stores: [null] }))).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({ ...checklist, items: [{ ...checklist.items[0], storePremiseId: 12 }] }))).toBeNull();
  });
});
