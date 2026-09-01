import { currentReplacementImpactRm, type BasketItem } from "./basket-state";

// One replaced basket line in the compact savings total. Amounts are the line
// totals at the store where the replacement was applied.
export interface SavingsLine {
  id: string;
  name: string;
  originalLineRm: number | null;
  newLineRm: number | null;
  impactRm: number | null;
}

// Savings summary derived from basket replacement records. The signed net
// impact equals originalRm - newRm because both use the same line values.
export interface SavingsSummary {
  hasReplacements: boolean;
  comparable: boolean;
  items: SavingsLine[];
  originalRm: number | null;
  newRm: number | null;
  netSavingRm: number | null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Lines without a replacement contribute nothing, so Undo removes their
// impact from the summary automatically.
export function basketSavingsSummary(basket: BasketItem[]): SavingsSummary {
  const items: SavingsLine[] = [];
  for (const item of basket) {
    if (!item.replacement) continue;
    const impactRm = currentReplacementImpactRm(item);
    const originalLineRm = item.replacement.sourceUnitPriceRm == null
      ? null
      : money(item.replacement.sourceUnitPriceRm * item.qty);
    items.push({
      id: item.id,
      name: item.name,
      originalLineRm,
      newLineRm: originalLineRm == null || impactRm == null ? null : money(originalLineRm - impactRm),
      impactRm,
    });
  }

  const comparable = items.length > 0 && items.every(line => (
    line.originalLineRm != null && line.newLineRm != null && line.impactRm != null
  ));
  const originalRm = comparable
    ? money(items.reduce((total, line) => total + (line.originalLineRm ?? 0), 0))
    : null;
  const netSavingRm = comparable
    ? money(items.reduce((total, line) => total + (line.impactRm ?? 0), 0))
    : null;
  const newRm = originalRm == null || netSavingRm == null ? null : money(originalRm - netSavingRm);

  return {
    hasReplacements: items.length > 0,
    comparable,
    items,
    originalRm,
    newRm,
    netSavingRm,
  };
}
