// Owner: Shun
// Builds checklists in the older format that recorded actual prices and
// quantities on bought lines. The UI no longer writes these fields, but saved
// checklists and trip records may still contain them, so parsing, export and
// trip totals are tested against this shape.
import type { ShoppingChecklist } from "@/lib/shopping-checklist";

export function withActualPrice(checklist: ShoppingChecklist, itemId: string, actualPriceRm: number | null): ShoppingChecklist {
  return { ...checklist, items: checklist.items.map(item => item.id === itemId ? { ...item, actualPriceRm } : item) };
}

export function withActualQuantity(checklist: ShoppingChecklist, itemId: string, actualQuantity: number | null): ShoppingChecklist {
  return {
    ...checklist,
    items: checklist.items.map(item => item.id === itemId
      ? { ...item, actualQuantity, quantitySource: actualQuantity == null ? "planned" as const : "actual" as const }
      : item),
  };
}
