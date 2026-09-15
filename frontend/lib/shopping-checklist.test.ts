import { describe, expect, it } from "vitest";

import type { StoreRecommendation } from "./contracts";
import type { RecommendationDetailRow } from "./recommendation-detail";
import {
  SHOPPING_CHECKLIST_STORAGE_KEY,
  SHOPPING_CHECKLIST_VERSION,
  actualLineTotalRm,
  addManualChecklistItem,
  checklistProgress,
  createShoppingChecklist,
  deleteChecklistItem,
  editChecklistItem,
  migrateShoppingChecklist,
  parseShoppingChecklist,
  plannedChecklistSubtotal,
  serializeShoppingChecklist,
  setChecklistItemActualPrice,
  setChecklistItemActualQuantity,
  toggleChecklistItemStatus,
  validateActualQuantity,
  validateActualUnitPrice,
  validateManualChecklistItem,
} from "./shopping-checklist";

const store: StoreRecommendation = {
  premiseId: "10",
  premiseCode: "P10",
  name: "Test Store",
  address: "1 Test Street",
  district: "Petaling",
  state: "Selangor",
  straightLineDistanceKm: 1,
  routeDistanceKm: 1.2,
  estimatedTravelMinutes: 5,
  estimatedRoundTripCostRm: 1,
  basketCostRm: 15,
  estimatedTotalCostRm: 16,
  pricedItemCount: 2,
  basketItemCount: 3,
  isCompleteBasket: false,
  basketPrices: [
    {
      itemId: "1",
      itemName: "Cooking oil",
      itemNameEn: "Cooking oil",
      itemNameMs: "Minyak masak",
      packageSize: "1 kg",
      quantity: 2,
      unitPriceRm: 5,
      lineTotalRm: 10,
      priceObservedDate: "2026-09-01",
      priceSource: "store",
    },
    {
      itemId: "2",
      itemName: "Rice",
      itemNameEn: "Rice",
      itemNameMs: "Beras",
      packageSize: "5 kg",
      quantity: 1,
      unitPriceRm: 5,
      lineTotalRm: 5,
      priceObservedDate: "2026-08-30",
      priceSource: "median",
    },
    {
      itemId: "3",
      itemName: "Soap",
      itemNameEn: "Soap",
      itemNameMs: "Sabun",
      packageSize: "3 pack",
      quantity: 1,
      unitPriceRm: null,
      lineTotalRm: null,
      priceObservedDate: null,
      priceSource: null,
    },
  ],
  saraStatus: "candidate",
  basketSubtotalRm: 15,
  missingItems: ["Soap"],
  pricedCount: 2,
  basketLineCount: 3,
  saraCreditRm: 10,
  cashNeededRm: 5,
  priceObservedDaysAgo: 14,
  combinedTotalRm: 16,
  basketLines: [],
  exceedsLimit: false,
};

