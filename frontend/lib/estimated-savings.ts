import type { RecommendationResponse, StoreRecommendation } from "./contracts";
import type { BasketItem } from "./basket-state";

/** The exact basket coverage used when comparing combined store costs. */
export interface SavingsCoverageSnapshot {
  pricedItemIds: string[];
  pricedItemCount: number;
  basketLineCount: number;
}

export interface SavingsDisclosureMetadata {
  routeProvider: RecommendationResponse["routeProvider"];
  routeWarning: string | null;
  estimatedTravelIncluded: boolean;
  medianPriceCount: number;
}

/**
 * Frozen estimate recorded with a checklist/trip. Null values mean there was
 * not enough comparable data to make that part of the estimate.
 */
export interface EstimatedSavingsSnapshot {
  version: 1;
  selectedCombinedTotalRm: number | null;
  medianCombinedTotalRm: number | null;
  comparableStoreCount: number;
  coverage: SavingsCoverageSnapshot;
  storeChoiceSavingsRm: number | null;
  comparableSwapCount: number;
  swapSavingsRm: number;
  totalEstimatedSavingsRm: number | null;
  disclosures: SavingsDisclosureMetadata;
}

export interface EstimatedSavingsOptions {
  routeProvider: RecommendationResponse["routeProvider"];
  routeWarning: string | null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function combinedTotal(store: StoreRecommendation): number | null {
  const value = store.combinedTotalRm ?? store.estimatedTotalCostRm;
  return validMoney(value) ? money(value) : null;
}

function pricedItemIds(store: StoreRecommendation): string[] {
  const lines = store.basketLines.length > 0 ? store.basketLines : store.basketPrices;
  return [...new Set(lines
    .filter(line => validMoney(line.lineTotalRm))
    .map(line => line.itemId)
    .filter(itemId => typeof itemId === "string" && itemId.length > 0))]
    .sort();
}

function basketLineCount(store: StoreRecommendation): number {
  const count = store.basketLineCount ?? store.basketItemCount;
  if (Number.isInteger(count) && count >= 0) return count;
  return Math.max(store.basketLines.length, store.basketPrices.length);
}

function sameCoverage(
  selectedCoverage: SavingsCoverageSnapshot,
  candidate: StoreRecommendation,
): boolean {
  const candidateIds = pricedItemIds(candidate);
  return basketLineCount(candidate) === selectedCoverage.basketLineCount
    && candidateIds.length === selectedCoverage.pricedItemCount
    && candidateIds.every((itemId, index) => itemId === selectedCoverage.pricedItemIds[index]);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function positiveComparableSwaps(
  selectedPremiseId: string,
  basket: BasketItem[],
): { count: number; savingsRm: number } {
  let count = 0;
  let savingsRm = 0;
  for (const item of basket) {
    const replacement = item.replacement;
    if (replacement?.premiseId !== selectedPremiseId
      || !validMoney(replacement.sourceUnitPriceRm)
      || !validMoney(replacement.alternativeUnitPriceRm)
      || !Number.isInteger(item.qty)
      || item.qty < 1) continue;

    const lineSavings = money(
      (replacement.sourceUnitPriceRm - replacement.alternativeUnitPriceRm) * item.qty,
    );
    if (lineSavings <= 0) continue;
    count += 1;
    savingsRm += lineSavings;
  }
  return { count, savingsRm: money(savingsRm) };
}

/**
 * Compares the selected store with reachable recommendations that have the
 * same basket-line count and exact priced-item set. The selected store is
 * always eligible for comparison, even if its route is now outside the limit.
 */
export function calculateEstimatedSavingsSnapshot(
  selectedStore: StoreRecommendation,
  recommendations: StoreRecommendation[],
  basket: BasketItem[],
  options: EstimatedSavingsOptions,
): EstimatedSavingsSnapshot {
  const selectedIds = pricedItemIds(selectedStore);
  const coverage: SavingsCoverageSnapshot = {
    pricedItemIds: selectedIds,
    pricedItemCount: selectedIds.length,
    basketLineCount: basketLineCount(selectedStore),
  };
  const selectedTotal = combinedTotal(selectedStore);

  const candidates = [selectedStore, ...recommendations.filter(store => (
    store.premiseId !== selectedStore.premiseId && !store.exceedsLimit
  ))];
  const comparableTotals = candidates
    .filter(store => sameCoverage(coverage, store))
    .map(combinedTotal)
    .filter((total): total is number => total != null);
  const comparableStoreCount = comparableTotals.length;
  const medianTotal = comparableStoreCount >= 2 ? money(median(comparableTotals)) : null;
  const storeChoiceSavings = medianTotal == null || selectedTotal == null
    ? null
    : money(Math.max(0, medianTotal - selectedTotal));

  const swaps = positiveComparableSwaps(selectedStore.premiseId, basket);
  const totalComponents = [storeChoiceSavings, swaps.count > 0 ? swaps.savingsRm : null]
    .filter((value): value is number => value != null && value > 0);
  const totalEstimatedSavingsRm = totalComponents.length > 0
    ? money(totalComponents.reduce((total, value) => total + value, 0))
    : null;
  const medianPriceCount = (selectedStore.basketLines.length > 0
    ? selectedStore.basketLines
    : selectedStore.basketPrices)
    .filter(line => line.lineTotalRm != null && line.priceSource === "median")
    .length;

  return {
    version: 1,
    selectedCombinedTotalRm: selectedTotal,
    medianCombinedTotalRm: medianTotal,
    comparableStoreCount,
    coverage,
    storeChoiceSavingsRm: storeChoiceSavings,
    comparableSwapCount: swaps.count,
    swapSavingsRm: swaps.savingsRm,
    totalEstimatedSavingsRm,
    disclosures: {
      routeProvider: options.routeProvider,
      routeWarning: options.routeWarning,
      estimatedTravelIncluded: validMoney(selectedStore.estimatedRoundTripCostRm),
      medianPriceCount,
    },
  };
}

export function isEstimatedSavingsSnapshot(value: unknown): value is EstimatedSavingsSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version !== 1
    || !(snapshot.selectedCombinedTotalRm === null || validMoney(snapshot.selectedCombinedTotalRm))
    || !(snapshot.medianCombinedTotalRm === null || validMoney(snapshot.medianCombinedTotalRm))
    || !Number.isInteger(snapshot.comparableStoreCount)
    || (snapshot.comparableStoreCount as number) < 0
    || !(snapshot.storeChoiceSavingsRm === null || validMoney(snapshot.storeChoiceSavingsRm))
    || !Number.isInteger(snapshot.comparableSwapCount)
    || (snapshot.comparableSwapCount as number) < 0
    || !validMoney(snapshot.swapSavingsRm)
    || !(snapshot.totalEstimatedSavingsRm === null || validMoney(snapshot.totalEstimatedSavingsRm))) {
    return false;
  }

  const coverage = snapshot.coverage;
  if (!coverage || typeof coverage !== "object") return false;
  const coverageRecord = coverage as Record<string, unknown>;
  if (!Array.isArray(coverageRecord.pricedItemIds)
    || !coverageRecord.pricedItemIds.every(id => typeof id === "string" && id.length > 0)
    || new Set(coverageRecord.pricedItemIds).size !== coverageRecord.pricedItemIds.length
    || coverageRecord.pricedItemCount !== coverageRecord.pricedItemIds.length
    || !Number.isInteger(coverageRecord.basketLineCount)
    || (coverageRecord.basketLineCount as number) < 0) return false;

  const disclosures = snapshot.disclosures;
  if (!disclosures || typeof disclosures !== "object") return false;
  const disclosureRecord = disclosures as Record<string, unknown>;
  return (disclosureRecord.routeProvider === "google" || disclosureRecord.routeProvider === "straight_line")
    && (disclosureRecord.routeWarning === null || typeof disclosureRecord.routeWarning === "string")
    && typeof disclosureRecord.estimatedTravelIncluded === "boolean"
    && Number.isInteger(disclosureRecord.medianPriceCount)
    && (disclosureRecord.medianPriceCount as number) >= 0;
}
