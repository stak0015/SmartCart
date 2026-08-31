// AC 2.3.2: the compare list grows in fixed steps of five stores. The button
// label is verbatim "See More (+5)" and it hides once nothing remains.
export const VISIBLE_STEP = 5;

export function nextVisibleCount(current: number, total: number): number {
  return Math.min(current + VISIBLE_STEP, total);
}

export function hasMoreStores(visibleCount: number, total: number): boolean {
  return visibleCount < total;
}