const details: RecommendationDetailRow[] = [
  {
    source: {
      itemId: "1",
      itemName: "Cooking oil",
      itemNameEn: "Cooking oil",
      itemNameMs: "Minyak masak",
      packageSize: "1 kg",
      quantity: 2,
      unitPriceRm: 5,
      lineTotalRm: 10,
      observedDate: "2026-09-01",
      priceSource: "store",
      saraEligible: true,
      saraCategoryCandidate: true,
      isSaraCreditCandidate: true,
    },
    current: {
      itemId: "4",
      itemName: "Replacement oil",
      itemNameEn: "Replacement oil",
      itemNameMs: "Minyak gantian",
      packageSize: "2 kg",
      quantity: 2,
      unitPriceRm: 4.25,
      lineTotalRm: 8.5,
      observedDate: "2026-09-02",
      priceSource: "store",
      saraEligible: false,
      saraCategoryCandidate: false,
      isSaraCreditCandidate: false,
    },
    alternatives: {
      quantity: 2,
      source: {
        itemId: "1",
        itemName: "Cooking oil",
        itemNameEn: "Cooking oil",
        itemNameMs: "Minyak masak",
        unit: "1 kg",
        packageSize: "1 kg",
        unitPriceRm: 5,
        lineTotalRm: 10,
        observedDate: "2026-09-01",
        priceObservedDaysAgo: 1,
        saraEligible: true,
        saraCategoryCandidate: true,
        isSaraCreditCandidate: true,
      },
      alternative: null,
      savingsRm: null,
    },
    basketItem: null,
    replacement: null,
  },
  {
    source: {
      itemId: "2",
      itemName: "Rice",
      itemNameEn: "Rice",
      itemNameMs: "Beras",
      packageSize: "5 kg",
      quantity: 1,
      unitPriceRm: null,
      lineTotalRm: null,
      observedDate: null,
      priceSource: null,
      saraEligible: null,
      saraCategoryCandidate: true,
      isSaraCreditCandidate: true,
    },
    current: {
      itemId: "2",
      itemName: "Rice",
      itemNameEn: "Rice",
      itemNameMs: "Beras",
      packageSize: "5 kg",
      quantity: 1,
      unitPriceRm: 12,
      lineTotalRm: 12,
      observedDate: "2026-08-30",
      priceSource: "median",
      saraEligible: null,
      saraCategoryCandidate: true,
      isSaraCreditCandidate: true,
    },
    alternatives: {
      quantity: 1,
      source: {
        itemId: "2",
        itemName: "Rice",
        itemNameEn: "Rice",
        itemNameMs: "Beras",
        unit: "5 kg",
        packageSize: "5 kg",
        unitPriceRm: null,
        lineTotalRm: null,
        observedDate: null,
        priceObservedDaysAgo: null,
        saraEligible: null,
        saraCategoryCandidate: true,
        isSaraCreditCandidate: true,
      },
      alternative: null,
      savingsRm: null,
    },
    basketItem: null,
    replacement: null,
  },
];

function checklistFromDetails() {
  return createShoppingChecklist(store, details, {
    checklistId: "checklist-1",
    createdAt: "2026-09-13T00:00:00.000Z",
  });
}

describe("shopping checklist snapshots", () => {
  it("uses replacement-aware rows and preserves their order and bilingual fields", () => {
    const checklist = checklistFromDetails();

    expect(checklist.store).toEqual({
      premiseId: "10",
      premiseCode: "P10",
      name: "Test Store",
      address: "1 Test Street",
    });
    expect(checklist.items.map(item => item.catalogueItemId)).toEqual(["4", "2"]);
    expect(checklist.items[0]).toMatchObject({
      itemName: "Replacement oil",
      itemNameEn: "Replacement oil",
      itemNameMs: "Minyak gantian",
      packageSize: "2 kg",
      quantity: 2,
      unitPriceRm: 4.25,
      lineTotalRm: 8.5,
      priceSource: "store",
      status: "neutral",
    });
    expect(checklist.items[1].priceSource).toBe("median");
    expect(plannedChecklistSubtotal(checklist)).toBe(20.5);
  });

  it("falls back to store basket prices and keeps unavailable prices explicit", () => {
    const checklist = createShoppingChecklist(store, [], {
      checklistId: "checklist-2",
      createdAt: "2026-09-13T00:00:00.000Z",
    });

    expect(checklist.items.map(item => item.itemName)).toEqual(["Cooking oil", "Rice", "Soap"]);
    expect(checklist.items[1].priceSource).toBe("median");
    expect(checklist.items[2]).toMatchObject({
      unitPriceRm: null,
      lineTotalRm: null,
      priceSource: null,
    });
    expect(plannedChecklistSubtotal(checklist)).toBe(15);
  });

  it("keeps planned totals on the persisted snapshot (AC 5.1.1)", () => {
    const checklist = checklistFromDetails();

    expect(checklist.plannedSubtotalRm).toBe(15);
    expect(checklist.estimatedRoundTripCostRm).toBe(1);
    expect(checklist.plannedCombinedTotalRm).toBe(16);
  });

  it("stores null planned totals when the recommendation has no priced lines", () => {
    const unpriced: StoreRecommendation = {
      ...store,
      basketSubtotalRm: null,
      estimatedTotalCostRm: null,
    };
    const checklist = createShoppingChecklist(unpriced, [], {
      checklistId: "checklist-3",
      createdAt: "2026-09-13T00:00:00.000Z",
    });

    expect(checklist.plannedSubtotalRm).toBeNull();
    expect(checklist.estimatedRoundTripCostRm).toBe(1);
    expect(checklist.plannedCombinedTotalRm).toBeNull();
  });
});

