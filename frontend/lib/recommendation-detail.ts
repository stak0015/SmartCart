import type {
  AlternativePriceItem,
  BasketAlternativeLine,
  PackSizeOption,
  StoreRecommendation,
} from "./contracts";
import type { AppliedReplacement, BasketItem } from "./basket-state";

export interface RecommendationDetailPrice {
  itemId: string;
  itemName: string;
  packageSize: string | null;
  quantity: number;
  unitPriceRm: number | null;
  lineTotalRm: number | null;
  observedDate: string | null;
  saraEligible: boolean | null;
  saraCategoryCandidate: boolean;
  isSaraCreditCandidate: boolean;
}

export interface RecommendationDetailRow {
  source: RecommendationDetailPrice;
  current: RecommendationDetailPrice;
  alternatives: BasketAlternativeLine;
  basketItem: BasketItem | null;
  replacement: AppliedReplacement | null;
}

export interface RecommendationDetailTotals {
  originalSubtotalRm: number | null;
  currentSubtotalRm: number | null;
  pricedCount: number;
  lineCount: number;
  saraCreditRm: number | null;
  cashNeededRm: number | null;
  hasReplacements: boolean;
  savingsComparable: boolean;
  netSavingRm: number | null;
  latestObservedDate: string | null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function detailFromAlternative(item: AlternativePriceItem, quantity: number): RecommendationDetailPrice {
  return {
    itemId: item.itemId,
    itemName: item.itemName ?? "Catalogue item",
    packageSize: item.packageSize ?? item.unit,
    quantity,
    unitPriceRm: item.unitPriceRm,
    lineTotalRm: item.unitPriceRm == null ? null : money(item.unitPriceRm * quantity),
    observedDate: item.observedDate,
    saraEligible: item.saraEligible,
    saraCategoryCandidate: item.saraCategoryCandidate,
    isSaraCreditCandidate: item.isSaraCreditCandidate,
  };
}

function detailFromPack(pack: PackSizeOption, quantity: number): RecommendationDetailPrice {
  return {
    itemId: pack.itemId,
    itemName: pack.itemName ?? "Catalogue item",
    packageSize: pack.packageSize,
    quantity,
    unitPriceRm: pack.totalPriceRm,
    lineTotalRm: pack.totalPriceRm == null ? null : money(pack.totalPriceRm * quantity),
    observedDate: pack.observedDate,
    saraEligible: pack.saraEligible,
    saraCategoryCandidate: pack.saraCategoryCandidate,
    isSaraCreditCandidate: pack.isSaraCreditCandidate,
  };
}

function fallbackCurrentPrice(
  store: StoreRecommendation,
  basketItem: BasketItem,
): RecommendationDetailPrice | null {
  const itemId = basketItem.id.replace(/^db-/, "");
  const line = store.basketLines.find(candidate => candidate.itemId === itemId);
  if (!line) return null;
  const price = store.basketPrices.find(candidate => candidate.itemId === itemId);
  const saraEligible = price?.saraEligible ?? basketItem.saraEligible;
  const saraCategoryCandidate = price?.saraCategoryCandidate ?? basketItem.saraCategoryCandidate;
  return {
    itemId,
    itemName: line.itemName ?? basketItem.name,
    packageSize: price?.packageSize ?? line.unit ?? basketItem.size,
    quantity: basketItem.qty,
    unitPriceRm: line.unitPriceRm,
    lineTotalRm: line.unitPriceRm == null ? null : money(line.unitPriceRm * basketItem.qty),
    observedDate: line.observedDate,
    saraEligible,
    saraCategoryCandidate,
    isSaraCreditCandidate: saraEligible === true || saraCategoryCandidate,
  };
}

function findBasketItem(basket: BasketItem[], sourceItemId: string): BasketItem | null {
  const sourceId = `db-${sourceItemId}`;
  return basket.find(item => (
    item.id === sourceId || item.replacement?.original.id === sourceId
  )) ?? null;
}

export function buildRecommendationDetailRows(
  basket: BasketItem[],
  store: StoreRecommendation,
  alternatives: BasketAlternativeLine[],
): RecommendationDetailRow[] {
  return alternatives.map(line => {
    const basketItem = findBasketItem(basket, line.source.itemId);
    const quantity = basketItem?.qty ?? line.quantity;
    const source = detailFromAlternative(line.source, quantity);
    let current = source;

    if (basketItem && basketItem.id !== `db-${line.source.itemId}`) {
      const currentItemId = basketItem.id.replace(/^db-/, "");
      if (line.alternative?.itemId === currentItemId) {
        current = detailFromAlternative(line.alternative, quantity);
      } else {
        const pack = line.packOptions?.find(option => option.itemId === currentItemId);
        current = pack
          ? detailFromPack(pack, quantity)
          : fallbackCurrentPrice(store, basketItem) ?? source;
      }
    }

    return {
      source,
      current,
      alternatives: line,
      basketItem,
      replacement: basketItem?.replacement ?? null,
    };
  });
}

export function recommendationDetailTotals(
  rows: RecommendationDetailRow[],
): RecommendationDetailTotals {
  const originalPrices = rows.map(row => row.source.lineTotalRm).filter((value): value is number => value != null);
  const currentPrices = rows.map(row => row.current.lineTotalRm).filter((value): value is number => value != null);
  const replacementRows = rows.filter(row => row.replacement);
  const savingsComparable = rows.length > 0 && rows.every(row => (
    row.source.lineTotalRm != null && row.current.lineTotalRm != null
  ));
  const originalSubtotalRm = originalPrices.length > 0
    ? money(originalPrices.reduce((total, value) => total + value, 0))
    : null;
  const currentSubtotalRm = currentPrices.length > 0
    ? money(currentPrices.reduce((total, value) => total + value, 0))
    : null;
  const saraCreditRm = currentSubtotalRm == null
    ? null
    : money(rows.reduce((total, row) => (
        total + (row.current.isSaraCreditCandidate ? row.current.lineTotalRm ?? 0 : 0)
      ), 0));
  const cashNeededRm = currentSubtotalRm == null || saraCreditRm == null
    ? null
    : money(Math.max(0, currentSubtotalRm - saraCreditRm));
  const dates = rows
    .map(row => row.current.observedDate)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    originalSubtotalRm,
    currentSubtotalRm,
    pricedCount: currentPrices.length,
    lineCount: rows.length,
    saraCreditRm,
    cashNeededRm,
    hasReplacements: replacementRows.length > 0,
    savingsComparable,
    netSavingRm: savingsComparable && originalSubtotalRm != null && currentSubtotalRm != null
      ? money(originalSubtotalRm - currentSubtotalRm)
      : null,
    latestObservedDate: dates.at(-1) ?? null,
  };
}

export function targetAlreadyInBasket(
  basket: BasketItem[],
  sourceItemId: string,
  targetItemId: string,
): boolean {
  const sourceId = `db-${sourceItemId}`;
  const targetId = `db-${targetItemId}`;
  return basket.some(item => (
    item.id === targetId
    && item.id !== sourceId
    && item.replacement?.original.id !== sourceId
  ));
}
