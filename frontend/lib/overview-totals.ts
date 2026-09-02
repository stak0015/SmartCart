import type { BasketLineDetail } from "./contracts";

// AC 2.4.3: the displayed line totals must add up to the priced basket
// subtotal. Lines without a price carry no line total and contribute
// nothing, so missing prices stay excluded from the subtotal.
export function sumPricedLineTotals(lines: BasketLineDetail[]): number {
  return lines.reduce((total, line) => total + (line.lineTotalRm ?? 0), 0);
}

// AC 2.4.2/2.4.3: the overview total is the priced basket subtotal plus the
// estimated return travel cost. A null subtotal (no priced lines) counts as
// zero, matching the "no subtotal available" state in the overview.
export function overviewTotalRm(
  basketSubtotalRm: number | null,
  estimatedRoundTripCostRm: number,
): number {
  return (basketSubtotalRm ?? 0) + estimatedRoundTripCostRm;
}