describe("shopping checklist mutations", () => {
  it("toggles bought and not-bought states and counts completed rows", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought", "2026-09-13T01:00:00.000Z");
    const notBought = toggleChecklistItemStatus(bought, bought.items[1].id, "not_bought", "2026-09-13T02:00:00.000Z");

    expect(checklistProgress(notBought)).toEqual({
      total: 2,
      completed: 1,
      bought: 1,
      notBought: 1,
      neutral: 0,
      percent: 50,
    });
    const neutralAgain = toggleChecklistItemStatus(notBought, notBought.items[0].id, "bought");
    expect(neutralAgain.items[0].status).toBe("neutral");
    expect(checklistProgress(neutralAgain).completed).toBe(0);
  });

  it("keeps purchased and not-purchased mutually exclusive (AC 5.2.2)", () => {
    const initial = checklistFromDetails();
    const itemId = initial.items[0].id;

    const bought = toggleChecklistItemStatus(initial, itemId, "bought");
    expect(bought.items[0].status).toBe("bought");

    const notBought = toggleChecklistItemStatus(bought, itemId, "not_bought");
    expect(notBought.items[0].status).toBe("not_bought");
    expect(checklistProgress(notBought)).toMatchObject({
      bought: 0,
      notBought: 1,
      neutral: 1,
      completed: 0,
    });

    const backToBought = toggleChecklistItemStatus(notBought, itemId, "bought");
    expect(backToBought.items[0].status).toBe("bought");

    const cleared = toggleChecklistItemStatus(backToBought, itemId, "bought");
    expect(cleared.items[0].status).toBe("neutral");
  });

  it("degrades legacy out-of-stock statuses to not bought on read", () => {
    const initial = checklistFromDetails();
    const legacy = JSON.parse(serializeShoppingChecklist(initial)) as {
      items: { status: string }[];
    };
    legacy.items[0].status = "out_of_stock";
    const migrated = parseShoppingChecklist(JSON.stringify(legacy));
    expect(migrated).not.toBeNull();
    expect(migrated?.items[0].status).toBe("not_bought");
  });

  it("adds, edits, and deletes manual rows while preserving their status", () => {
    const initial = checklistFromDetails();
    const added = addManualChecklistItem(initial, {
      itemName: "  Fresh lime  ",
      quantity: "3",
      unitPriceRm: "1.25",
    }, { itemId: "manual-1", updatedAt: "2026-09-13T01:00:00.000Z" })!;

    expect(added.items.at(-1)).toMatchObject({
      id: "manual-1",
      source: "manual",
      itemName: "Fresh lime",
      quantity: 3,
      unitPriceRm: 1.25,
      lineTotalRm: 3.75,
      priceSource: "manual",
      status: "neutral",
    });
    const marked = toggleChecklistItemStatus(added, "manual-1", "bought");
    const edited = editChecklistItem(marked, "manual-1", {
      itemName: "Limes",
      quantity: 2,
      unitPriceRm: 1.1,
    })!;
    expect(edited.items.at(-1)).toMatchObject({
      itemName: "Limes",
      quantity: 2,
      lineTotalRm: 2.2,
      status: "bought",
    });
    expect(plannedChecklistSubtotal(edited)).toBe(22.7);
    expect(deleteChecklistItem(edited, "manual-1").items).toHaveLength(2);
  });

  it("edits catalogue rows into custom prices and allows deleting them", () => {
    const checklist = checklistFromDetails();
    const item = checklist.items[0];
    const edited = editChecklistItem(checklist, item.id, {
      itemName: "Changed",
      quantity: 3,
      unitPriceRm: 2.5,
    }, "2026-09-13T02:00:00.000Z");
    expect(edited?.items[0]).toMatchObject({
      source: "manual",
      catalogueItemId: null,
      itemName: "Changed",
      itemNameEn: null,
      itemNameMs: null,
      packageSize: item.packageSize,
      quantity: 3,
      unitPriceRm: 2.5,
      lineTotalRm: 7.5,
      priceSource: "manual",
      observedDate: null,
      status: item.status,
    });
    expect(edited?.updatedAt).toBe("2026-09-13T02:00:00.000Z");

    const deleted = deleteChecklistItem(checklist, item.id, "2026-09-13T03:00:00.000Z");
    expect(deleted.items).toHaveLength(checklist.items.length - 1);
    expect(deleted.items.some(candidate => candidate.id === item.id)).toBe(false);
    expect(deleted.updatedAt).toBe("2026-09-13T03:00:00.000Z");
  });
});

