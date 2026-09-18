import { describe, expect, it } from "vitest";
import { addNextTripItem, nextTripBasket, parseNextTrip, saveForNextTrip, serializeNextTrip } from "./next-trip";
import {
  SHOPPING_CHECKLIST_VERSION, addManualChecklistItem, editChecklistValues, parseShoppingChecklist,
  revertChecklistItem, serializeShoppingChecklist, type ChecklistItem, type ShoppingChecklist,
} from "./shopping-checklist";
import { buildTripRecord, parseTripHistory, serializeTripHistory } from "./trip-history";

const item: ChecklistItem = {
  id: "line-1", source: "catalogue", catalogueItemId: "1", itemName: "Rice",
  itemNameEn: "Rice", itemNameMs: "Beras", packageSize: "5 kg", quantity: 2,
  unitPriceRm: 10, lineTotalRm: 20, actualPriceRm: null, actualQuantity: null,
  quantitySource: "planned", priceSource: "store", observedDate: "2026-09-18", status: "not_bought",
  originalValues: {
    itemName: "Rice", itemNameEn: "Rice", itemNameMs: "Beras", quantity: 2,
    unitPriceRm: 10, priceSource: "store", observedDate: "2026-09-18",
  },
};
const checklist: ShoppingChecklist = {
  version: SHOPPING_CHECKLIST_VERSION, id: "trip-1",
  store: { premiseId: "1", premiseCode: "P1", name: "Store one", address: null },
  createdAt: "2026-09-18T00:00:00.000Z", updatedAt: "2026-09-18T00:00:00.000Z",
  plannedSubtotalRm: 20, estimatedRoundTripCostRm: null, plannedCombinedTotalRm: null,
  alternativeStoreEstimates: [], items: [item],
};

describe("next trip carry-over", () => {
  it("keeps unbought and unchecked items once, independently of the checklist", () => {
    const saved = saveForNextTrip([], item);
    expect(saveForNextTrip(saved, { ...item, quantity: 3 })).toHaveLength(1);
    expect(saveForNextTrip(saved, { ...item, quantity: 3 })[0].quantity).toBe(3);
    expect(saveForNextTrip([], { ...item, status: "neutral" })).toHaveLength(1);
    expect(saveForNextTrip([], { ...item, status: "bought" })).toEqual([]);
    expect(parseNextTrip(serializeNextTrip(saved))).toEqual(saved);
    expect(serializeNextTrip(saved)).not.toMatch(/price|store|address|status|originalValues/i);
    expect(item.status).toBe("not_bought");
  });

  it("rejects corrupt saved entries individually and deduplicates stored IDs", () => {
    const saved = saveForNextTrip([], item);
    const encoded = JSON.stringify({ version: 1, items: [null, {}, { ...saved[0], quantity: -1 }, ...saved, ...saved] });
    expect(parseNextTrip(encoded)).toEqual(saved);
    expect(parseNextTrip("broken")).toEqual([]);
    expect(parseNextTrip('{"version":20,"items":[]}')).toEqual([]);
  });

  it("uses unknown prices in a different checklist instead of an old store quote", () => {
    const saved = saveForNextTrip([], item)[0];
    const next = addNextTripItem({ ...checklist, id: "trip-2", items: [] }, saved);
    expect(next.items[0]).toMatchObject({ catalogueItemId: "1", quantity: 2, status: "neutral", unitPriceRm: null, lineTotalRm: null });
    expect(parseShoppingChecklist(serializeShoppingChecklist(next))).toEqual(next);
  });

  it("uses the selected store quote or the median estimate returned by the price lookup", () => {
    const saved = saveForNextTrip([], item)[0];
    const storePriced = addNextTripItem({ ...checklist, id: "trip-store", items: [] }, saved, {
      itemName: "Rice at this store",
      itemNameEn: "Rice at this store",
      itemNameMs: "Beras di kedai ini",
      packageSize: "5 kg",
      unitPriceRm: 11.25,
      observedDate: "2026-09-18",
      priceSource: "store",
    });
    expect(storePriced.items[0]).toMatchObject({
      itemName: "Rice at this store",
      unitPriceRm: 11.25,
      lineTotalRm: 22.5,
      priceSource: "store",
      observedDate: "2026-09-18",
    });

    const medianPriced = addNextTripItem({ ...checklist, id: "trip-median", items: [] }, saved, {
      unitPriceRm: 9.5,
      observedDate: null,
      priceSource: "median",
    });
    expect(medianPriced.items[0]).toMatchObject({ unitPriceRm: 9.5, lineTotalRm: 19, priceSource: "median", observedDate: null });
  });

  it("refreshes a saved existing line with the new store quote", () => {
    const saved = saveForNextTrip([], item)[0];
    const refreshed = addNextTripItem(checklist, saved, {
      unitPriceRm: 12,
      observedDate: "2026-09-19",
      priceSource: "store",
    });
    expect(refreshed.items[0]).toMatchObject({
      status: "neutral", quantity: 2, unitPriceRm: 12, lineTotalRm: 24,
      priceSource: "store", observedDate: "2026-09-19",
    });
    expect(refreshed.items[0].originalValues).toMatchObject({ unitPriceRm: 12, observedDate: "2026-09-19" });
  });

  it("preserves the current store quote and does not duplicate items already planned or bought", () => {
    const saved = saveForNextTrip([], item)[0];
    const next = addNextTripItem(checklist, saved);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toMatchObject({ unitPriceRm: 10, status: "neutral" });
    expect(addNextTripItem(next, saved)).toBe(next);
    const purchased = { ...next, items: [{ ...next.items[0], status: "bought" as const }] };
    expect(addNextTripItem(purchased, saved)).toBe(purchased);
  });

  it("carries manual items too, without inventing catalogue matches or stock", () => {
    const manual = addManualChecklistItem({ ...checklist, items: [] }, { itemName: "Bread", quantity: 1, unitPriceRm: 4 })!;
    const saved = saveForNextTrip([], manual.items[0]);
    expect(nextTripBasket([], saved)).toEqual([]);
    const restored = addNextTripItem({ ...checklist, items: [] }, saved[0]);
    expect(restored.items[0]).toMatchObject({ source: "manual", catalogueItemId: null, unitPriceRm: null });
    expect(parseShoppingChecklist(serializeShoppingChecklist(restored))).toEqual(restored);
  });

  it("reuses catalogue identities for planning and merges existing quantities without inflating them", () => {
    const saved = saveForNextTrip([], item);
    const basket = nextTripBasket([], saved);
    expect(basket[0]).toMatchObject({ id: "db-1", qty: 2, saraEligible: null });
    expect(nextTripBasket(basket, saved)).toEqual(basket);
    expect(nextTripBasket([{ ...basket[0], qty: 5 }], saved)[0].qty).toBe(5);
  });
});

