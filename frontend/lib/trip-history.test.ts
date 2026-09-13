import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { StoreRecommendation } from "./contracts";
import {
  SHOPPING_CHECKLIST_STORAGE_KEY,
  addManualChecklistItem,
  createShoppingChecklist,
  setChecklistItemActualPrice,
  setChecklistItemActualQuantity,
  toggleChecklistItemStatus,
} from "./shopping-checklist";
import {
  TRIP_HISTORY_STORAGE_KEY,
  addTripRecord,
  actualExpenseTotal,
  buildTripRecord,
  isTripRecord,
  listTripRecords,
  parseTripHistory,
  serializeTripHistory,
} from "./trip-history";

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
  estimatedRoundTripCostRm: 3,
  basketCostRm: 17,
  estimatedTotalCostRm: 20,
  pricedItemCount: 2,
  basketItemCount: 4,
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
      unitPriceRm: 12,
      lineTotalRm: 12,
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
    {
      itemId: "4",
      itemName: "Bread",
      itemNameEn: "Bread",
      itemNameMs: "Roti",
      packageSize: "400 g",
      quantity: 1,
      unitPriceRm: 2.5,
      lineTotalRm: 2.5,
      priceObservedDate: "2026-09-01",
      priceSource: "store",
    },
  ],
  saraStatus: "candidate",
  basketSubtotalRm: 24.5,
  missingItems: ["Soap"],
  pricedCount: 3,
  basketLineCount: 4,
  saraCreditRm: 10,
  cashNeededRm: 14.5,
  priceObservedDaysAgo: 14,
  combinedTotalRm: 27.5,
  basketLines: [],
  exceedsLimit: false,
};

/**
 * Builds a realistic finished-trip checklist:
 * - Cooking oil: bought, actual price 4.50 and actual quantity 3 → 13.50
 * - Rice: not bought (median reference price must not leak into the total)
 * - Soap: not bought, no price
 * - Bread: left neutral (unfinished when the trip was recorded)
 * - Snack (custom, typed price): bought, actual price 2.00 → 2.00
 * - Mystery (custom, no price): bought, no actual price → known total null
 */
function finishedChecklist() {
  let checklist = createShoppingChecklist(store, [], {
    checklistId: "checklist-trip",
    createdAt: "2026-09-14T08:00:00.000Z",
    alternativeStores: [
      { ...store, premiseId: "20", premiseCode: "P20", name: "Alt Store", estimatedRoundTripCostRm: 5, estimatedTotalCostRm: 30 },
    ],
  });
  checklist = addManualChecklistItem(checklist, {
    itemName: "Snack",
    quantity: 1,
    unitPriceRm: 2,
  }, { itemId: "manual-snack" })!;
  checklist = addManualChecklistItem(checklist, {
    itemName: "Mystery item",
    quantity: 1,
    unitPriceRm: null,
  }, { itemId: "manual-mystery" })!;

  const [oil, rice, soap, , snack, mystery] = checklist.items.map(item => item.id);
  checklist = toggleChecklistItemStatus(checklist, oil, "bought")!;
  checklist = setChecklistItemActualPrice(checklist, oil, 4.5)!;
  checklist = setChecklistItemActualQuantity(checklist, oil, 3)!;
  checklist = toggleChecklistItemStatus(checklist, rice, "not_bought")!;
  checklist = toggleChecklistItemStatus(checklist, soap, "not_bought")!;
  checklist = toggleChecklistItemStatus(checklist, snack, "bought")!;
  checklist = setChecklistItemActualPrice(checklist, snack, 2)!;
  checklist = toggleChecklistItemStatus(checklist, mystery, "bought")!;
  return checklist;
}