describe("manual item validation", () => {
  it("accepts trimmed names, any positive whole quantity, and positive two-decimal prices", () => {
    expect(validateManualChecklistItem({
      itemName: "  Bread ", quantity: "99", unitPriceRm: "3.40",
    })).toEqual({
      success: true,
      value: { itemName: "Bread", quantity: 99, unitPriceRm: 3.4 },
    });
    expect(validateManualChecklistItem({
      itemName: "Bread", quantity: "120", unitPriceRm: "3.40",
    })).toEqual({
      success: true,
      value: { itemName: "Bread", quantity: 120, unitPriceRm: 3.4 },
    });
  });

  it("accepts a blank price as unknown and stores a null line total", () => {
    expect(validateManualChecklistItem({
      itemName: "Bread", quantity: "2", unitPriceRm: "",
    })).toEqual({
      success: true,
      value: { itemName: "Bread", quantity: 2, unitPriceRm: null },
    });
    expect(validateManualChecklistItem({
      itemName: "Bread", quantity: "2", unitPriceRm: "   ",
    })).toEqual({
      success: true,
      value: { itemName: "Bread", quantity: 2, unitPriceRm: null },
    });

    const checklist = checklistFromDetails();
    const added = addManualChecklistItem(checklist, {
      itemName: "Mystery item", quantity: "2", unitPriceRm: "",
    }, { itemId: "manual-blank", updatedAt: "2026-09-13T01:00:00.000Z" })!;
    expect(added.items.at(-1)).toMatchObject({
      unitPriceRm: null,
      lineTotalRm: null,
      priceSource: "manual",
    });
    expect(parseShoppingChecklist(serializeShoppingChecklist(added))).toEqual(added);
  });

  it.each([
    { itemName: "", quantity: 1, unitPriceRm: 1 },
    { itemName: "Bread", quantity: 0, unitPriceRm: 1 },
    { itemName: "Bread", quantity: 1.5, unitPriceRm: 1 },
    { itemName: "Bread", quantity: -3, unitPriceRm: 1 },
    { itemName: "Bread", quantity: "abc", unitPriceRm: 1 },
    { itemName: "Bread", quantity: 1, unitPriceRm: 0 },
    { itemName: "Bread", quantity: 1, unitPriceRm: "1.234" },
    { itemName: "Bread", quantity: 1, unitPriceRm: Number.POSITIVE_INFINITY },
  ])("rejects invalid input %#", input => {
    expect(validateManualChecklistItem(input).success).toBe(false);
  });
});

describe("shopping checklist persistence", () => {
  it("round-trips a valid versioned checklist", () => {
    const checklist = checklistFromDetails();
    expect(SHOPPING_CHECKLIST_STORAGE_KEY).toContain("v1");
    expect(parseShoppingChecklist(serializeShoppingChecklist(checklist))).toEqual(checklist);
  });

  it("migrates legacy v1 payloads written before the planned-total and actual-price fields", () => {
    const checklist = checklistFromDetails();
    const legacy = JSON.parse(serializeShoppingChecklist(checklist)) as Record<string, unknown>;
    legacy.version = 1;
    delete legacy.plannedSubtotalRm;
    delete legacy.estimatedRoundTripCostRm;
    delete legacy.plannedCombinedTotalRm;
    legacy.items = (legacy.items as Record<string, unknown>[]).map(item => {
      const copy = { ...item };
      delete copy.actualPriceRm;
      delete copy.actualQuantity;
      delete copy.quantitySource;
      return copy;
    });

    const migrated = parseShoppingChecklist(JSON.stringify(legacy));
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(SHOPPING_CHECKLIST_VERSION);
    expect(migrated?.plannedSubtotalRm).toBeNull();
    expect(migrated?.estimatedRoundTripCostRm).toBeNull();
    expect(migrated?.plannedCombinedTotalRm).toBeNull();
    expect(migrated?.items).toEqual(checklist.items);
    expect(migrated?.store).toEqual(checklist.store);
  });

  it("drops unknown versions and non-object payloads without throwing", () => {
    const checklist = checklistFromDetails();
    expect(migrateShoppingChecklist(null)).toBeNull();
    expect(migrateShoppingChecklist("checklist")).toBeNull();
    expect(migrateShoppingChecklist({ ...checklist, version: 99 })).toBeNull();
    expect(migrateShoppingChecklist({ ...checklist, version: 0 })).toBeNull();
  });

  it("rejects malformed, unsupported, and internally inconsistent storage", () => {
    const checklist = checklistFromDetails();
    expect(parseShoppingChecklist("{bad json")).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({ ...checklist, version: 99 }))).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({
      ...checklist,
      items: [{ ...checklist.items[0], unitPriceRm: null, lineTotalRm: 0 }],
    }))).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({
      ...checklist,
      items: [{ ...checklist.items[0], source: "manual", priceSource: "median" }],
    }))).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({
      ...checklist,
      items: [{ ...checklist.items[0], actualPriceRm: 0 }],
    }))).toBeNull();
  });
});

