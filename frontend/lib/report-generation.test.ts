import { describe, expect, it } from "vitest";
import type { ItemCategory } from "./contracts";
import { EMPTY_INBOX, parseInboxState } from "./inbox";
import { buildGenerateReportRequest, isGeneratedReport, type GeneratedReport } from "./report-generation";
import type { TripRecord, TripRecordLine } from "./trip-history";

const protein: ItemCategory = { id: "protein", labelEn: "Meat, Seafood & Protein", labelMs: "Daging, Makanan Laut & Protein", spendingClass: "essential" };

function recordLine(id: string, status: TripRecordLine["status"], total: number | null): TripRecordLine {
  return {
    id, source: "catalogue", catalogueItemId: `item-${id}`, itemName: `Item ${id}`, itemNameEn: `Item ${id}`, itemNameMs: `Barang ${id}`,
    category: protein, packageSize: null, quantity: 2, actualQuantity: null, quantitySource: "planned",
    unitPriceRm: 6.5, priceSource: "store", observedDate: null, actualPriceRm: null, actualLineTotalRm: total, status,
  };
}

function record(id: string, recordedAt: string): TripRecord {
  return {
    version: 3, id, recordedAt, checklistId: `c-${id}`,
    store: { premiseId: "p1", premiseCode: "1", name: "  Lotus's Cheras ", address: "Somewhere private" },
    plannedSubtotalRm: 13, estimatedRoundTripCostRm: 3.1, plannedCombinedTotalRm: 16.1,
    alternativeStoreEstimates: [
      { premiseId: "p2", name: "Mydin", estimatedRoundTripCostRm: 3, estimatedTotalCostRm: 15.2 },
      { premiseId: "p3", name: "Jaya", estimatedRoundTripCostRm: 3, estimatedTotalCostRm: 18 },
      { premiseId: "p4", name: "Unknown", estimatedRoundTripCostRm: 3, estimatedTotalCostRm: null },
    ],
    estimatedSavings: null, actualTotalRm: 13,
    lines: [recordLine("a", "bought", 13), recordLine("b", "not_bought", null), recordLine("c", "neutral", null)],
  };
}

const period = {
  id: "weekly:2026-10-04T16:00:00.000Z", cadence: "weekly" as const,
  periodStart: "2026-10-04T16:00:00.000Z", periodEnd: "2026-10-11T16:00:00.000Z",
};

describe("report request builder", () => {
  it("sends eight baseline weeks of trips and nothing older", () => {
    const request = buildGenerateReportRequest([
      record("current", "2026-10-06T03:00:00.000Z"),
      record("eight-weeks-back", "2026-08-11T03:00:00.000Z"),
      record("nine-weeks-back", "2026-08-03T03:00:00.000Z"),
    ], period, "en");
    expect(request.trips.map(trip => trip.recordedAt)).toEqual(["2026-10-06T03:00:00.000Z", "2026-08-11T03:00:00.000Z"]);
  });

  it("adds behaviour context without the store address or route", () => {
    const [trip] = buildGenerateReportRequest([record("current", "2026-10-06T03:00:00.000Z")], period, "ms").trips;
    expect(trip.storeName).toBe("Lotus's Cheras");
    expect(trip.cheapestAlternative).toEqual({ name: "Mydin", estimatedTotalCostRm: 15.2 });
    expect(trip.estimatedRoundTripCostRm).toBe(3.1);
    expect(trip.plannedCombinedTotalRm).toBe(16.1);
    expect(trip.boughtLines).toEqual([expect.objectContaining({ name: "Barang a", itemKey: "item-a", unitPriceRm: 6.5, lineTotalRm: 13 })]);
    expect(trip.skippedLines).toEqual([{ name: "Barang b", itemKey: "item-b" }]);
    expect(JSON.stringify(trip)).not.toContain("Somewhere private");
  });
});

function report(): GeneratedReport {
  return {
    id: period.id, cadence: "weekly", periodStart: period.periodStart, periodEnd: period.periodEnd,
    generatedAt: "2026-10-12T00:00:00.000Z", tripCount: 1, actualSpendingRm: 13, spendingIncomplete: false,
    estimatedNetSavingsRm: null, storeChoiceImpactRm: null, itemChangeImpactRm: null, savingsIncomplete: false,
    categorySpending: [{ categoryId: "protein", spendingClass: "essential", amountRm: 13, partial: false }],
    specificCategorySpending: [], spendingClassBreakdown: [
      { spendingClass: "essential", amountRm: 13 }, { spendingClass: "discretionary", amountRm: 0 }, { spendingClass: "mixed_or_unknown", amountRm: 0 },
    ],
    comparison: null,
    newsletter: {
      subject: "Your weekly shopping report", preview: "Eggs are probably due.", headline: "Eggs are probably due.",
      insights: [{ kind: "items_due", title: "Probably due soon", body: "You usually buy eggs.", action: "Add it to your next basket.", evidence: null }],
    },
    disclosures: [], generationSource: "fallback",
  };
}

describe("report contract", () => {
  it("accepts insight cards and rejects the retired prose shape", () => {
    expect(isGeneratedReport(report())).toBe(true);
    const legacy = { ...report(), newsletter: { subject: "s", preview: "p", opening: "o", insights: [], tip: null } };
    expect(isGeneratedReport(legacy)).toBe(false);
    const unknownKind = report();
    unknownKind.newsletter.insights[0] = { ...unknownKind.newsletter.insights[0], kind: "mystery" as never };
    expect(isGeneratedReport(unknownKind)).toBe(false);
  });

  it("clears v4 prose reports but keeps the cadence preference", () => {
    expect(parseInboxState(JSON.stringify({ version: 4, cadence: "monthly", messages: [{ id: "x" }] })))
      .toEqual({ ...EMPTY_INBOX, cadence: "monthly" });
    const state = { version: 5, cadence: "weekly", messages: [{ ...report(), read: true }] };
    expect(parseInboxState(JSON.stringify(state)).messages).toHaveLength(1);
  });
});