describe("buildTripRecord (AC 5.4.1)", () => {
  it("keeps the date and time, store, and every catalogue and custom line with its outcome", () => {
    const checklist = finishedChecklist();
    const record = buildTripRecord(checklist, {
      recordId: "trip-1",
      recordedAt: "2026-09-14T10:30:00.000Z",
    });

    expect(record.version).toBe(1);
    expect(record.id).toBe("trip-1");
    expect(record.recordedAt).toBe("2026-09-14T10:30:00.000Z");
    expect(record.checklistId).toBe("checklist-trip");
    expect(record.store).toEqual({
      premiseId: "10",
      premiseCode: "P10",
      name: "Test Store",
      address: "1 Test Street",
    });
    expect(record.lines.map(line => line.itemName)).toEqual([
      "Cooking oil",
      "Rice",
      "Soap",
      "Bread",
      "Snack",
      "Mystery item",
    ]);
    expect(record.lines.map(line => line.status)).toEqual([
      "bought",
      "not_bought",
      "not_bought",
      "neutral",
      "bought",
      "bought",
    ]);
  });

  it("keeps actual quantity with its planned/actual source label and actual prices and line totals", () => {
    const record = buildTripRecord(finishedChecklist(), { recordId: "trip-2" });
    const [oil, , , , snack, mystery] = record.lines;

    expect(oil).toMatchObject({
      quantity: 2,
      actualQuantity: 3,
      quantitySource: "actual",
      unitPriceRm: 5,
      priceSource: "store",
      actualPriceRm: 4.5,
      actualLineTotalRm: 13.5,
    });
    expect(snack).toMatchObject({
      actualQuantity: null,
      quantitySource: "planned",
      actualPriceRm: 2,
      actualLineTotalRm: 2,
    });
    // Unknown actual price → line total stays empty, never 0 (AC 5.3.3).
    expect(mystery.actualPriceRm).toBeNull();
    expect(mystery.actualLineTotalRm).toBeNull();
  });

  it("keeps custom lines shopper-added with the typed name, never matched to an official item", () => {
    const record = buildTripRecord(finishedChecklist(), { recordId: "trip-3" });
    const customLines = record.lines.filter(line => line.source === "manual");

    expect(customLines.map(line => line.itemName)).toEqual(["Snack", "Mystery item"]);
    for (const line of customLines) {
      expect(line.catalogueItemId).toBeNull();
      expect(line.priceSource).toBe("manual");
    }
  });

  it("never mutates the checklist being recorded", () => {
    const checklist = finishedChecklist();
    const snapshotJson = JSON.stringify(checklist);
    buildTripRecord(checklist, { recordId: "trip-4" });
    expect(JSON.stringify(checklist)).toBe(snapshotJson);
  });
});

describe("actualExpenseTotal (AC 5.4.2)", () => {
  it("sums only the known purchased line totals", () => {
    const record = buildTripRecord(finishedChecklist(), { recordId: "trip-5" });
    // 13.50 (oil) + 2.00 (snack); rice (not bought), soap (not bought),
    // bread (unfinished) and mystery (unknown price) are all excluded.
    expect(record.actualTotalRm).toBe(15.5);
  });

  it("excludes reference-price lines unless the shopper recorded an actual price", () => {
    const record = buildTripRecord(finishedChecklist(), { recordId: "trip-6" });
    const rice = record.lines.find(line => line.itemName === "Rice")!;
    // The median reference price (RM12) stays visible but is excluded.
    expect(rice.priceSource).toBe("median");
    expect(rice.unitPriceRm).toBe(12);
    expect(rice.actualLineTotalRm).toBeNull();
    expect(actualExpenseTotal(record.lines)).toBe(15.5);
  });

  it("keeps the estimated transport as planned metadata, never counted as spending", () => {
    const record = buildTripRecord(finishedChecklist(), { recordId: "trip-7" });
    expect(record.estimatedRoundTripCostRm).toBe(3);
    expect(record.plannedSubtotalRm).toBe(24.5);
    expect(record.plannedCombinedTotalRm).toBe(20);
    expect(record.actualTotalRm).toBe(15.5);
    expect(record.alternativeStoreEstimates).toEqual([
      { premiseId: "20", name: "Alt Store", estimatedRoundTripCostRm: 5, estimatedTotalCostRm: 30 },
    ]);
  });

  it("returns null — never a made-up zero — when no purchased line total is known", () => {
    const empty = createShoppingChecklist(store, [], {
      checklistId: "checklist-empty",
      createdAt: "2026-09-14T08:00:00.000Z",
    });
    const record = buildTripRecord(empty, { recordId: "trip-8" });
    expect(record.actualTotalRm).toBeNull();
    expect(actualExpenseTotal([])).toBeNull();
  });
});