describe("actual price recording (AC 5.3.1-5.3.3)", () => {
  it("validates actual prices: blank clears, positive two-decimal accepted, bad rejected", () => {
    expect(validateActualUnitPrice("")).toEqual({ success: true, value: null });
    expect(validateActualUnitPrice("   ")).toEqual({ success: true, value: null });
    expect(validateActualUnitPrice("3.4")).toEqual({ success: true, value: 3.4 });
    expect(validateActualUnitPrice("2.55")).toEqual({ success: true, value: 2.55 });
    expect(validateActualUnitPrice("0").success).toBe(false);
    expect(validateActualUnitPrice("-1").success).toBe(false);
    expect(validateActualUnitPrice("1.234").success).toBe(false);
    expect(validateActualUnitPrice("abc").success).toBe(false);
  });

  it("records and clears the actual price only on purchased lines (AC 5.3.1)", () => {
    const initial = checklistFromDetails();
    const itemId = initial.items[0].id;

    // Neutral lines and unknown ids reject the write.
    expect(setChecklistItemActualPrice(initial, itemId, 4)).toBeNull();
    expect(setChecklistItemActualPrice(initial, "missing", 4)).toBeNull();

    const bought = toggleChecklistItemStatus(initial, itemId, "bought", "2026-09-13T01:00:00.000Z");
    const recorded = setChecklistItemActualPrice(bought, itemId, 3.789, "2026-09-13T02:00:00.000Z")!;
    expect(recorded.items[0].actualPriceRm).toBe(3.79);
    expect(recorded.updatedAt).toBe("2026-09-13T02:00:00.000Z");
    // The original checklist is untouched (immutable update).
    expect(initial.items[0].actualPriceRm).toBeNull();

    const cleared = setChecklistItemActualPrice(recorded, itemId, null)!;
    expect(cleared.items[0].actualPriceRm).toBeNull();

    // Non-positive and non-finite values are rejected.
    expect(setChecklistItemActualPrice(bought, itemId, 0)).toBeNull();
    expect(setChecklistItemActualPrice(bought, itemId, -2)).toBeNull();
    expect(setChecklistItemActualPrice(bought, itemId, Number.NaN)).toBeNull();
  });

  it("recalculates the actual line total immediately and stays empty when unknown (AC 5.3.3)", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought");
    const recorded = setChecklistItemActualPrice(bought, initial.items[0].id, 3.5)!;

    // items[0] quantity is 2 → 3.50 × 2 = 7.00
    expect(actualLineTotalRm(recorded.items[0])).toBe(7);
    expect(actualLineTotalRm(bought.items[0])).toBeNull();
    expect(actualLineTotalRm(recorded.items[0])).not.toBe(0);
  });

  it("keeps the actual price separate from official and planned figures (AC 5.3.2)", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought");
    const recorded = setChecklistItemActualPrice(bought, initial.items[0].id, 3.5)!;
    const line = recorded.items[0];

    expect(line.unitPriceRm).toBe(4.25);
    expect(line.lineTotalRm).toBe(8.5);
    expect(line.priceSource).toBe("store");
    expect(line.observedDate).toBe("2026-09-02");
    expect(recorded.plannedSubtotalRm).toBe(15);
    expect(recorded.plannedCombinedTotalRm).toBe(16);
    expect(recorded.store).toEqual(initial.store);
  });

  it("keeps the recorded price when the line leaves the bought state", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought");
    const recorded = setChecklistItemActualPrice(bought, initial.items[0].id, 3.5)!;
    const unmarked = toggleChecklistItemStatus(recorded, initial.items[0].id, "bought");
    expect(unmarked.items[0].status).toBe("neutral");
    expect(unmarked.items[0].actualPriceRm).toBe(3.5);
  });

  it("persists actual prices through serialization and upgrades v1 lines with null", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought");
    const recorded = setChecklistItemActualPrice(bought, initial.items[0].id, 3.5)!;
    expect(parseShoppingChecklist(serializeShoppingChecklist(recorded))).toEqual(recorded);

    const legacy = JSON.parse(serializeShoppingChecklist(recorded)) as Record<string, unknown>;
    legacy.version = 1;
    legacy.items = (legacy.items as Record<string, unknown>[]).map(item => {
      const copy = { ...item };
      delete copy.actualPriceRm;
      delete copy.actualQuantity;
      delete copy.quantitySource;
      return copy;
    });
    const migrated = parseShoppingChecklist(JSON.stringify(legacy));
    expect(migrated).not.toBeNull();
    expect(migrated?.items.every(item => item.actualPriceRm === null)).toBe(true);
  });
});