describe("unified checklist editing and history", () => {
  it("saves a single edited price and quantity, preserves identity and freezes the recorded total", () => {
    const bought = { ...checklist, items: [{ ...item, status: "bought" as const }] };
    const edited = editChecklistValues(bought, item.id, { itemName: "Rice", quantity: 3, unitPriceRm: "12.50" })!;
    expect(edited.items[0]).toMatchObject({ source: "catalogue", catalogueItemId: "1", quantity: 3, unitPriceRm: 12.5, lineTotalRm: 37.5, actualPriceRm: null });
    expect(parseShoppingChecklist(serializeShoppingChecklist(edited))).toEqual(edited);
    const record = buildTripRecord(edited);
    expect(record.actualTotalRm).toBe(37.5);
    expect(parseTripHistory(serializeTripHistory([record]))[0].actualTotalRm).toBe(37.5);
    expect(revertChecklistItem(edited, item.id).items[0]).toMatchObject({ quantity: 2, unitPriceRm: 10, lineTotalRm: 20, priceSource: "store", status: "bought" });
    expect(record.actualTotalRm).toBe(37.5);
    expect(edited.plannedSubtotalRm).toBe(20);
  });

  it("restores reference provenance through individual field reverts and rejects invalid edits atomically", () => {
    const edited = editChecklistValues(checklist, item.id, { itemName: "Rice", quantity: 3, unitPriceRm: 12 })!;
    const restoredPrice = editChecklistValues(edited, item.id, { itemName: "Rice", quantity: 3, unitPriceRm: 10 })!;
    expect(restoredPrice.items[0]).toMatchObject({ quantity: 3, priceSource: "store", observedDate: "2026-09-18" });
    expect(editChecklistValues(edited, item.id, { itemName: "Changed", quantity: -1, unitPriceRm: 9 })).toBeNull();
    expect(edited.items[0].itemName).toBe("Rice");
  });
});
