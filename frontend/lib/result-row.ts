import type { Item } from "./api";

// Display fields for a search result row: item name, brand and package size,
// in that order. Package size is the merged quantity/pricing-basis value from
// the backend. Values that could not be parsed render as "—"; nothing is
// invented.
export interface ResultRowFields {
  name: string;
  brand: string;
  packageSize: string;
}

export function resultRowFields(item: Item): ResultRowFields {
  return {
    name: item.item_name ?? "Unknown item",
    brand: item.brand ?? "—",
    packageSize: item.package_size ?? "—",
  };
}

// Quantity on result rows: whole number 1–99, starts at 1 (AC-1.4.1).
export const DEFAULT_QTY = 1;
export const MAX_QTY = 99;

// AC-1.4.1 inline error wording — verbatim, do not reword.
export const QTY_ERROR = "Quantity must be a whole number between 1 and 99. Need to fill up.";

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
export function basketDetails(item: Item): { name: string; brand: string; size: string } {
  const fields = resultRowFields(item);
  return { name: fields.name, brand: fields.brand, size: fields.packageSize };
}

// ── Basket add & summary (AC-1.4.2) ─────────────────────────────────────────
export interface BasketLine {
  id: string;
  qty: number;
  price: number;
}

// Adding the same item again increases its quantity instead of creating a
// duplicate row (AC-1.4.2).
export function upsertBasketLine<T extends BasketLine>(basket: T[], line: T): T[] {
  if (basket.some(b => b.id === line.id)) {
    return basket.map(b => (b.id === line.id ? { ...b, qty: b.qty + line.qty } : b));
  }
  return [...basket, line];
}

// The basket summary (total units + estimated total) is derived from the
// lines, so it recalculates immediately on every change (AC-1.4.2).
export function basketSummary(basket: BasketLine[]): { itemCount: number; estimate: number } {
  return {
    itemCount: basket.reduce((count, item) => count + item.qty, 0),
    estimate: basket.reduce((total, item) => total + item.price * item.qty, 0),
  };
}

// Basket row price annotation: "5 × RM6.50 = RM32.50". Uses `price`
// (price per pack/item as sold), which is consistent for both database
// items and demo items; recomputed from the line on every render.
export function linePriceLabel(line: BasketLine): string {
  return `${line.qty} × RM${line.price.toFixed(2)} = RM${(line.price * line.qty).toFixed(2)}`;
}