describe("actual quantity recording (AC 5.3.4)", () => {
  it("validates actual quantities: blank means planned, positive whole numbers accepted", () => {
    expect(validateActualQuantity("")).toEqual({ success: true, value: null });
    expect(validateActualQuantity("  ")).toEqual({ success: true, value: null });
    expect(validateActualQuantity("3")).toEqual({ success: true, value: 3 });
    expect(validateActualQuantity("120")).toEqual({ success: true, value: 120 });
    expect(validateActualQuantity("0").success).toBe(false);
    expect(validateActualQuantity("1.5").success).toBe(false);
    expect(validateActualQuantity("-2").success).toBe(false);
    expect(validateActualQuantity("abc").success).toBe(false);
  });

  it("records and clears the actual quantity only on purchased lines, marking the source", () => {
    const initial = checklistFromDetails();
    const itemId = initial.items[0].id;

    // Neutral lines and unknown ids reject the write.
    expect(setChecklistItemActualQuantity(initial, itemId, 3)).toBeNull();
    expect(setChecklistItemActualQuantity(initial, "missing", 3)).toBeNull();

    const bought = toggleChecklistItemStatus(initial, itemId, "bought");
    const recorded = setChecklistItemActualQuantity(bought, itemId, 3, "2026-09-13T03:00:00.000Z")!;
    expect(recorded.items[0].actualQuantity).toBe(3);
    expect(recorded.items[0].quantitySource).toBe("actual");
    // The planned quantity is untouched.
    expect(recorded.items[0].quantity).toBe(2);
    // The original checklist is untouched (immutable update).
    expect(initial.items[0].actualQuantity).toBeNull();

    const cleared = setChecklistItemActualQuantity(recorded, itemId, null)!;
    expect(cleared.items[0].actualQuantity).toBeNull();
    expect(cleared.items[0].quantitySource).toBe("planned");

    // Non-whole and non-positive values are rejected.
    expect(setChecklistItemActualQuantity(bought, itemId, 0)).toBeNull();
    expect(setChecklistItemActualQuantity(bought, itemId, 1.5)).toBeNull();
  });

  it("recalculates the actual line total with the actual quantity", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought");
    const priced = setChecklistItemActualPrice(bought, initial.items[0].id, 3.5)!;
    // planned quantity is 2 → 3.50 × 2 = 7.00
    expect(actualLineTotalRm(priced.items[0])).toBe(7);

    const withQty = setChecklistItemActualQuantity(priced, initial.items[0].id, 3)!;
    // actual quantity 3 → 3.50 × 3 = 10.50
    expect(actualLineTotalRm(withQty.items[0])).toBe(10.5);
    // Planned figures stay untouched.
    expect(withQty.items[0].lineTotalRm).toBe(8.5);
    expect(withQty.plannedSubtotalRm).toBe(15);
  });

  it("serializes actual quantities and upgrades v2 and v1 payloads in the chain", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought");
    const priced = setChecklistItemActualPrice(bought, initial.items[0].id, 3.5)!;
    const withQty = setChecklistItemActualQuantity(priced, initial.items[0].id, 3)!;
    expect(parseShoppingChecklist(serializeShoppingChecklist(withQty))).toEqual(withQty);

    // v2 payload: carries actualPriceRm but lacks the quantity fields.
    const v2 = JSON.parse(serializeShoppingChecklist(withQty)) as Record<string, unknown>;
    v2.version = 2;
    v2.items = (v2.items as Record<string, unknown>[]).map(item => {
      const copy = { ...item };
      delete copy.actualQuantity;
      delete copy.quantitySource;
      return copy;
    });
    const fromV2 = parseShoppingChecklist(JSON.stringify(v2));
    expect(fromV2).not.toBeNull();
    expect(fromV2?.version).toBe(SHOPPING_CHECKLIST_VERSION);
    expect(fromV2?.items[0].actualPriceRm).toBe(3.5);
    expect(fromV2?.items[0].actualQuantity).toBeNull();
    expect(fromV2?.items[0].quantitySource).toBe("planned");

    // v1 payload: lacks all three actual-entry fields entirely.
    // Annotated explicitly: spreading an index-signature-only Record into an
    // object literal drops the index signature under TS inference, which would
    // otherwise make `v1.items` an error (TS2339).
    const v1: Record<string, unknown> = { ...v2, version: 1 };
    v1.items = (v2.items as Record<string, unknown>[]).map(item => {
      const copy = { ...item };
      delete copy.actualPriceRm;
      return copy;
    });
    const fromV1 = parseShoppingChecklist(JSON.stringify(v1));
    expect(fromV1).not.toBeNull();
    expect(fromV1?.items.every(item => item.actualPriceRm === null
      && item.actualQuantity === null
      && item.quantitySource === "planned")).toBe(true);
  });

  it("rejects payloads whose quantity source disagrees with the actual quantity", () => {
    const initial = checklistFromDetails();
    const bought = toggleChecklistItemStatus(initial, initial.items[0].id, "bought");
    const withQty = setChecklistItemActualQuantity(bought, initial.items[0].id, 3)!;

    const mislabelled = JSON.parse(serializeShoppingChecklist(withQty)) as Record<string, unknown>;
    (mislabelled.items as Record<string, unknown>[])[0].quantitySource = "planned";
    expect(parseShoppingChecklist(JSON.stringify(mislabelled))).toBeNull();

    const missingQty = JSON.parse(serializeShoppingChecklist(withQty)) as Record<string, unknown>;
    (missingQty.items as Record<string, unknown>[])[0].actualQuantity = null;
    expect(parseShoppingChecklist(JSON.stringify(missingQty))).toBeNull();
  });
});

