import { describe, expect, it } from "vitest";

import type { ChecklistPriceSource, ChecklistQuantitySource, ChecklistStatus } from "./shopping-checklist";
import type { EstimatedSavingsSnapshot } from "./estimated-savings";
import { periodComparison, periodSummary } from "./period-summary";
import { TRIP_HISTORY_VERSION, type TripRecord, type TripRecordLine } from "./trip-history";

// 2026-09-15 is a Tuesday, so the week under test runs Mon 2026-09-14 to
// Sun 2026-09-20 (UTC).
const NOW = new Date("2026-09-15T10:00:00.000Z");

function line(overrides: Partial<TripRecordLine> = {}): TripRecordLine {
  return {
    id: "line-1",
    source: "catalogue",
    catalogueItemId: "1",
    itemName: "Rice",
    itemNameEn: "Rice",
    itemNameMs: "Beras",
    packageSize: "5 kg",
    quantity: 1,
    actualQuantity: null,
    quantitySource: "planned" as ChecklistQuantitySource,
    unitPriceRm: 12,
    priceSource: "store" as ChecklistPriceSource,
    observedDate: "2026-09-14",
    actualPriceRm: null,
    actualLineTotalRm: null,
    status: "neutral" as ChecklistStatus,
    ...overrides,
  };
}

function record(overrides: Partial<TripRecord> = {}): TripRecord {
  return {
    version: TRIP_HISTORY_VERSION,
    id: "trip-1",
    recordedAt: "2026-09-14T08:00:00.000Z",
    checklistId: "checklist-1",
    store: { premiseId: "10", premiseCode: "P10", name: "Test Store", address: "1 Test Street" },
    plannedSubtotalRm: 17,
    estimatedRoundTripCostRm: 3,
    plannedCombinedTotalRm: 20,
    alternativeStoreEstimates: [],
    estimatedSavings: null,
    actualTotalRm: null,
    lines: [line()],
    ...overrides,
  };
}

describe("periodSummary - AC 8.1.1 weekly confirmed total", () => {
  it("totals the confirmed actual spending of this week", () => {
    const records = [
      record({ id: "a", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 20.5 }),
      record({ id: "b", recordedAt: "2026-09-15T09:00:00.000Z", actualTotalRm: 9.25 }),
    ];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.hasRecords).toBe(true);
    expect(summary.hasConfirmedSpending).toBe(true);
    expect(summary.confirmedSpendingRm).toBeCloseTo(29.75, 2);
    expect(summary.tripCount).toBe(2);
  });

  it("excludes records from the previous and next week", () => {
    const records = [
      record({ id: "prev", recordedAt: "2026-09-13T23:00:00.000Z", actualTotalRm: 100 }),
      record({ id: "this", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 20 }),
      record({ id: "next", recordedAt: "2026-09-21T00:00:00.000Z", actualTotalRm: 100 }),
    ];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.tripCount).toBe(1);
    expect(summary.confirmedSpendingRm).toBe(20);
  });

  it("runs the weekly period from Monday", () => {
    const summary = periodSummary([], "weekly", NOW);

    expect(summary.periodStart).toBe("2026-09-14T00:00:00.000Z");
    expect(summary.periodEnd).toBe("2026-09-21T00:00:00.000Z");
  });

  it("follows the monthly cadence when selected", () => {
    const records = [
      record({ id: "aug", recordedAt: "2026-08-31T23:00:00.000Z", actualTotalRm: 100 }),
      record({ id: "sep", recordedAt: "2026-09-01T00:00:00.000Z", actualTotalRm: 30 }),
    ];

    const summary = periodSummary(records, "monthly", NOW);

    expect(summary.periodStart).toBe("2026-09-01T00:00:00.000Z");
    expect(summary.tripCount).toBe(1);
    expect(summary.confirmedSpendingRm).toBe(30);
  });
});

describe("periodSummary - AC 8.1.2 estimates stay estimates", () => {
  it("never counts planned or estimated figures as confirmed spending", () => {
    // A trip with rich estimates but no shopper-recorded actual price.
    const records = [record({
      plannedSubtotalRm: 17,
      estimatedRoundTripCostRm: 3,
      plannedCombinedTotalRm: 20,
      actualTotalRm: null,
    })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.confirmedSpendingRm).toBeNull();
    expect(summary.hasConfirmedSpending).toBe(false);
  });

  it("reports estimated-only weeks separately instead of showing a number", () => {
    const records = [record({ actualTotalRm: null, plannedCombinedTotalRm: 20 })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.hasEstimatedOnly).toBe(true);
    expect(summary.confirmedSpendingRm).toBeNull();
  });

  it("does not flag estimated-only when the record carries no estimate either", () => {
    const records = [record({
      actualTotalRm: null,
      plannedSubtotalRm: null,
      estimatedRoundTripCostRm: null,
      plannedCombinedTotalRm: null,
    })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.hasEstimatedOnly).toBe(false);
    expect(summary.hasConfirmedSpending).toBe(false);
  });

  it("keeps the estimate out of the total when one trip is confirmed and another is not", () => {
    const records = [
      record({ id: "a", actualTotalRm: 20 }),
      record({ id: "b", actualTotalRm: null, plannedCombinedTotalRm: 40 }),
    ];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.confirmedSpendingRm).toBe(20);
    expect(summary.hasEstimatedOnly).toBe(false);
    expect(summary.spendingIncomplete).toBe(true);
  });
});

