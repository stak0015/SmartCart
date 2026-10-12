// Owner: Zhihao

// A basket is complete at a store when every requested line has a valid
// price there (AC 2.3.3); anything short of full coverage is incomplete.
export function isCompleteBasket(store: { pricedCount: number | null; basketLineCount: number | null }): boolean {
  return store.pricedCount != null
    && store.basketLineCount != null
    && store.pricedCount === store.basketLineCount;
}
