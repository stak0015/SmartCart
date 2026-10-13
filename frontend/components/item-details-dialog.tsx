"use client";
// Owner: Shun
import { useEffect, useState } from "react";
import { fetchItemNutrition, lookupItems, type Item, type ItemNutritionResult } from "@/lib/api";
import { type AppCopy, type Locale } from "@/lib/i18n";
import { uppercaseItemName } from "@/lib/item-name";
import { CatalogueItemDialog } from "./catalogue-item-dialog";
import { CatalogueItemDetails } from "./catalogue-item-details";
import { ItemNutritionSection } from "./item-nutrition";
import { ItemPriceHistory } from "./price-history";

export interface ItemDetailsRequest {
  catalogueItemId: string;
  // Shown while the item loads.
  name: string;
  plannedWeek?: string | null;
  // AC 4.9.1: from Planned items the price trends (forecast) open straight away.
  openTrends: boolean;
}

/**
 * Item details opened from Planned items (US 4.9) or the checklist (US 5.9).
 * It reuses the Shop screen's details window but offers no "Add to basket",
 * so viewing an item never changes the plan or the checklist (AC 5.9.2).
 */
export function ItemDetailsDialog({ request, candidateCacheId, copy, locale, onClose }: {
  request: ItemDetailsRequest | null; candidateCacheId: string | null; copy: AppCopy; locale: Locale; onClose: () => void;
}) {
  const [item, setItem] = useState<Item | null>(null);
  const [failed, setFailed] = useState(false);
  const [nutrition, setNutrition] = useState<ItemNutritionResult | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionError, setNutritionError] = useState(false);
  const itemId = request?.catalogueItemId ?? null;

  useEffect(() => {
    setItem(null);
    setFailed(false);
    if (!itemId) return;
    const controller = new AbortController();
    lookupItems([itemId], candidateCacheId, controller.signal)
      .then(items => {
        if (controller.signal.aborted) return;
        const found = items.find(candidate => String(candidate.item_id) === itemId) ?? null;
        setItem(found);
        setFailed(found == null);
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      });
    return () => controller.abort();
  }, [itemId, candidateCacheId]);

  const itemCode = item?.item_code;
  useEffect(() => {
    setNutrition(null);
    setNutritionError(false);
    if (!itemCode) { setNutritionLoading(false); return; }
    const controller = new AbortController();
    setNutritionLoading(true);
    fetchItemNutrition(itemCode, controller.signal)
      .then(data => { if (!controller.signal.aborted) setNutrition(data); })
      .catch(() => { if (!controller.signal.aborted) setNutritionError(true); })
      .finally(() => { if (!controller.signal.aborted) setNutritionLoading(false); });
    return () => controller.abort();
  }, [itemCode]);

  if (!request) return null;
  const title = item
    ? uppercaseItemName((locale === "ms" ? item.item_name_ms : item.item_name_en) || item.item_name || request.name)
    : request.name;
  return <CatalogueItemDialog
    key={`${request.catalogueItemId}-${item ? "loaded" : "loading"}`}
    open
    title={title}
    locale={locale}
    onClose={onClose}
    initialTrendsOpen={request.openTrends && item != null}
    trends={item ? close => <ItemPriceHistory code={item.item_code} quantity={null} locale={locale} onClose={close} plannedWeek={request.plannedWeek}/> : undefined}
    details={item
      ? priceTrendsButton => <CatalogueItemDetails item={item} priceTrendsButton={priceTrendsButton} copy={copy} locale={locale}/>
      : <p role={failed ? "alert" : "status"} className="catalogue-dialog-details">{failed
        ? (locale === "en" ? "Item details could not be loaded." : "Butiran item tidak dapat dimuatkan.")
        : (locale === "en" ? "Loading item details…" : "Memuatkan butiran item…")}</p>}
    nutrition={item && <ItemNutritionSection loading={nutritionLoading} result={nutrition} error={nutritionError} locale={locale}/>}
  />;
}
