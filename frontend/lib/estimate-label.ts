// Owner: Shun
// AC 2.4.10 / 2.5.5: an estimated price says it comes from a range of prices
// across stores (middle 95% nationally), not that the price is missing.
import { formatRm } from "./format-rm";

export function priceRangeText(low: number, high: number): string {
  return low === high ? formatRm(low) : `${formatRm(low)} – ${formatRm(high)}`;
}

export function estimateLabel(
  price: { estimateLowRm?: number | null; estimateHighRm?: number | null },
  locale: "en" | "ms",
): string {
  const { estimateLowRm: low, estimateHighRm: high } = price;
  if (low == null || high == null) return locale === "en" ? "Estimated price" : "Anggaran harga";
  return locale === "en"
    ? `Estimated from a range of ${priceRangeText(low, high)}`
    : `Anggaran daripada julat ${priceRangeText(low, high)}`;
}