describe("alternative store estimates snapshot (gap G4)", () => {
  const altA: StoreRecommendation = {
    ...store,
    premiseId: "20",
    premiseCode: "P20",
    name: "Alt Store A",
    estimatedRoundTripCostRm: 2.345,
    estimatedTotalCostRm: 17.895,
  };
  const altB: StoreRecommendation = {
    ...store,
    premiseId: "30",
    premiseCode: "P30",
    name: "Alt Store B",
    estimatedRoundTripCostRm: 4,
    estimatedTotalCostRm: null,
  };

  it("saves alternative stores' estimated trip costs, excluding the selected store", () => {
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-alt",
      createdAt: "2026-09-14T00:00:00.000Z",
      alternativeStores: [store, altA, altB],
    });

    expect(checklist.alternativeStoreEstimates).toEqual([
      {
        premiseId: "20",
        name: "Alt Store A",
        estimatedRoundTripCostRm: 2.35,
        estimatedTotalCostRm: 17.9,
      },
      {
        premiseId: "30",
        name: "Alt Store B",
        estimatedRoundTripCostRm: 4,
        estimatedTotalCostRm: null,
      },
    ]);
    expect(
      checklist.alternativeStoreEstimates.some(estimate => estimate.premiseId === store.premiseId),
    ).toBe(false);
  });

  it("defaults to an empty list when no alternatives are given", () => {
    expect(checklistFromDetails().alternativeStoreEstimates).toEqual([]);
  });

  it("migrates v3 payloads written before the alternative-store-estimates field", () => {
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-legacy3",
      createdAt: "2026-09-14T00:00:00.000Z",
      alternativeStores: [altA],
    });
    const legacy = JSON.parse(serializeShoppingChecklist(checklist)) as Record<string, unknown>;
    legacy.version = 3;
    delete legacy.alternativeStoreEstimates;

    const migrated = parseShoppingChecklist(JSON.stringify(legacy));
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(SHOPPING_CHECKLIST_VERSION);
    expect(migrated?.alternativeStoreEstimates).toEqual([]);
    expect(migrated?.items).toEqual(checklist.items);
  });

  it("round-trips the estimates and rejects malformed entries", () => {
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-alt-rt",
      createdAt: "2026-09-14T00:00:00.000Z",
      alternativeStores: [altA],
    });
    expect(parseShoppingChecklist(serializeShoppingChecklist(checklist))).toEqual(checklist);

    const malformed = JSON.parse(serializeShoppingChecklist(checklist)) as Record<string, unknown>;
    malformed.alternativeStoreEstimates = [{ premiseId: "20" }];
    expect(parseShoppingChecklist(JSON.stringify(malformed))).toBeNull();

    const notArray = JSON.parse(serializeShoppingChecklist(checklist)) as Record<string, unknown>;
    notArray.alternativeStoreEstimates = "nope";
    expect(parseShoppingChecklist(JSON.stringify(notArray))).toBeNull();
  });
});