describe("trip history persistence (AC 5.4.3 / AC 5.5.4)", () => {
  it("uses its own storage key, separate from the checklist key", () => {
    expect(TRIP_HISTORY_STORAGE_KEY).not.toBe(SHOPPING_CHECKLIST_STORAGE_KEY);
    expect(TRIP_HISTORY_STORAGE_KEY).toBe("smartcart.trip-history.v1");
  });

  it("prepends new records and lists newest first", () => {
    const older = buildTripRecord(finishedChecklist(), {
      recordId: "trip-old",
      recordedAt: "2026-09-13T10:00:00.000Z",
    });
    const newer = buildTripRecord(finishedChecklist(), {
      recordId: "trip-new",
      recordedAt: "2026-09-14T10:00:00.000Z",
    });
    const records = addTripRecord([older], newer);
    expect(records.map(record => record.id)).toEqual(["trip-new", "trip-old"]);
    expect(listTripRecords([older, newer]).map(record => record.id)).toEqual([
      "trip-new",
      "trip-old",
    ]);
  });

  it("round-trips a versioned history through serialization", () => {
    const record = buildTripRecord(finishedChecklist(), {
      recordId: "trip-rt",
      recordedAt: "2026-09-14T10:30:00.000Z",
    });
    expect(parseTripHistory(serializeTripHistory([record]))).toEqual([record]);
  });

  it("ignores malformed or unknown-version records individually without throwing", () => {
    const good = buildTripRecord(finishedChecklist(), {
      recordId: "trip-good",
      recordedAt: "2026-09-14T10:30:00.000Z",
    });
    const goodJson = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
    const unknownVersion = { ...goodJson, id: "trip-v99", version: 99 };
    const corrupted = { ...goodJson, id: "trip-bad", actualTotalRm: "lots" };
    const envelope = {
      version: 1,
      records: [goodJson, unknownVersion, corrupted, "junk"],
    };

    const parsed = parseTripHistory(JSON.stringify(envelope));
    expect(parsed.map(record => record.id)).toEqual(["trip-good"]);
    expect(isTripRecord(unknownVersion)).toBe(false);
  });

  it("degrades legacy out-of-stock line statuses to not bought on read", () => {
    const record = buildTripRecord(finishedChecklist(), {
      recordId: "trip-legacy",
      recordedAt: "2026-09-14T10:30:00.000Z",
    });
    const legacyJson = JSON.parse(JSON.stringify(record)) as {
      lines: { status: string }[];
    };
    legacyJson.lines[0].status = "out_of_stock";
    const envelope = { version: 1, records: [legacyJson] };

    const parsed = parseTripHistory(JSON.stringify(envelope));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].lines[0].status).toBe("not_bought");
  });

  it("returns an empty history for broken payloads, never crashing", () => {
    expect(parseTripHistory("{bad json")).toEqual([]);
    expect(parseTripHistory(null)).toEqual([]);
    expect(parseTripHistory(JSON.stringify({ version: 99, records: [] }))).toEqual([]);
    expect(parseTripHistory(JSON.stringify({ records: "nope" }))).toEqual([]);
  });
});

describe("device-local privacy (AC 5.4.3)", () => {
  it("the trip-history module references no network or API facilities", () => {
    const source = readFileSync(new URL("./trip-history.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket/);
    expect(source).not.toMatch(/api-client|api-base|from "\.\/api/);
  });
});
