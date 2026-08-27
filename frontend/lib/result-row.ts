import type { Item } from "./api";

// Display fields for a search result row: item name, brand, package size and
// unit, in that order. Values that could not be parsed render as "—"; nothing
// is invented.
export interface ResultRowFields {
  name: string;
  brand: string;
  packageSize: string;
  unit: string;
}

export function resultRowFields(item: Item): ResultRowFields {
  return {
    name: item.item_name ?? "Unknown item",
    brand: item.brand ?? "—",
    packageSize: item.package_size ?? "—",
    unit: item.unit ?? "—",
  };
}

// Quantity stepper on result rows: starts at 1, plain increment/decrement.
export const DEFAULT_QTY = 1;

export function stepQty(qty: number, delta: number): number {
  return Math.max(1, qty + delta);
}
