import type { Item } from "./api";

// Display fields for a search result row. Package size is the merged
// quantity/pricing-basis value from the backend. Values that could not be
// parsed render as "—"; nothing is invented.
export interface ResultRowFields {
  name: string;
  packageSize: string;
}

export function resultRowFields(item: Item): ResultRowFields {
  return {
    name: item.item_name ?? "Unknown item",
    packageSize: item.package_size ?? "—",
  };
}

// Quantity on result rows: whole number 1–99, starts at 1 (AC-1.4.1).
export const DEFAULT_QTY = 1;
export const MAX_QTY = 99;

// AC-1.4.1 inline error wording — verbatim, do not reword.
export const QTY_ERROR = "Quantity must be a whole number between 1 and 99.";

export function stepQty(qty: number, delta: number): number {
  return Math.min(MAX_QTY, Math.max(DEFAULT_QTY, qty + delta));
}

// Parse a typed quantity (AC-1.4.1): only whole-number strings "1".."99"
// are valid; 0, >99, decimals, letters, empty or negative input -> null.
export function parseQty(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const value = Number(raw);
  if (value < DEFAULT_QTY || value > MAX_QTY) return null;
  return value;
}

// A basket row must show the same attributes as the result row it came from;
// both views read from this single mapping so they cannot drift apart.
export function basketDetails(item: Item): { name: string; size: string } {
  const fields = resultRowFields(item);
  return { name: fields.name, size: fields.packageSize };
}

// ── Basket add & summary (AC-1.4.2) ─────────────────────────────────────────
export interface BasketLine {
  id: string;
  qty: number;
}

// Adding the same item again increases its quantity instead of creating a
// duplicate row (AC-1.4.2).
export function upsertBasketLine<T extends BasketLine>(basket: T[], line: T): T[] {
  if (basket.some(b => b.id === line.id)) {
    return basket.map(b => (b.id === line.id ? { ...b, qty: b.qty + line.qty } : b));
  }
  return [...basket, line];
}

// The basket item count is derived from the lines and recalculates immediately.
export function basketSummary(basket: BasketLine[]): { itemCount: number } {
  return {
    itemCount: basket.reduce((count, item) => count + item.qty, 0),
  };
}
