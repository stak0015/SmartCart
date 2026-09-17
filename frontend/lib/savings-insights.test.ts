import { describe, expect, it } from "vitest";

import type { BasketLineDetail, StoreRecommendation } from "./contracts";
import type { TripRecord } from "./trip-history";
import {
  potentialPriceSavingsInsight,
  savingsInsights,
  tripTravelSavingsInsight,
  travelSavingsInsight,
  type SavingsRouteContext,
  type TravelSavingsInsight,
} from "./savings-insights";

// StoreRecommendation carries many fields that this feature never reads; a
// factory keeps each case focused on the values under test.
const store = (overrides: Partial<StoreRecommendation> = {}): StoreRecommendation => ({
  premiseId: "1",
  premiseCode: "P-1",
  name: "My Store",
  address: "1 Jalan Test",
  district: "Putrajaya",
  state: "Putrajaya",
  straightLineDistanceKm: 1,
  routeDistanceKm: 1.2,
  estimatedTravelMinutes: 5,
  estimatedRoundTripCostRm: 6,
  basketCostRm: 10,
  estimatedTotalCostRm: 16,
  pricedItemCount: 2,
  basketItemCount: 2,
  isCompleteBasket: true,
  basketPrices: [],
  saraStatus: "candidate",
  basketSubtotalRm: 10,
  missingItems: [],
  pricedCount: 2,
  basketLineCount: 2,
  saraCreditRm: 0,
  cashNeededRm: 10,
  priceObservedDaysAgo: 1,
  combinedTotalRm: 16,
  basketLines: [],
  exceedsLimit: false,
  ...overrides,
});

const line = (
  itemId: string,
  lineTotalRm: number | null,
  priceSource?: "store" | "median",
): BasketLineDetail => ({
  itemId,
  itemName: `Item ${itemId}`,
  itemNameEn: null,
  itemNameMs: null,
  unit: "1 kg",
  quantity: 1,
  unitPriceRm: lineTotalRm,
  lineTotalRm,
  observedDate: "2026-09-10",
  priceSource,
});

const google: SavingsRouteContext = { routeProvider: "google", routeWarning: null };
const straightLine: SavingsRouteContext = {
  routeProvider: "straight_line",
  routeWarning: "Distance is a straight-line estimate.",
};

const myStore = store({ premiseId: "1", name: "My Store", estimatedRoundTripCostRm: 8 });

describe("travelSavingsInsight (AC 8.2.1)", () => {
  it("reports the travel cost difference against a cheaper reachable store", () => {
    const cheaper = store({ premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 3 });
    const insight = travelSavingsInsight(myStore, [myStore, cheaper], google);

    expect(insight.kind).toBe("estimate");
    expect(insight.available).toBe(true);
    expect(insight.savingsRm).toBe(5);
    expect(insight.cheaperStoreName).toBe("Cheaper Mart");
    expect(insight.cheaperTravelCostRm).toBe(3);
    expect(insight.routeEstimated).toBe(false);
  });

  it("never invents a saving when my store is already the cheapest", () => {
    const pricier = store({ premiseId: "2", name: "Pricier Mart", estimatedRoundTripCostRm: 12 });
    const insight = travelSavingsInsight(myStore, [myStore, pricier], google);

    expect(insight.available).toBe(false);
    expect(insight.savingsRm).toBeNull();
    expect(insight.reason).toBe("my-store-is-cheapest");
  });

  it("returns no saving rather than RM0 when costs are equal", () => {
    const same = store({ premiseId: "2", name: "Same Cost Mart", estimatedRoundTripCostRm: 8 });
    const insight = travelSavingsInsight(myStore, [myStore, same], google);

    expect(insight.available).toBe(false);
    expect(insight.savingsRm).toBeNull();
  });

  it("excludes stores beyond the travel limit even when they are cheaper", () => {
    const beyond = store({
      premiseId: "2",
      name: "Far Away Mart",
      estimatedRoundTripCostRm: 1,
      exceedsLimit: true,
    });
    const insight = travelSavingsInsight(myStore, [myStore, beyond], google);

    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("no-reachable-alternative");
    expect(insight.cheaperStoreName).toBeNull();
  });

  it("flags the straight-line fallback and carries the route warning", () => {
    const cheaper = store({ premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 3 });
    const insight = travelSavingsInsight(myStore, [myStore, cheaper], straightLine);

    expect(insight.available).toBe(true);
    expect(insight.routeEstimated).toBe(true);
    expect(insight.routeWarning).toBe("Distance is a straight-line estimate.");
  });

  it("picks the cheapest candidate, not merely a cheaper one", () => {
    const mid = store({ premiseId: "2", name: "Mid Mart", estimatedRoundTripCostRm: 6 });
    const low = store({ premiseId: "3", name: "Low Mart", estimatedRoundTripCostRm: 2 });
    const insight = travelSavingsInsight(myStore, [myStore, mid, low], google);

    expect(insight.savingsRm).toBe(6);
    expect(insight.cheaperStoreName).toBe("Low Mart");
  });

  it("rounds the saving to whole sen", () => {
    const cheaper = store({ premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 2.005 });
    const mine = store({ premiseId: "1", name: "My Store", estimatedRoundTripCostRm: 3.004 });
    const insight = travelSavingsInsight(mine, [mine, cheaper], google);

    expect(insight.savingsRm).toBe(1);
  });
});

