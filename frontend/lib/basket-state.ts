import type {
  AlternativePriceItem,
  BasketAlternativeLine,
  PackSizeOption,
} from "./contracts";

export interface BasketItemBase {
  id: string;
  name: string;
  size: string;
  qty: number;
  saraEligible: boolean | null;
  saraCategoryCandidate: boolean;
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
    size: item.packageSize ?? item.unit ?? "—",
    qty: 1,
    saraEligible: item.saraEligible,
    saraCategoryCandidate: item.saraCategoryCandidate,
  };
}

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

  const original: BasketItemBase = current.replacement?.original ?? {
    id: current.id,
    name: current.name,
    size: current.size,
    qty: current.qty,
    saraEligible: current.saraEligible,
    saraCategoryCandidate: current.saraCategoryCandidate,
  };
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

export function itemFromAlternative(item: AlternativePriceItem, qty = 1): BasketItem {
  return { ...baseItem(item), qty };
}

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
      size: pack.packageSize ?? "—",
      qty: line.quantity,
      saraEligible: pack.saraEligible,
      saraCategoryCandidate: pack.saraCategoryCandidate,
    },
    sourceUnitPriceRm: line.source.unitPriceRm,
    replacementUnitPriceRm: pack.totalPriceRm,
    sourceObservedDate: line.source.observedDate,
    replacementObservedDate: pack.observedDate,
  };
}
