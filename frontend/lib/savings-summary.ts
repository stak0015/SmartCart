import { currentSwapSavingRm, type BasketItem } from "./basket-state";

// One replaced basket line in the savings breakdown (AC 3.4.2). Amounts are
// the line totals at the store where the swap was applied.
export interface SavingsLine {
  id: string;
  name: string;
  originalLineRm: number;
  newLineRm: number;
  savedRm: number;
}

// AC 3.4.1/3.4.2 savings summary derived from applied swaps. Invariant:
// totalSavedRm equals the sum of per-line savedRm AND originalRm - newRm,
// because newRm is derived from the same per-line values.
export interface SavingsSummary {
  hasSavings: boolean;
  items: SavingsLine[];
  originalRm: number;
  newRm: number;
  totalSavedRm: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Derives the savings summary from basket items carrying an applied swap
// (AC 3.4.1). Lines without a swap contribute nothing, so removing an
// alternative from the basket removes it from the summary automatically.
export function basketSavingsSummary(basket: BasketItem[]): SavingsSummary {
  const items: SavingsLine[] = [];
  for (const item of basket) {
    if (!item.swap) continue;
    const savedRm = currentSwapSavingRm(item);
    const originalLineRm = money(item.swap.sourceUnitPriceRm * item.qty);
    items.push({
      id: item.id,
      name: item.name,
      originalLineRm,
      newLineRm: money(originalLineRm - savedRm),
      savedRm,
    });
  }

  const totalSavedRm = money(items.reduce((total, line) => total + line.savedRm, 0));
  const originalRm = money(items.reduce((total, line) => total + line.originalLineRm, 0));
  // Derived from the difference so the displayed totals always reconcile:
  // totalSavedRm = sum(savedRm) = originalRm - newRm (AC 3.4.2).
  const newRm = money(originalRm - totalSavedRm);

  return { hasSavings: totalSavedRm > 0, items, originalRm, newRm, totalSavedRm };
}
