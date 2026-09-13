import type { StoreRecommendation } from "./contracts";

// AC 8.2.3: the insight kind drives the wording, so a component can never
// relabel a potential saving as money the shopper actually saved. "estimate"
// is a modelled travel figure; "potential" is a price comparison the shopper
// has not acted on yet.
export type SavingsInsightKind = "estimate" | "potential";

// Route metadata travels with the insight so the UI cannot forget the
// straight-line caveat (AC 8.2.3).
export interface SavingsRouteContext {
  routeProvider: "google" | "straight_line";
  routeWarning: string | null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// A cheaper alternative only counts when it is reachable. Stores beyond the
// shopper's chosen travel limit carry exceedsLimit and are returned by the
// ranking only because nothing matched inside the limit; recommending one as
// a saving would be unusable for a household that cannot travel that far.
function isReachable(store: StoreRecommendation): boolean {
  return !store.exceedsLimit;
}

function otherReachableStores(
  myStore: StoreRecommendation,
  stores: StoreRecommendation[],
): StoreRecommendation[] {
  return stores.filter(store => (
    store.premiseId !== myStore.premiseId && isReachable(store)
  ));
}

// AC 8.2.1: estimated travel savings — my store's return travel cost minus a
// cheaper reachable alternative's.
export interface TravelSavingsInsight {
  kind: SavingsInsightKind;
  available: boolean;
  savingsRm: number | null;
  myStoreName: string | null;
  myTravelCostRm: number | null;
  cheaperStoreName: string | null;
  cheaperTravelCostRm: number | null;
  // True when the route came from the straight-line fallback instead of
  // Google Routes. The UI must then surface routeWarning and soften wording.
  routeEstimated: boolean;
  routeWarning: string | null;
  reason: "found" | "my-store-is-cheapest" | "no-reachable-alternative";
}

export function travelSavingsInsight(
  myStore: StoreRecommendation,
  stores: StoreRecommendation[],
  context: SavingsRouteContext,
): TravelSavingsInsight {
  const candidates = otherReachableStores(myStore, stores);
  const routeEstimated = context.routeProvider === "straight_line";

  const unavailable = (
    reason: TravelSavingsInsight["reason"],
  ): TravelSavingsInsight => ({
    kind: "estimate",
    available: false,
    savingsRm: null,
    myStoreName: myStore.name,
    myTravelCostRm: myStore.estimatedRoundTripCostRm,
    cheaperStoreName: null,
    cheaperTravelCostRm: null,
    routeEstimated,
    routeWarning: context.routeWarning,
    reason,
  });

  if (candidates.length === 0) return unavailable("no-reachable-alternative");

  // Strictly cheaper, and first wins ties: the list is already ranked, so the
  // result stays deterministic across renders.
  let cheapest = candidates[0];
  for (const candidate of candidates) {
    if (candidate.estimatedRoundTripCostRm < cheapest.estimatedRoundTripCostRm) {
      cheapest = candidate;
    }
  }

  const savingsRm = money(myStore.estimatedRoundTripCostRm - cheapest.estimatedRoundTripCostRm);
  // Never report a saving of zero: showing "you saved RM0" reads as a result
  // when the real answer is that no cheaper option exists.
  if (savingsRm <= 0) return unavailable("my-store-is-cheapest");

  return {
    kind: "estimate",
    available: true,
    savingsRm,
    myStoreName: myStore.name,
    myTravelCostRm: myStore.estimatedRoundTripCostRm,
    cheaperStoreName: cheapest.name,
    cheaperTravelCostRm: cheapest.estimatedRoundTripCostRm,
    routeEstimated,
    routeWarning: context.routeWarning,
    reason: "found",
  };
}

// Per-line comparison between my store and one candidate. Only lines priced at
// BOTH stores count: a line my store has no price for would otherwise read as
// a saving I never had.
interface ComparableTotals {
  mySubtotalRm: number;
  candidateSubtotalRm: number;
  lineCount: number;
  // Lines whose price came from the cached cross-store median rather than an
  // observation at that store. Surfaced so the UI can disclose that the
  // comparison mixes observed and estimated prices.
  medianLineCount: number;
}

function comparableTotals(
  myStore: StoreRecommendation,
  candidate: StoreRecommendation,
): ComparableTotals | null {
  let mySubtotalRm = 0;
  let candidateSubtotalRm = 0;
  let lineCount = 0;
  let medianLineCount = 0;

  for (const myLine of myStore.basketLines) {
    if (myLine.lineTotalRm == null) continue;
    const otherLine = candidate.basketLines.find(line => (
      line.itemId === myLine.itemId && line.lineTotalRm != null
    ));
    if (!otherLine || otherLine.lineTotalRm == null) continue;

    mySubtotalRm += myLine.lineTotalRm;
    candidateSubtotalRm += otherLine.lineTotalRm;
    lineCount += 1;
    if (myLine.priceSource === "median" || otherLine.priceSource === "median") {
      medianLineCount += 1;
    }
  }

  if (lineCount === 0) return null;
  return {
    mySubtotalRm: money(mySubtotalRm),
    candidateSubtotalRm: money(candidateSubtotalRm),
    lineCount,
    medianLineCount,
  };
}

// AC 8.2.2: potential price savings from lower available prices. Comparison
// basis is the best single store (one trip, achievable), not a per-line
// theoretical minimum across many stores.
export interface PriceSavingsInsight {
  kind: SavingsInsightKind;
  available: boolean;
  savingsRm: number | null;
  myStoreName: string | null;
  cheaperStoreName: string | null;
  myComparableSubtotalRm: number | null;
  cheaperComparableSubtotalRm: number | null;
  // "based on N comparable items" — N of basketLineCount lines were priced at
  // both stores and therefore actually compared.
  comparableLineCount: number;
  basketLineCount: number;
  medianLineCount: number;
  reason: "found" | "no-cheaper-store" | "no-comparable-lines" | "no-reachable-alternative";
}

export function potentialPriceSavingsInsight(
  myStore: StoreRecommendation,
  stores: StoreRecommendation[],
): PriceSavingsInsight {
  const basketLineCount = myStore.basketLines.length;
  const candidates = otherReachableStores(myStore, stores);

  const unavailable = (
    reason: PriceSavingsInsight["reason"],
  ): PriceSavingsInsight => ({
    kind: "potential",
    available: false,
    savingsRm: null,
    myStoreName: myStore.name,
    cheaperStoreName: null,
    myComparableSubtotalRm: null,
    cheaperComparableSubtotalRm: null,
    comparableLineCount: 0,
    basketLineCount,
    medianLineCount: 0,
    reason,
  });

  if (candidates.length === 0) return unavailable("no-reachable-alternative");

  let best: { store: StoreRecommendation; totals: ComparableTotals; savingsRm: number } | null = null;
  for (const candidate of candidates) {
    const totals = comparableTotals(myStore, candidate);
    if (!totals) continue;
    const savingsRm = money(totals.mySubtotalRm - totals.candidateSubtotalRm);
    if (savingsRm <= 0) continue;
    // Strictly greater keeps the first (best-ranked) store on ties.
    if (!best || savingsRm > best.savingsRm) {
      best = { store: candidate, totals, savingsRm };
    }
  }

  if (!best) return unavailable("no-cheaper-store");

  return {
    kind: "potential",
    available: true,
    savingsRm: best.savingsRm,
    myStoreName: myStore.name,
    cheaperStoreName: best.store.name,
    myComparableSubtotalRm: best.totals.mySubtotalRm,
    cheaperComparableSubtotalRm: best.totals.candidateSubtotalRm,
    comparableLineCount: best.totals.lineCount,
    basketLineCount,
    medianLineCount: best.totals.medianLineCount,
    reason: "found",
  };
}

// Both insights together, for a stateless summary component that renders
// whatever it is handed.
export interface SavingsInsights {
  travel: TravelSavingsInsight;
  price: PriceSavingsInsight;
  hasAny: boolean;
}

export function savingsInsights(
  myStore: StoreRecommendation,
  stores: StoreRecommendation[],
  context: SavingsRouteContext,
): SavingsInsights {
  const travel = travelSavingsInsight(myStore, stores, context);
  const price = potentialPriceSavingsInsight(myStore, stores);
  return { travel, price, hasAny: travel.available || price.available };
}
