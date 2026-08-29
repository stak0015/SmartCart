import type { BasketLineRequest } from "./contracts";

// Minimal structural shape of a basket row as seen by the Compare screen.
export interface BasketLineInput {
  id: string;
  qty: number;
}

// Maps basket rows to recommendation API lines (AC 2.3.1). Only real
// catalogue items (id "db-<itemId>") are sent, with the prefix stripped;
// demo/mock rows ("1", "2", ...) are filtered out so they cannot pollute
// per-store basket totals. An empty result means the request falls back to
// transport-first ranking without a basket.
export function toBasketLineRequests(basket: BasketLineInput[]): BasketLineRequest[] {
  return basket
    .filter(item => item.id.startsWith("db-"))
    .map(item => ({ itemId: item.id.slice(3), quantity: item.qty }));
}
