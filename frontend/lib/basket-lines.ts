// Owners: Zhihao, Shun
import type { BasketLineRequest } from "./contracts";

// Minimal structural shape of a basket row as seen by the Compare screen.
export interface BasketLineInput {
  id: string;
  qty: number;
}

export interface AlternativeBasketLineInput extends BasketLineInput {
  replacement?: { original: { id: string } };
}

// Maps basket rows to recommendation API lines (AC 2.3.1). Only real
// catalogue items (id "db-<itemId>") are sent, with the prefix stripped;
// any other id is ignored so it cannot pollute per-store basket totals. An empty result means the request falls back to
// transport-first ranking without a basket.
// Owners: Zhihao, Shun
export function toBasketLineRequests(basket: BasketLineInput[]): BasketLineRequest[] {
  return basket
    .filter(item => item.id.startsWith("db-"))
    .map(item => ({ itemId: item.id.slice(3), quantity: item.qty }));
}

// Store rankings use the shopper's current basket, but the selected-store
// alternatives panel must stay anchored to each line's original item. This
// lets an applied replacement be undone after leaving and re-entering a store
// without losing the original recommendation.
// Owners: Shun, Zhihao
export function toAlternativeLineRequests(basket: AlternativeBasketLineInput[]): BasketLineRequest[] {
  return basket
    .map(item => ({ id: item.replacement?.original.id ?? item.id, qty: item.qty }))
    .filter(item => item.id.startsWith("db-"))
    .map(item => ({ itemId: item.id.slice(3), quantity: item.qty }));
}
