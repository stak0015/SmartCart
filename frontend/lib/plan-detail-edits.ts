// Owner: Shun
import type { BasketItem } from "./basket-state";
import type { BasketAlternativeLine, PricedPlan, StoreRecommendation } from "./contracts";
import type { StorePlanOption } from "./multi-store";
import { buildRecommendationDetailRows, recommendationDetailTotals, type RecommendationDetailRow } from "./recommendation-detail";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function planBasketItem(basket: BasketItem[], itemId: string) {
  return basket.find(item => item.id === `db-${itemId}` || item.replacement?.original.id === `db-${itemId}`);
}

/**
 * Detail rows for one store of a store plan, keeping any swap already accepted at that store while
 * suggestions reload.
 */
export function planDetailRows(plan: PricedPlan, store: Pick<StoreRecommendation, "premiseId" | "basketLines" | "basketPrices">, basket: BasketItem[], alternatives: BasketAlternativeLine[] = []): RecommendationDetailRow[] {
  const assignments = plan.assignments.filter(line => line.storePremiseId === store.premiseId);
  const suggestions: BasketAlternativeLine[] = assignments.map(line => {
    const suggestion = alternatives.find(value => value.source.itemId === line.itemId);
    if (suggestion) return suggestion;
    const item = planBasketItem(basket, line.itemId);
    return { quantity: item?.qty ?? line.quantity, source: {
      ...line, itemName: line.itemName || item?.name || line.itemId,
      packageSize: line.unit, priceObservedDaysAgo: null,
      saraEligible: line.saraEligible ?? item?.saraEligible ?? null,
      saraCategoryCandidate: line.saraCategoryCandidate ?? item?.saraCategoryCandidate ?? false,
      isSaraCreditCandidate: Boolean(line.saraEligible || line.saraCategoryCandidate || item?.saraEligible || item?.saraCategoryCandidate),
      category: line.category ?? item?.category ?? null,
    }, alternative: null, savingsRm: null, packOptions: [] };
  });
  return buildRecommendationDetailRows(basket, { ...store, basketLines: assignments.map(line => ({ ...line, category: line.category ?? null })) }, suggestions).map(row => {
    const item = row.basketItem;
    // Keep the accepted store price while suggestions reload or become unavailable.
    if (!item?.replacement || item.replacement.premiseId !== store.premiseId) return row;
    const unitPriceRm = item.replacement.alternativeUnitPriceRm;
    return { ...row, current: {
      ...row.current, itemId: item.id.replace(/^db-/, ""), itemName: item.name,
      itemNameEn: item.itemNameEn, itemNameMs: item.itemNameMs, imageUrl: item.imageUrl,
      packageSize: item.size, quantity: item.qty, unitPriceRm, lineTotalRm: money(unitPriceRm * item.qty),
      observedDate: item.replacement.alternativeObservedDate, priceSource: "store",
      saraEligible: item.saraEligible, saraCategoryCandidate: item.saraCategoryCandidate,
      isSaraCreditCandidate: Boolean(item.saraEligible || item.saraCategoryCandidate), category: item.category,
      sourceCategory: item.sourceCategory,
    } };
  });
}

/** Rebuild a plan's assignments and totals after the shopper edits items on the plan details page. */
export function editedPlan(plan: PricedPlan, rowsByStore: Record<string, RecommendationDetailRow[]>): PricedPlan {
  const assignments = plan.storePremiseIds.flatMap((id, index) => (rowsByStore[id] ?? []).map(row => ({
    ...row.current, unit: row.current.packageSize, storePremiseId: id, storeName: plan.storeNames[index],
  })));
  const totals = recommendationDetailTotals(Object.values(rowsByStore).flat());
  return { ...plan, assignments, basketSubtotalRm: totals.currentSubtotalRm,
    combinedTotalRm: totals.currentSubtotalRm == null ? null : money(totals.currentSubtotalRm + plan.transportCostRm),
    pricedLineCount: totals.pricedCount, basketLineCount: assignments.length,
    missingItems: assignments.filter(line => line.lineTotalRm == null).map(line => line.itemName),
    isComplete: assignments.length > 0 && assignments.every(line => line.lineTotalRm != null),
  };
}

/** Keep all comparison plans on the current quantities, before any item swaps. */
export function repriceComparisonOptions(options: StorePlanOption[], basket: BasketItem[]): StorePlanOption[] {
  return options.map(option => {
    const lines = option.kind === "store"
      ? (option.store.basketLines.length ? option.store.basketLines : option.store.basketPrices)
      : option.plan.assignments;
    if (lines.every(line => (planBasketItem(basket, line.itemId)?.qty ?? line.quantity) === line.quantity)) return option;
    const repriced = lines.map(line => {
      const quantity = planBasketItem(basket, line.itemId)?.qty ?? line.quantity;
      return { ...line, quantity, lineTotalRm: line.unitPriceRm == null ? null : money(line.unitPriceRm * quantity) };
    });
    const prices = repriced.flatMap(line => line.lineTotalRm == null ? [] : [line.lineTotalRm]);
    const subtotal = prices.length ? money(prices.reduce((sum, value) => sum + value, 0)) : null;
    if (option.kind === "plan") return { kind: "plan", plan: { ...option.plan,
      basketSubtotalRm: subtotal, combinedTotalRm: subtotal == null ? null : money(subtotal + option.plan.transportCostRm),
    } };
    return { kind: "store", store: { ...option.store,
      basketSubtotalRm: subtotal, combinedTotalRm: subtotal == null ? null : money(subtotal + option.store.estimatedRoundTripCostRm),
      estimatedTotalCostRm: subtotal == null ? null : money(subtotal + option.store.estimatedRoundTripCostRm),
    } };
  });
}