describe("route provenance (AC 8.2.3)", () => {
  // Local fixture: the altA/altB fixtures above are scoped to their own
  // describe block, so this block defines its own rather than reaching in.
  const alt: StoreRecommendation = {
    ...store,
    premiseId: "20",
    premiseCode: "P20",
    name: "Alt Store A",
    estimatedRoundTripCostRm: 2.345,
    estimatedTotalCostRm: 17.895,
  };

  it("freezes the route provider passed at creation", () => {
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-route",
      createdAt: "2026-09-14T00:00:00.000Z",
      alternativeStores: [alt],
      routeProvider: "straight_line",
    });
    expect(checklist.routeProvider).toBe("straight_line");
  });

  it("survives a localStorage round trip so an old trip keeps its caveat", () => {
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-route-rt",
      createdAt: "2026-09-14T00:00:00.000Z",
      alternativeStores: [alt],
      routeProvider: "google",
    });
    const restored = parseShoppingChecklist(serializeShoppingChecklist(checklist));
    expect(restored).toEqual(checklist);
    expect(restored?.routeProvider).toBe("google");
  });

  it("omits the field entirely when the caller does not know it", () => {
    // Legacy compatibility: serialised output must be unchanged for callers
    // that predate AC 8.2.3, so the key is absent rather than null.
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-noroute",
      createdAt: "2026-09-14T00:00:00.000Z",
    });
    expect(checklist.routeProvider).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(checklist, "routeProvider")).toBe(false);
    expect(serializeShoppingChecklist(checklist)).not.toContain("routeProvider");
  });

  it("migrates a v3 payload that predates the field without inventing one", () => {
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-route-legacy",
      createdAt: "2026-09-14T00:00:00.000Z",
      alternativeStores: [alt],
      routeProvider: "google",
    });
    const legacy = JSON.parse(serializeShoppingChecklist(checklist)) as Record<string, unknown>;
    legacy.version = 3;
    delete legacy.routeProvider;
    delete legacy.alternativeStoreEstimates;

    const migrated = parseShoppingChecklist(JSON.stringify(legacy));
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(SHOPPING_CHECKLIST_VERSION);
    expect(migrated?.routeProvider).toBeUndefined();
    expect(migrated?.items).toEqual(checklist.items);
  });

  it("rejects a corrupt provider instead of silently trusting it", () => {
    const checklist = createShoppingChecklist(store, details, {
      checklistId: "checklist-route-bad",
      createdAt: "2026-09-14T00:00:00.000Z",
      routeProvider: "google",
    });
    const corrupt = JSON.parse(serializeShoppingChecklist(checklist)) as Record<string, unknown>;
    corrupt.routeProvider = "telepathy";
    expect(parseShoppingChecklist(JSON.stringify(corrupt))).toBeNull();
  });
});
