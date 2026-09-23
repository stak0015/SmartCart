// AC 2.3.2: the compare list grows in fixed steps of six stores.
export const VISIBLE_STEP = 6;

export function nextVisibleCount(current: number, total: number): number {
  return Math.min(current + VISIBLE_STEP, total);
}

export function hasMoreStores(visibleCount: number, total: number): boolean {
  return visibleCount < total;
}
