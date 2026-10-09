import type { Item } from "./api";
import { formatRm } from "./format-rm";

export function cataloguePrice(item: Pick<Item, "price_range">, locale: "en" | "ms") {
  const range = item.price_range;
  if (!range) return locale === "en" ? "Price unavailable" : "Harga tidak tersedia";
  const price = range.min_rm === range.max_rm ? formatRm(range.min_rm) : `${formatRm(range.min_rm)} – ${formatRm(range.max_rm)}`;
  return range.price_source === "median"
    ? `${price} (${locale === "en" ? "estimated" : "anggaran"})`
    : price;
}