describe("potentialPriceSavingsInsight (AC 8.2.2)", () => {
  const mine = store({
    premiseId: "1",
    name: "My Store",
    basketLines: [line("10", 10), line("20", 20)],
  });

  it("compares only lines priced at both stores and reports the count", () => {
    // The cheaper store has no price for line 20, so only line 10 is compared.
    const cheaper = store({
      premiseId: "2",
      name: "Cheaper Mart",
      basketLines: [line("10", 6)],
    });
    const insight = potentialPriceSavingsInsight(mine, [mine, cheaper]);

    expect(insight.kind).toBe("potential");
    expect(insight.available).toBe(true);
    expect(insight.savingsRm).toBe(4);
    expect(insight.myComparableSubtotalRm).toBe(10);
    expect(insight.cheaperComparableSubtotalRm).toBe(6);
    expect(insight.comparableLineCount).toBe(1);
    expect(insight.basketLineCount).toBe(2);
  });

  it("picks the single best store, not a per-line mix across stores", () => {
    const a = store({ premiseId: "2", name: "Store A", basketLines: [line("10", 8), line("20", 19)] });
    const b = store({ premiseId: "3", name: "Store B", basketLines: [line("10", 9), line("20", 12)] });
    const insight = potentialPriceSavingsInsight(mine, [mine, a, b]);

    // Store A saves 3 (30 -> 27); Store B saves 9 (30 -> 21). Best single store wins.
    expect(insight.cheaperStoreName).toBe("Store B");
    expect(insight.savingsRm).toBe(9);
    expect(insight.comparableLineCount).toBe(2);
  });

  it("reports no comparable lines when the other store prices nothing in common", () => {
    const disjoint = store({
      premiseId: "2",
      name: "Other Mart",
      basketLines: [line("99", 1)],
    });
    const insight = potentialPriceSavingsInsight(mine, [mine, disjoint]);

    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("no-cheaper-store");
    expect(insight.comparableLineCount).toBe(0);
  });

  it("does not treat my store's missing prices as savings", () => {
    const partialMine = store({
      premiseId: "1",
      name: "My Store",
      basketLines: [line("10", null), line("20", 20)],
    });
    const other = store({
      premiseId: "2",
      name: "Other Mart",
      basketLines: [line("10", 1), line("20", 20)],
    });
    const insight = potentialPriceSavingsInsight(partialMine, [partialMine, other]);

    // Only line 20 is comparable and it costs the same, so nothing is saved.
    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("no-cheaper-store");
  });

  it("excludes stores beyond the travel limit", () => {
    const far = store({
      premiseId: "2",
      name: "Far Mart",
      basketLines: [line("10", 1), line("20", 2)],
      exceedsLimit: true,
    });
    const insight = potentialPriceSavingsInsight(mine, [mine, far]);

    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("no-reachable-alternative");
  });

  it("counts lines priced from the cached median so the UI can disclose it", () => {
    const cheaper = store({
      premiseId: "2",
      name: "Cheaper Mart",
      basketLines: [line("10", 6, "median"), line("20", 18, "store")],
    });
    const insight = potentialPriceSavingsInsight(mine, [mine, cheaper]);

    expect(insight.available).toBe(true);
    expect(insight.medianLineCount).toBe(1);
    expect(insight.comparableLineCount).toBe(2);
  });

  it("returns nothing when my store has no basket lines at all", () => {
    const empty = store({ premiseId: "1", name: "My Store", basketLines: [] });
    const other = store({ premiseId: "2", name: "Other Mart", basketLines: [line("10", 1)] });
    const insight = potentialPriceSavingsInsight(empty, [empty, other]);

    expect(insight.available).toBe(false);
    expect(insight.basketLineCount).toBe(0);
  });
});

describe("savingsInsights (AC 8.2.3)", () => {
  it("kinds are distinct so wording can never blur estimate and potential", () => {
    const cheaper = store({
      premiseId: "2",
      name: "Cheaper Mart",
      estimatedRoundTripCostRm: 3,
      basketLines: [line("10", 5)],
    });
    const mine = store({
      premiseId: "1",
      name: "My Store",
      estimatedRoundTripCostRm: 8,
      basketLines: [line("10", 10)],
    });
    const insights = savingsInsights(mine, [mine, cheaper], google);

    expect(insights.hasAny).toBe(true);
    expect(insights.travel.kind).toBe("estimate");
    expect(insights.price.kind).toBe("potential");
    expect(insights.travel.available).toBe(true);
    expect(insights.price.available).toBe(true);
  });

  it("hasAny is false when neither saving applies", () => {
    const mine = store({ premiseId: "1", name: "My Store", basketLines: [] });
    const insights = savingsInsights(mine, [mine], google);

    expect(insights.hasAny).toBe(false);
    expect(insights.travel.available).toBe(false);
    expect(insights.price.available).toBe(false);
  });

  it("keeps the route caveat on the travel insight when using straight-line distance", () => {
    const cheaper = store({ premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 3 });
    const insights = savingsInsights(myStore, [myStore, cheaper], straightLine);

    expect(insights.travel.routeEstimated).toBe(true);
    expect(insights.travel.routeWarning).not.toBeNull();
  });
});