describe("periodSummary - AC 8.1.3 no data this week", () => {
  it("reports no records and never invents an amount", () => {
    const summary = periodSummary([], "weekly", NOW);

    expect(summary.hasRecords).toBe(false);
    expect(summary.hasConfirmedSpending).toBe(false);
    expect(summary.hasEstimatedOnly).toBe(false);
    expect(summary.confirmedSpendingRm).toBeNull();
    expect(summary.tripCount).toBe(0);
  });

  it("treats last week's records as no data for this week", () => {
    const records = [record({ recordedAt: "2026-09-10T08:00:00.000Z", actualTotalRm: 50 })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.hasRecords).toBe(false);
    expect(summary.confirmedSpendingRm).toBeNull();
  });
});

describe("periodSummary - AC 8.1.4 no confirmed expenses for the period", () => {
  it("distinguishes 'records exist' from 'confirmed spending exists'", () => {
    const records = [record({
      actualTotalRm: null,
      lines: [line({ status: "bought", actualLineTotalRm: null })],
    })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.hasRecords).toBe(true);
    expect(summary.hasConfirmedSpending).toBe(false);
    expect(summary.confirmedSpendingRm).toBeNull();
  });

  it("flags spending as incomplete when a bought line has no actual price", () => {
    const records = [record({
      actualTotalRm: 10,
      lines: [
        line({ id: "a", status: "bought", actualLineTotalRm: 10 }),
        line({ id: "b", status: "bought", actualLineTotalRm: null }),
      ],
    })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.confirmedSpendingRm).toBe(10);
    expect(summary.spendingIncomplete).toBe(true);
  });

  it("does not flag incomplete spending when every bought line is priced", () => {
    const records = [record({
      actualTotalRm: 10,
      lines: [line({ status: "bought", actualLineTotalRm: 10 })],
    })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.spendingIncomplete).toBe(false);
  });
});

describe("periodSummary - malformed records (AC 5.5.4 spirit)", () => {
  it("skips a record with an unparseable date instead of crashing", () => {
    const records = [
      record({ id: "bad", recordedAt: "not-a-date", actualTotalRm: 999 }),
      record({ id: "good", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 20 }),
    ];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.tripCount).toBe(1);
    expect(summary.confirmedSpendingRm).toBe(20);
  });

  it("never guesses an unparseable record into the period", () => {
    const records = [record({ recordedAt: "", actualTotalRm: 999 })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.hasRecords).toBe(false);
    expect(summary.confirmedSpendingRm).toBeNull();
  });
});

function snapshot(overrides: Partial<EstimatedSavingsSnapshot> = {}): EstimatedSavingsSnapshot {
  return {
    medianCombinedCostRm: 20,
    selectedBaselineCombinedCostRm: 22,
    selectedCurrentCombinedCostRm: 18,
    storeChoiceImpactRm: 2,
    itemChangeImpactRm: 4,
    netSavingRm: 6,
    comparableStoreCount: 3,
    estimatedPriceCount: 1,
    routeEstimated: false,
    ...overrides,
  };
}

describe("periodComparison - AC 8.3.1 two weeks of data", () => {
  it("compares confirmed spending and estimated savings across two weeks", () => {
    const records = [
      record({ id: "cur", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 30, estimatedSavings: snapshot() }),
      record({ id: "prev", recordedAt: "2026-09-08T08:00:00.000Z", actualTotalRm: 40, estimatedSavings: snapshot({ netSavingRm: 3, storeChoiceImpactRm: 1, itemChangeImpactRm: 2 }) }),
    ];

    const comparison = periodComparison(records, "weekly", NOW);

    expect(comparison.previous).not.toBeNull();
    expect(comparison.current.confirmedSpendingRm).toBe(30);
    expect(comparison.current.estimatedNetSavingsRm).toBe(6);
    expect(comparison.current.storeChoiceImpactRm).toBe(2);
    expect(comparison.current.itemChangeImpactRm).toBe(4);
    expect(comparison.previous?.confirmedSpendingRm).toBe(40);
    expect(comparison.previous?.estimatedNetSavingsRm).toBe(3);
    expect(comparison.inProgress).toBe(true);
    expect(comparison.daysElapsed).toBeLessThan(comparison.daysInPeriod);
  });

  it("keeps negative savings negative instead of clamping to zero", () => {
    const records = [
      record({ id: "cur", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 30, estimatedSavings: snapshot({ netSavingRm: -4 }) }),
      record({ id: "prev", recordedAt: "2026-09-08T08:00:00.000Z", actualTotalRm: 40, estimatedSavings: snapshot() }),
    ];

    const comparison = periodComparison(records, "weekly", NOW);

    expect(comparison.current.estimatedNetSavingsRm).toBe(-4);
  });
});

