// Price freshness gate for the "Prices updated [X] days ago" warning tag
// (AC 2.3.5): the tag appears only when the store's oldest basket-line price
// is strictly older than the threshold.
export const PRICE_STALE_AFTER_DAYS = 7;

export function isPriceStale(daysAgo: number | null): boolean {
  return daysAgo != null && daysAgo > PRICE_STALE_AFTER_DAYS;
}
