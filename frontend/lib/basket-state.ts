// Owner: Shun
import type {
  AlternativePriceItem,
  BasketAlternativeLine,
  ItemCategory,
  SourceCategory,
  PackSizeOption,
} from "./contracts";

export interface BasketItemBase {
  id: string;
  name: string;
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  imageUrl?: string | null;
  size: string;
  qty: number;
  saraEligible: boolean | null;
  saraCategoryCandidate: boolean;
  category: ItemCategory | null;
  sourceCategory?: SourceCategory | null;
}

export type BasketReplacementKind = "lower_cost" | "pack";

export interface AppliedReplacement {
  original: BasketItemBase;
  kind: BasketReplacementKind;
  premiseId: string;
  premiseName: string;
  sourceUnitPriceRm: number | null;
  alternativeUnitPriceRm: number;
  sourceObservedDate: string | null;
  alternativeObservedDate: string | null;
}

export type BasketItem = BasketItemBase & { replacement?: AppliedReplacement };

export interface BasketReplacementChoice {
  kind: BasketReplacementKind;
  sourceItemId: string;
  replacement: BasketItemBase;
  sourceUnitPriceRm: number | null;
  replacementUnitPriceRm: number;
  sourceObservedDate: string | null;
  replacementObservedDate: string | null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function baseItem(item: AlternativePriceItem): BasketItemBase {
  return {
    id: `db-${item.itemId}`,
    name: item.itemName ?? "Catalogue item",
    itemNameEn: item.itemNameEn,
    itemNameMs: item.itemNameMs,
    imageUrl: item.imageUrl,
    size: item.packageSize ?? item.unit ?? "—",
    qty: 1,
    saraEligible: item.saraEligible,
    saraCategoryCandidate: item.saraCategoryCandidate,
    category: item.category,
    sourceCategory: item.sourceCategory ?? null,
  };
}

function withoutReplacement(item: BasketItem): BasketItemBase {
  const original = { ...item };
  delete original.replacement;
  return original;
}

/**
 * Swap a basket line for a cheaper equivalent or another pack size at the chosen store (US 3.3).
 * Keeps the quantity and stores the original line so the swap can be undone. Refuses a
 * cheaper-equivalent swap that is not cheaper (a pack-size swap may cost more upfront) and any swap
 * that would duplicate an existing basket line. Choosing the original again restores it.
 */
export function applyBasketReplacement(
  basket: BasketItem[],
  choice: BasketReplacementChoice,
  premise: { id: string; name: string },
): BasketItem[] {
  if (
    choice.kind === "lower_cost"
    && (choice.sourceUnitPriceRm == null || choice.replacementUnitPriceRm >= choice.sourceUnitPriceRm)
  ) return basket;

  const sourceId = `db-${choice.sourceItemId}`;
  const sourceIndex = basket.findIndex(item => (
    item.id === sourceId || item.replacement?.original.id === sourceId
  ));
  if (sourceIndex < 0) return basket;

  const current = basket[sourceIndex];
  if (current.id === choice.replacement.id) return basket;
  if (basket.some((item, index) => index !== sourceIndex && item.id === choice.replacement.id)) {
    return basket;
  }

  if (current.replacement?.original.id === choice.replacement.id) {
    return basket.map((item, index) => index === sourceIndex
      ? { ...current.replacement!.original, qty: current.qty }
      : item);
  }

  const original: BasketItemBase = current.replacement?.original ?? withoutReplacement(current);
  const replacement: AppliedReplacement = {
    original,
    kind: choice.kind,
    premiseId: premise.id,
    premiseName: premise.name,
    sourceUnitPriceRm: choice.sourceUnitPriceRm,
    alternativeUnitPriceRm: choice.replacementUnitPriceRm,
    sourceObservedDate: choice.sourceObservedDate,
    alternativeObservedDate: choice.replacementObservedDate,
  };
  const replacementItem: BasketItem = {
    ...choice.replacement,
    qty: current.qty,
    replacement,
  };
  return basket.map((item, index) => index === sourceIndex ? replacementItem : item);
}

/**
 * Restore the original item of a swapped line. If the original is already in the basket again, the
 * quantities are merged instead of creating a duplicate line.
 */
export function undoBasketReplacement(basket: BasketItem[], itemId: string): BasketItem[] {
  const index = basket.findIndex(item => item.id === itemId && item.replacement);
  if (index < 0) return basket;
  const item = basket[index];
  const original = item.replacement!.original;
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

export function currentReplacementImpactRm(item: BasketItem): number | null {
  if (!item.replacement || item.replacement.sourceUnitPriceRm == null) return null;
  return money((item.replacement.sourceUnitPriceRm - item.replacement.alternativeUnitPriceRm) * item.qty);
}

/**
 * Swap choice for a cheaper equivalent, or null when there is no positive saving or a price is
 * missing.
 */
export function lowerCostReplacementChoice(line: BasketAlternativeLine): BasketReplacementChoice | null {
  const alternative = line.alternative;
  if (
    !alternative
    || line.savingsRm == null
    || line.savingsRm <= 0
    || line.source.unitPriceRm == null
    || alternative.unitPriceRm == null
  ) return null;

  return {
    kind: "lower_cost",
    sourceItemId: line.source.itemId,
    replacement: baseItem(alternative),
    sourceUnitPriceRm: line.source.unitPriceRm,
    replacementUnitPriceRm: alternative.unitPriceRm,
    sourceObservedDate: line.source.observedDate,
    replacementObservedDate: alternative.observedDate,
  };
}

/** Swap choice for another pack size of the same product; null when the pack has no price. */
export function packReplacementChoice(
  line: BasketAlternativeLine,
  pack: PackSizeOption,
): BasketReplacementChoice | null {
  if (pack.totalPriceRm == null) return null;
  return {
    kind: "pack",
    sourceItemId: line.source.itemId,
    replacement: {
      id: `db-${pack.itemId}`,
      name: pack.itemName ?? "Catalogue item",
      itemNameEn: pack.itemNameEn,
      itemNameMs: pack.itemNameMs,
      imageUrl: pack.imageUrl,
      size: pack.packageSize ?? "—",
      qty: line.quantity,
      saraEligible: pack.saraEligible,
      saraCategoryCandidate: pack.saraCategoryCandidate,
      category: pack.category,
      sourceCategory: pack.sourceCategory ?? null,
    },
    sourceUnitPriceRm: line.source.unitPriceRm,
    replacementUnitPriceRm: pack.totalPriceRm,
    sourceObservedDate: line.source.observedDate,
    replacementObservedDate: pack.observedDate,
  };
}
