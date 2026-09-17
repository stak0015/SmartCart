import type { StoreRecommendation } from "./contracts";

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
  return store.basketLines
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

export function calculateEstimatedSavings(
  selectedStore: StoreRecommendation,
  recommendations: StoreRecommendation[],
  originalSubtotalRm: number | null,
  currentSubtotalRm: number | null,
  routeProvider: "google" | "straight_line",
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
  const comparableTotals = comparableStores
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
