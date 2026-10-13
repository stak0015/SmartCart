// Owner: Shun
import type { Item } from "./api";
import { priceRangeText } from "./estimate-label";

export function cataloguePrice(item: Pick<Item, "price_range">, locale: "en" | "ms") {
  const range = item.price_range;
  if (!range) return locale === "en" ? "Price unavailable" : "Harga tidak tersedia";
  const price = priceRangeText(range.min_rm, range.max_rm);
  return range.price_source === "median"
    ? `${price} (${locale === "en" ? "estimated" : "anggaran"})`
    : price;
}
