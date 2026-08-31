import type { BasketAlternativeLine, AlternativePriceItem } from "./contracts";

export interface BasketItemBase {
  id: string;
  name: string;
  size: string;
  qty: number;
  saraEligible: boolean | null;
  saraCategoryCandidate: boolean;
}

export interface AppliedSwap {
  original: BasketItemBase;
  premiseId: string;
  premiseName: string;
  sourceUnitPriceRm: number;
  alternativeUnitPriceRm: number;
  sourceObservedDate: string | null;
  alternativeObservedDate: string | null;
}

export type BasketItem = BasketItemBase & { swap?: AppliedSwap };

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function baseItem(item: AlternativePriceItem): BasketItemBase {
  return {
    id: `db-${item.itemId}`,
    name: item.itemName ?? "Catalogue item",
    size: item.packageSize ?? item.unit ?? "—",
    qty: 1,
    saraEligible: item.saraEligible,
    saraCategoryCandidate: item.saraCategoryCandidate,
  };
}

export function applyBasketSwap(
  basket: BasketItem[],
  line: BasketAlternativeLine,
  premise: { id: string; name: string },
): BasketItem[] {
  const alternative = line.alternative;
  if (
    !alternative
    || line.savingsRm == null
    || line.savingsRm <= 0
    || line.source.unitPriceRm == null
    || alternative.unitPriceRm == null
  ) return basket;

  const sourceId = `db-${line.source.itemId}`;
  const alternativeId = `db-${alternative.itemId}`;
  const sourceIndex = basket.findIndex(item => item.id === sourceId);
  if (sourceIndex < 0 || basket[sourceIndex].swap || basket.some(item => item.id === alternativeId)) {
    return basket;
  }

  const current = basket[sourceIndex];
  const original: BasketItemBase = {
    id: current.id,
    name: current.name,
    size: current.size,
    qty: current.qty,
    saraEligible: current.saraEligible,
    saraCategoryCandidate: current.saraCategoryCandidate,
  };
  const swap: AppliedSwap = {
    original,
    premiseId: premise.id,
    premiseName: premise.name,
    sourceUnitPriceRm: line.source.unitPriceRm,
    alternativeUnitPriceRm: alternative.unitPriceRm,
    sourceObservedDate: line.source.observedDate,
    alternativeObservedDate: alternative.observedDate,
  };
  const replacement: BasketItem = {
    ...baseItem(alternative),
    qty: current.qty,
    swap,
  };
  return basket.map((item, index) => index === sourceIndex ? replacement : item);
}

export function undoBasketSwap(basket: BasketItem[], itemId: string): BasketItem[] {
  const index = basket.findIndex(item => item.id === itemId && item.swap);
  if (index < 0) return basket;
  const item = basket[index];
  const original = item.swap!.original;
  const existingIndex = basket.findIndex((candidate, candidateIndex) => candidate.id === original.id && candidateIndex !== index);
  if (existingIndex >= 0) {
    return basket
      .filter((_, candidateIndex) => candidateIndex !== index)
      .map(candidate => candidate.id === original.id ? { ...candidate, qty: candidate.qty + item.qty } : candidate);
  }
  return basket.map((candidate, candidateIndex) => candidateIndex === index
    ? { ...original, qty: item.qty }
    : candidate);
}

export function currentSwapSavingRm(item: BasketItem): number {
  if (!item.swap) return 0;
  return money((item.swap.sourceUnitPriceRm - item.swap.alternativeUnitPriceRm) * item.qty);
}

export function itemFromAlternative(item: AlternativePriceItem, qty = 1): BasketItem {
  return { ...baseItem(item), qty };
}