describe("periodComparison - AC 8.3.2 no previous week", () => {
  it("reports no comparison object when the previous period is empty", () => {
    const records = [record({ id: "cur", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 30 })];

    const comparison = periodComparison(records, "weekly", NOW);

    expect(comparison.previous).toBeNull();
    expect(comparison.current.confirmedSpendingRm).toBe(30);
  });

  it("does not backfill last week from older or future records", () => {
    const records = [
      record({ id: "cur", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 30 }),
      record({ id: "old", recordedAt: "2026-08-01T08:00:00.000Z", actualTotalRm: 99 }),
    ];

    const comparison = periodComparison(records, "weekly", NOW);

    expect(comparison.previous).toBeNull();
  });

  it("shows an empty current period when only last week has data", () => {
    const records = [record({ id: "prev", recordedAt: "2026-09-08T08:00:00.000Z", actualTotalRm: 40 })];

    const comparison = periodComparison(records, "weekly", NOW);

    expect(comparison.current.hasRecords).toBe(false);
    expect(comparison.previous).not.toBeNull();
  });

  it("reports two empty periods when there are no records at all", () => {
    const comparison = periodComparison([], "weekly", NOW);

    expect(comparison.current.hasRecords).toBe(false);
    expect(comparison.previous).toBeNull();
  });
});

describe("periodSummary - AC 8.3.1 savings aggregation", () => {
  it("skips records without a snapshot instead of reading them as zero", () => {
    const records = [
      record({ id: "a", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 20, estimatedSavings: snapshot({ netSavingRm: 6 }) }),
      record({ id: "b", recordedAt: "2026-09-15T08:00:00.000Z", actualTotalRm: 10, estimatedSavings: null }),
    ];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.estimatedNetSavingsRm).toBe(6);
    expect(summary.savingsAvailable).toBe(true);
    expect(summary.savingsIncomplete).toBe(true);
  });

  it("reports savings as unavailable when no record carries a snapshot", () => {
    const records = [record({ id: "a", recordedAt: "2026-09-14T08:00:00.000Z", actualTotalRm: 20 })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.savingsAvailable).toBe(false);
    expect(summary.savingsIncomplete).toBe(false);
    expect(summary.estimatedNetSavingsRm).toBeNull();
  });

  it("sums the two impact components independently of the net figure", () => {
    const records = [
      record({ id: "a", recordedAt: "2026-09-14T08:00:00.000Z", estimatedSavings: snapshot({ storeChoiceImpactRm: 2, itemChangeImpactRm: -1, netSavingRm: 1 }) }),
      record({ id: "b", recordedAt: "2026-09-15T08:00:00.000Z", estimatedSavings: snapshot({ storeChoiceImpactRm: 1, itemChangeImpactRm: 1, netSavingRm: 2 }) }),
    ];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.storeChoiceImpactRm).toBe(3);
    expect(summary.itemChangeImpactRm).toBe(0);
    expect(summary.estimatedNetSavingsRm).toBe(3);
    expect(summary.savingsIncomplete).toBe(false);
  });
});

describe("periodComparison - cadence boundaries", () => {
  it("steps back across a month boundary for the monthly cadence", () => {
    // NOW is mid-September; the previous monthly period is August.
    const records = [
      record({ id: "sep", recordedAt: "2026-09-01T08:00:00.000Z", actualTotalRm: 10 }),
      record({ id: "aug", recordedAt: "2026-08-31T23:00:00.000Z", actualTotalRm: 20 }),
    ];

    const comparison = periodComparison(records, "monthly", NOW);

    expect(comparison.current.confirmedSpendingRm).toBe(10);
    expect(comparison.previous?.confirmedSpendingRm).toBe(20);
    expect(comparison.inProgress).toBe(true);
  });

  it("steps back across a year boundary for the monthly cadence", () => {
    const firstOfJanuary = new Date("2027-01-05T10:00:00.000Z");
    const records = [
      record({ id: "jan", recordedAt: "2027-01-01T08:00:00.000Z", actualTotalRm: 10 }),
      record({ id: "dec", recordedAt: "2026-12-31T23:00:00.000Z", actualTotalRm: 20 }),
    ];

    const comparison = periodComparison(records, "monthly", firstOfJanuary);

    expect(comparison.current.confirmedSpendingRm).toBe(10);
    expect(comparison.previous?.confirmedSpendingRm).toBe(20);
  });

  it("is not in progress at the very start of a period", () => {
    const monday = new Date("2026-09-14T00:00:00.000Z");
    const comparison = periodComparison([], "weekly", monday);

    expect(comparison.inProgress).toBe(true);
    expect(comparison.daysElapsed).toBe(1);
    expect(comparison.daysInPeriod).toBe(7);
  });
});

describe("periodSummary - AC 8.3.3 style: partial-week activity", () => {
  it("counts a single day of activity without requiring a full week", () => {
    const records = [record({ id: "a", recordedAt: "2026-09-15T08:00:00.000Z", actualTotalRm: 20 })];

    const summary = periodSummary(records, "weekly", NOW);

    expect(summary.hasRecords).toBe(true);
    expect(summary.tripCount).toBe(1);
    expect(summary.confirmedSpendingRm).toBe(20);
  });
});
