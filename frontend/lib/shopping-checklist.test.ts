import { describe, expect, it } from "vitest";

import type { StoreRecommendation } from "./contracts";
import type { RecommendationDetailRow } from "./recommendation-detail";
import {
  SHOPPING_CHECKLIST_STORAGE_KEY,
  addManualChecklistItem,
  checklistProgress,
  createShoppingChecklist,
  deleteChecklistItem,
  editChecklistItem,
  parseShoppingChecklist,
  plannedChecklistSubtotal,
  serializeShoppingChecklist,
  toggleChecklistItemStatus,
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
  it("accepts trimmed names, whole quantities 1-99, and positive two-decimal prices", () => {
    expect(validateManualChecklistItem({
      itemName: "  Bread ", quantity: "99", unitPriceRm: "3.40",
    })).toEqual({
      success: true,
      value: { itemName: "Bread", quantity: 99, unitPriceRm: 3.4 },
    });
  });

  it.each([
    { itemName: "", quantity: 1, unitPriceRm: 1 },
    { itemName: "Bread", quantity: 0, unitPriceRm: 1 },
    { itemName: "Bread", quantity: 100, unitPriceRm: 1 },
    { itemName: "Bread", quantity: 1.5, unitPriceRm: 1 },
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

  it("rejects malformed, unsupported, and internally inconsistent storage", () => {
    const checklist = checklistFromDetails();
    expect(parseShoppingChecklist("{bad json")).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({ ...checklist, version: 2 }))).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({
      ...checklist,
      items: [{ ...checklist.items[0], unitPriceRm: null, lineTotalRm: 0 }],
    }))).toBeNull();
    expect(parseShoppingChecklist(JSON.stringify({
      ...checklist,
      items: [{ ...checklist.items[0], source: "manual", priceSource: "median" }],
    }))).toBeNull();
  });
});