// AC 8.2.1 from a recorded trip: the estimates frozen by US 5.4 let the saving
// be computed on-device without re-querying recommendations.
const tripRecord = (overrides: Partial<TripRecord> = {}): TripRecord => ({
  version: 2,
  id: "trip-1",
  recordedAt: "2026-09-14T09:00:00.000Z",
  checklistId: "checklist-1",
  store: { premiseId: "1", premiseCode: "P-1", name: "My Store", address: null },
  plannedSubtotalRm: 10,
  estimatedRoundTripCostRm: 6,
  plannedCombinedTotalRm: 16,
  alternativeStoreEstimates: [],
  actualTotalRm: null,
  lines: [],
  ...overrides,
});

describe("tripTravelSavingsInsight (AC 8.2.1, recorded trip)", () => {
  it("reports the saving against the cheapest recorded alternative", () => {
    const record = tripRecord({
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 2, estimatedTotalCostRm: 12 },
        { premiseId: "3", name: "Pricier Mart", estimatedRoundTripCostRm: 4, estimatedTotalCostRm: 14 },
      ],
    });
    const insight = tripTravelSavingsInsight(record);

    expect(insight.kind).toBe("estimate");
    expect(insight.available).toBe(true);
    expect(insight.savingsRm).toBe(4);
    expect(insight.cheaperStoreName).toBe("Cheaper Mart");
    expect(insight.myTravelCostRm).toBe(6);
  });

  it("reports nothing when my store was already the cheapest", () => {
    const record = tripRecord({
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Pricier Mart", estimatedRoundTripCostRm: 9, estimatedTotalCostRm: 19 },
      ],
    });
    const insight = tripTravelSavingsInsight(record);

    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("my-store-is-cheapest");
    expect(insight.savingsRm).toBeNull();
  });

  it("reports nothing when the trip recorded no alternative stores", () => {
    const insight = tripTravelSavingsInsight(tripRecord());

    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("no-alternative-store");
  });

  it("reports nothing when the trip has no recorded travel cost", () => {
    const record = tripRecord({
      estimatedRoundTripCostRm: null,
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 2, estimatedTotalCostRm: 12 },
      ],
    });
    const insight = tripTravelSavingsInsight(record);

    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("no-recorded-travel-cost");
  });

  it("never reports a saving of zero when costs are equal", () => {
    const record = tripRecord({
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Same Cost Mart", estimatedRoundTripCostRm: 6, estimatedTotalCostRm: 16 },
      ],
    });
    const insight = tripTravelSavingsInsight(record);

    expect(insight.available).toBe(false);
    expect(insight.reason).toBe("my-store-is-cheapest");
  });

  it("keeps the straight-line caveat from the frozen record (AC 8.2.3)", () => {
    // The recommendation response is gone by review time, so the caveat must
    // survive in the record itself, not in a caller-supplied context.
    const record = tripRecord({
      routeProvider: "straight_line",
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 2, estimatedTotalCostRm: 12 },
      ],
    });
    const insight = tripTravelSavingsInsight(record);

    expect(insight.available).toBe(true);
    expect(insight.routeEstimated).toBe(true);
  });

  it("treats a google-routed trip as not estimated", () => {
    const record = tripRecord({
      routeProvider: "google",
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 2, estimatedTotalCostRm: 12 },
      ],
    });
    expect(tripTravelSavingsInsight(record).routeEstimated).toBe(false);
  });

  it("falls back to the caller context when a legacy record has no provenance", () => {
    // routeProvider is optional: trips frozen before it existed must still
    // validate and simply defer to the caller's context.
    const record = tripRecord({
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 2, estimatedTotalCostRm: 12 },
      ],
    });
    expect(tripTravelSavingsInsight(record).routeEstimated).toBe(false);
    expect(tripTravelSavingsInsight(record, straightLine).routeEstimated).toBe(true);
  });

  it("returns the same shape as the live insight so one component renders both", () => {
    const record = tripRecord({
      alternativeStoreEstimates: [
        { premiseId: "2", name: "Cheaper Mart", estimatedRoundTripCostRm: 2, estimatedTotalCostRm: 12 },
      ],
    });
    // Structural check: every field the shared TravelSavingsInsight type
    // promises is present, so SavingsInsightsSummary can render a trip insight.
    const insight: TravelSavingsInsight = tripTravelSavingsInsight(record);
    expect(insight).toEqual(expect.objectContaining({
      kind: "estimate",
      available: true,
      savingsRm: 4,
      myStoreName: "My Store",
      cheaperStoreName: "Cheaper Mart",
      routeEstimated: false,
      routeWarning: null,
      reason: "found",
    }));
  });
});
