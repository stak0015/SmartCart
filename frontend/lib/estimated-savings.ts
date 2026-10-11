import type { PricedPlan, StoreRecommendation } from "./contracts";
import type { StorePlanOption } from "./multi-store";

export interface EstimatedSavingsSnapshot {
  medianCombinedCostRm: number | null;
  selectedBaselineCombinedCostRm: number | null;
  selectedCurrentCombinedCostRm: number | null;
  storeChoiceImpactRm: number | null;
  itemChangeImpactRm: number | null;
  netSavingRm: number | null;
  comparableStoreCount: number;
  estimatedPriceCount: number;
  routeEstimated: boolean;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pricedLineSignature(store: StoreRecommendation): string {
  return (store.basketLines.length ? store.basketLines : store.basketPrices)
    .filter(line => line.lineTotalRm != null)
    .map(line => line.itemId)
    .sort()
    .join("|");
}

function combinedTotal(store: StoreRecommendation): number | null {
  return store.combinedTotalRm ?? store.estimatedTotalCostRm;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Compare the same priced basket across the single/multi options shown to the shopper. */
function comparisonCosts(options: StorePlanOption[], signature: string): number[] {
  return options.flatMap(option => {
    const lines = option.kind === "store" ? (option.store.basketLines.length ? option.store.basketLines : option.store.basketPrices) : option.plan.assignments;
    const cost = option.kind === "store" ? combinedTotal(option.store) : option.plan.combinedTotalRm;
    const candidateSignature = lines.filter(line => line.lineTotalRm != null).map(line => line.itemId).sort().join("|");
    if (!signature || candidateSignature !== signature || cost == null || !Number.isFinite(cost)
      || (option.kind === "store" && option.store.exceedsLimit)) return [];
    return [cost];
  });
}

export function calculatePlanEstimatedSavings(plan: PricedPlan, options: StorePlanOption[], routeProvider: "google" | "straight_line", currentPlan = plan): EstimatedSavingsSnapshot {
  const signature = plan.assignments.filter(line => line.lineTotalRm != null).map(line => line.itemId).sort().join("|");
  const costs = comparisonCosts(options, signature);
  const baseline = costs.length >= 2 ? money(median(costs)) : null;
  const impact = baseline != null && plan.combinedTotalRm != null ? money(baseline - plan.combinedTotalRm) : null;
  const itemImpact = plan.combinedTotalRm != null && currentPlan.combinedTotalRm != null ? money(plan.combinedTotalRm - currentPlan.combinedTotalRm) : null;
  const net = baseline != null && currentPlan.combinedTotalRm != null ? money(baseline - currentPlan.combinedTotalRm) : itemImpact;
  return {
    medianCombinedCostRm: baseline, selectedBaselineCombinedCostRm: plan.combinedTotalRm,
    selectedCurrentCombinedCostRm: currentPlan.combinedTotalRm, storeChoiceImpactRm: impact,
    itemChangeImpactRm: itemImpact, netSavingRm: net, comparableStoreCount: costs.length,
    estimatedPriceCount: plan.assignments.filter(line => line.priceSource === "median").length,
    routeEstimated: routeProvider === "straight_line",
  };
}

export function calculateEstimatedSavings(
  selectedStore: StoreRecommendation,
  recommendations: StoreRecommendation[],
  originalSubtotalRm: number | null,
  currentSubtotalRm: number | null,
  routeProvider: "google" | "straight_line",
  comparisonOptions?: StorePlanOption[],
): EstimatedSavingsSnapshot {
  const selectedBaselineCombinedCostRm = originalSubtotalRm == null
    ? combinedTotal(selectedStore)
    : originalSubtotalRm + selectedStore.estimatedRoundTripCostRm;
  const selectedCurrentCombinedCostRm = currentSubtotalRm == null
    ? null
    : currentSubtotalRm + selectedStore.estimatedRoundTripCostRm;
  const selectedSignature = pricedLineSignature(selectedStore);

  const allRecommendations = recommendations.some(store => store.premiseId === selectedStore.premiseId)
    ? recommendations
    : [selectedStore, ...recommendations];
  const comparableStores = allRecommendations.filter(store => (
    !store.exceedsLimit
    && combinedTotal(store) != null
    && pricedLineSignature(store) === selectedSignature
  ));
  const comparableTotals = comparisonOptions ? comparisonCosts(comparisonOptions, selectedSignature) : comparableStores
    .map(combinedTotal)
    .filter((value): value is number => value != null);
  const medianCombinedCostRm = comparableTotals.length >= 2
    ? median(comparableTotals)
    : null;

  const rawItemChange = selectedBaselineCombinedCostRm != null && selectedCurrentCombinedCostRm != null
    ? selectedBaselineCombinedCostRm - selectedCurrentCombinedCostRm
    : null;
  const rawStoreChoice = medianCombinedCostRm != null && selectedBaselineCombinedCostRm != null
    ? medianCombinedCostRm - selectedBaselineCombinedCostRm
    : null;
  const rawNetSaving = medianCombinedCostRm != null && selectedCurrentCombinedCostRm != null
    ? medianCombinedCostRm - selectedCurrentCombinedCostRm
    : rawItemChange;

  return {
    medianCombinedCostRm: medianCombinedCostRm == null ? null : money(medianCombinedCostRm),
    selectedBaselineCombinedCostRm: selectedBaselineCombinedCostRm == null
      ? null
      : money(selectedBaselineCombinedCostRm),
    selectedCurrentCombinedCostRm: selectedCurrentCombinedCostRm == null
      ? null
      : money(selectedCurrentCombinedCostRm),
    storeChoiceImpactRm: rawStoreChoice == null ? null : money(rawStoreChoice),
    itemChangeImpactRm: rawItemChange == null ? null : money(rawItemChange),
    netSavingRm: rawNetSaving == null ? null : money(rawNetSaving),
    comparableStoreCount: comparableTotals.length,
    estimatedPriceCount: comparableStores.reduce(
      (count, store) => count + (store.medianPriceCount ?? 0),
      0,
    ),
    routeEstimated: routeProvider === "straight_line",
  };
}

function isNullableNonNegativeMoney(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isNullableSignedMoney(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isEstimatedSavingsSnapshot(value: unknown): value is EstimatedSavingsSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return isNullableNonNegativeMoney(snapshot.medianCombinedCostRm)
    && isNullableNonNegativeMoney(snapshot.selectedBaselineCombinedCostRm)
    && isNullableNonNegativeMoney(snapshot.selectedCurrentCombinedCostRm)
    && isNullableSignedMoney(snapshot.storeChoiceImpactRm)
    && isNullableSignedMoney(snapshot.itemChangeImpactRm)
    && isNullableSignedMoney(snapshot.netSavingRm)
    && typeof snapshot.comparableStoreCount === "number"
    && Number.isInteger(snapshot.comparableStoreCount)
    && snapshot.comparableStoreCount >= 0
    && typeof snapshot.estimatedPriceCount === "number"
    && Number.isInteger(snapshot.estimatedPriceCount)
    && snapshot.estimatedPriceCount >= 0
    && typeof snapshot.routeEstimated === "boolean";
}
