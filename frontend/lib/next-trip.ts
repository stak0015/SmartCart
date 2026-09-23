import type { BasketItem } from "./basket-state";
import type { PriceSource } from "./contracts";
import {
  effectiveChecklistQuantity,
  effectiveChecklistUnitPrice,
  type ChecklistItem,
  type ShoppingChecklist,
} from "./shopping-checklist";

export const NEXT_TRIP_STORAGE_KEY = "smartcart.next-trip.v1";

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Only item identity and quantity travel between trips. A previous store's
// price, shopping outcome and location are not a quote for the next trip.
export type NextTripItem = Pick<ChecklistItem,
  "id" | "source" | "catalogueItemId" | "itemName" | "itemNameEn" | "itemNameMs" | "imageUrl" | "packageSize" | "quantity"
>;

export interface NextTripPriceQuote {
  itemName?: string | null;
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  imageUrl?: string | null;
  packageSize?: string | null;
  unitPriceRm: number | null;
  observedDate: string | null;
  priceSource?: PriceSource | null;
}

export function nextTripItemId(item: Pick<ChecklistItem, "id" | "catalogueItemId">): string {
  return item.catalogueItemId == null ? item.id : `catalogue:${item.catalogueItemId}`;
}

export function saveForNextTrip(saved: NextTripItem[], item: ChecklistItem): NextTripItem[] {
  if (item.status === "bought") return saved;
  const entry: NextTripItem = {
    id: nextTripItemId(item),
    source: item.source,
    catalogueItemId: item.catalogueItemId,
    itemName: item.itemName,
    itemNameEn: item.itemNameEn,
    itemNameMs: item.itemNameMs,
    imageUrl: item.imageUrl,
    packageSize: item.packageSize,
    quantity: effectiveChecklistQuantity(item),
  };
  const existing = saved.findIndex(candidate => candidate.id === entry.id);
  return existing < 0 ? [...saved, entry] : saved.map((candidate, index) => index === existing ? entry : candidate);
}

export function serializeNextTrip(items: NextTripItem[]): string {
  return JSON.stringify({ version: 1, items });
}

export function parseNextTrip(serialized: string | null): NextTripItem[] {
  try {
    const value: unknown = JSON.parse(serialized ?? "null");
    if (!value || typeof value !== "object") return [];
    const envelope = value as Record<string, unknown>;
    if (envelope.version !== 1 || !Array.isArray(envelope.items)) return [];
    const seen = new Set<string>();
    return envelope.items.filter((entry): entry is NextTripItem => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id.trim() || seen.has(item.id)
        || typeof item.itemName !== "string" || !item.itemName.trim()
        || ![item.itemNameEn, item.itemNameMs, item.packageSize].every(field => field === null || typeof field === "string")
        || (item.imageUrl !== undefined && item.imageUrl !== null && typeof item.imageUrl !== "string")
        || typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1
        || !(item.source === "manual" && item.catalogueItemId === null
          || item.source === "catalogue" && typeof item.catalogueItemId === "string" && item.catalogueItemId.length > 0)
        || item.catalogueItemId !== null && item.id !== `catalogue:${item.catalogueItemId}`) return false;
      seen.add(item.id);
      return true;
    }).map(item => ({
      id: item.id,
      source: item.source,
      catalogueItemId: item.catalogueItemId,
      itemName: item.itemName,
      itemNameEn: item.itemNameEn,
      itemNameMs: item.itemNameMs,
      ...(item.imageUrl !== undefined ? { imageUrl: item.imageUrl } : {}),
      packageSize: item.packageSize,
      quantity: item.quantity,
    }));
  } catch {
    return [];
  }
}

/** Merge saved catalogue items into planning without duplicating existing lines. */
export function nextTripBasket(basket: BasketItem[], saved: NextTripItem[]): BasketItem[] {
  return saved.reduce((items, item) => {
    if (item.catalogueItemId == null) return items;
    const id = `db-${item.catalogueItemId}`;
    const existing = items.find(line => line.id === id);
    return existing
      ? items.map(line => line.id === id ? { ...line, imageUrl: line.imageUrl ?? item.imageUrl, qty: Math.max(line.qty, item.quantity) } : line)
      : [...items, {
        id, name: item.itemName, itemNameEn: item.itemNameEn, itemNameMs: item.itemNameMs,
        imageUrl: item.imageUrl,
        size: item.packageSize ?? "—", qty: item.quantity,
        saraEligible: null, saraCategoryCandidate: false,
      }];
  }, basket);
}

/** Existing lines retain their current values; new lines use a selected-store quote when available. */
export function addNextTripItem(
  checklist: ShoppingChecklist,
  saved: NextTripItem,
  quote?: NextTripPriceQuote,
): ShoppingChecklist {
  const existing = checklist.items.find(item => nextTripItemId(item) === saved.id);
  if (existing && existing.status !== "not_bought") return checklist;
  const quantity = saved.quantity;
  const itemName = quote?.itemName?.trim() || saved.itemName;
  const itemNameEn = quote?.itemNameEn ?? saved.itemNameEn;
  const itemNameMs = quote?.itemNameMs ?? saved.itemNameMs;
  const imageUrl = quote?.imageUrl || existing?.imageUrl || saved.imageUrl || null;
  const packageSize = quote?.packageSize ?? saved.packageSize;
  const unitPriceRm = quote?.unitPriceRm ?? null;
  const priceSource = quote?.priceSource ?? (saved.source === "manual" ? "manual" : null);
  const observedDate = quote?.observedDate ?? null;
  const existingUnitPrice = existing ? effectiveChecklistUnitPrice(existing) : null;
  const restoredItem: ChecklistItem = existing ? {
    ...existing,
    status: "neutral",
    imageUrl,
    quantity,
    ...(quote ? {
      itemName,
      itemNameEn,
      itemNameMs,
      packageSize,
      actualPriceRm: null,
      actualQuantity: null,
      quantitySource: "planned" as const,
      unitPriceRm,
      lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
      priceSource,
      observedDate,
      originalValues: {
        itemName, itemNameEn, itemNameMs,
        quantity, unitPriceRm, priceSource, observedDate,
      },
    } : {
      lineTotalRm: existingUnitPrice == null
        ? null
        : money(existingUnitPrice * quantity),
    }),
  } : {
    ...saved,
    itemName,
    itemNameEn,
    itemNameMs,
    imageUrl,
    packageSize,
    quantity,
    actualPriceRm: null, actualQuantity: null, quantitySource: "planned",
    unitPriceRm,
    lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
    priceSource,
    observedDate,
    status: "neutral",
    originalValues: {
      itemName, itemNameEn, itemNameMs,
      quantity, unitPriceRm, priceSource, observedDate,
    },
  };
  return {
    ...checklist,
    updatedAt: new Date().toISOString(),
    items: existing ? checklist.items.map(line => line.id === existing.id ? restoredItem : line) : [...checklist.items, restoredItem],
  };
}
