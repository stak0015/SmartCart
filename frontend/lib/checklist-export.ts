import { formatRm } from "./format-rm";
import { COPY, type Locale } from "./i18n";
import type { ChecklistItem, ShoppingChecklist } from "./shopping-checklist";

/**
 * AC 5.7.2: the export content model. A pure projection of the saved
 * checklist into render-ready, localized text — store, checklist date, every
 * catalogue and custom row with package size when known, quantity, outcome,
 * and actual/reference price labels when known. Custom rows stay marked as
 * shopper-added.
 *
 * AC 5.7.3: this model is the ONLY input the export sheet accepts. It
 * deliberately carries no premiseId/premiseCode/address, no row or checklist
 * ids, no alternativeStoreEstimates and no estimatedSavings, so hidden app
 * data cannot leak into the exported file. Generation is fully on-device.
 */
export interface ChecklistExportRow {
  name: string;
  packageSize: string | null;
  quantity: number;
  // "actual" label only when the shopper recorded an actual quantity
  // (AC 5.3.4); planned quantities carry no extra label.
  quantitySourceLabel: string | null;
  outcomeLabel: string;
  // Reference unit price with its source label when it is an estimate
  // (median); store-observed prices are the plain reference price. Falls
  // back to the unavailable label when no reference price exists.
  referenceUnitPriceText: string;
  // Shopper-recorded actual unit price, always labelled as such; null when
  // never recorded.
  actualUnitPriceText: string | null;
  // "Manually added" label for custom rows; null for catalogue rows.
  shopperAddedLabel: string | null;
}

export interface ChecklistExportModel {
  title: string;
  storeName: string;
  dateText: string;
  rows: ChecklistExportRow[];
}

function localizedExportName(item: ChecklistItem, locale: Locale): string {
  if (item.source === "manual") return item.itemName;
  return (locale === "ms" ? item.itemNameMs : item.itemNameEn) || item.itemName;
}

function formatExportDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", {
    dateStyle: "medium",
  }).format(date);
}

function buildExportRow(
  item: ChecklistItem,
  locale: Locale,
): ChecklistExportRow {
  const copy = COPY[locale];
  const outcomeLabel =
    item.status === "bought"
      ? copy.bought
      : item.status === "not_bought"
        ? copy.notBought
        : copy.neutral;
  const referenceUnitPriceText =
    item.unitPriceRm == null
      ? copy.checklistPriceUnavailable
      : item.priceSource === "median"
        ? `${formatRm(item.unitPriceRm)} (${copy.checklistPriceEstimate})`
        : formatRm(item.unitPriceRm);
  const actualUnitPriceText =
    item.actualPriceRm == null
      ? null
      : `${formatRm(item.actualPriceRm)} (${copy.shopperRecorded})`;
  return {
    name: localizedExportName(item, locale),
    packageSize: item.packageSize,
    quantity: item.actualQuantity ?? item.quantity,
    quantitySourceLabel:
      item.quantitySource === "actual" ? copy.quantitySourceActual : null,
    outcomeLabel,
    referenceUnitPriceText,
    actualUnitPriceText,
    shopperAddedLabel: item.source === "manual" ? copy.manualItem : null,
  };
}

export function buildChecklistExportModel(
  checklist: ShoppingChecklist,
  locale: Locale,
): ChecklistExportModel {
  const copy = COPY[locale];
  return {
    title: copy.checklistTitle,
    storeName: checklist.store.name,
    dateText: formatExportDate(checklist.createdAt, locale),
    rows: checklist.items.map(item => buildExportRow(item, locale)),
  };
}
