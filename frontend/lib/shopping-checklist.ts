import { isItemCategory, isSourceCategory, type BasketItemPrice, type ItemCategory, type SourceCategory, type StoreRecommendation } from "./contracts";
import type { RecommendationDetailRow } from "./recommendation-detail";
import {
  isEstimatedSavingsSnapshot,
  type EstimatedSavingsSnapshot,
} from "./estimated-savings";

export const SHOPPING_CHECKLIST_VERSION = 6 as const;
export const SHOPPING_CHECKLIST_STORAGE_KEY = "smartcart.shopping-checklist.v1";

export type ChecklistStatus = "neutral" | "bought" | "not_bought";
export type ChecklistPriceSource = "store" | "median" | "manual" | null;
export type ChecklistItemSource = "catalogue" | "manual";
export type ChecklistQuantitySource = "planned" | "actual";

/**
 * Epic 8 interface point (D8.0 / gap G4): the estimated trip cost of each
 * alternative store at snapshot time. These are estimates, never observed
 * prices; they let later epics compare "what if I had shopped elsewhere"
 * on-device without re-querying recommendations.
 */
export interface AlternativeStoreEstimate {
  premiseId: string;
  name: string;
  estimatedRoundTripCostRm: number;
  estimatedTotalCostRm: number | null;
}

export interface ChecklistStore {
  premiseId: string;
  premiseCode: string;
  name: string;
  address: string | null;
}

export interface ChecklistItem {
  id: string;
  source: ChecklistItemSource;
  catalogueItemId: string | null;
  itemName: string;
  itemNameEn: string | null;
  itemNameMs: string | null;
  category: ItemCategory | null;
  sourceCategory?: SourceCategory | null;
  imageUrl?: string | null;
  packageSize: string | null;
  quantity: number;
  unitPriceRm: number | null;
  lineTotalRm: number | null;
  // Legacy override kept for saved checklist migration. New row edits update
  // unitPriceRm directly and retain the starting value in originalValues.
  actualPriceRm: number | null;
  // Legacy quantity override; new row edits update quantity directly.
  actualQuantity: number | null;
  quantitySource: ChecklistQuantitySource;
  priceSource: ChecklistPriceSource;
  observedDate: string | null;
  status: ChecklistStatus;
  /** Values captured when this line was added, used by the row's Revert action. */
  originalValues?: ChecklistOriginalValues;
}

export interface ChecklistOriginalValues {
  itemName: string;
  itemNameEn: string | null;
  itemNameMs: string | null;
  quantity: number;
  unitPriceRm: number | null;
  priceSource: ChecklistPriceSource;
  observedDate: string | null;
}

function originalValues(item: ChecklistItem): ChecklistOriginalValues {
  return {
    itemName: item.itemName,
    itemNameEn: item.itemNameEn,
    itemNameMs: item.itemNameMs,
    quantity: item.quantity,
    unitPriceRm: item.unitPriceRm,
    priceSource: item.priceSource,
    observedDate: item.observedDate,
  };
}

function withOriginalValues(item: ChecklistItem): ChecklistItem {
  return { ...item, originalValues: originalValues(item) };
}

export interface ShoppingChecklist {
  version: typeof SHOPPING_CHECKLIST_VERSION;
  id: string;
  store: ChecklistStore;
  createdAt: string;
  updatedAt: string;
  // AC 5.1.1: the snapshot keeps the planned subtotal, the estimated return
  // transport (an estimate, never an observed price), and the planned
  // combined total when known. Null when the source value was unknown.
  plannedSubtotalRm: number | null;
  estimatedRoundTripCostRm: number | null;
  plannedCombinedTotalRm: number | null;
  // Gap G4: the alternative stores' estimated trip costs at snapshot time.
  // Empty for payloads created before this field existed (migrated v1-v3).
  alternativeStoreEstimates: AlternativeStoreEstimate[];
  // Frozen at plan confirmation so later item-price updates cannot rewrite a
  // historical savings claim. Older locally stored checklists omit this field.
  estimatedSavings?: EstimatedSavingsSnapshot | null;
  // AC 8.2.3: how the frozen travel estimates above were produced. Kept on the
  // checklist so the provenance can travel into the expense record and still be
  // disclosed long after the recommendation response is gone. Optional:
  // checklists created before this field existed carry no provenance and must
  // still validate.
  routeProvider?: "google" | "straight_line";
  items: ChecklistItem[];
}

export interface ManualChecklistItemInput {
  itemName: string;
  quantity: number | string;
  unitPriceRm: number | string | null;
}

export interface ValidatedManualChecklistItemInput {
  itemName: string;
  quantity: number;
  unitPriceRm: number | null;
}

export interface ManualChecklistItemErrors {
  itemName?: "required";
  quantity?: "invalid";
  unitPriceRm?: "invalid";
}

export type ManualChecklistItemValidation =
  | { success: true; value: ValidatedManualChecklistItemInput }
  | { success: false; errors: ManualChecklistItemErrors };

export interface ChecklistProgress {
  total: number;
  completed: number;
  bought: number;
  notBought: number;
  neutral: number;
  percent: number;
}

interface ChecklistCreationOptions {
  checklistId?: string;
  createdAt?: string;
  alternativeStores?: StoreRecommendation[];
  estimatedSavings?: EstimatedSavingsSnapshot | null;
  // AC 8.2.3: provenance of the frozen travel estimates.
  routeProvider?: "google" | "straight_line";
}

interface AddManualItemOptions {
  itemId?: string;
  updatedAt?: string;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function generatedId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeQuantity(value: number): number {
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

function normalizeCataloguePrice(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? money(value) : null;
}

function cataloguePriceSource(
  priceSource: "store" | "median" | null | undefined,
  unitPriceRm: number | null,
): ChecklistPriceSource {
  if (unitPriceRm == null) return null;
  // Older API responses did not carry priceSource; their non-null prices were
  // observed at the selected store.
  return priceSource ?? "store";
}

function checklistItemFromDetail(row: RecommendationDetailRow, index: number): ChecklistItem {
  const current = row.current;
  const quantity = normalizeQuantity(current.quantity);
  const unitPriceRm = normalizeCataloguePrice(current.unitPriceRm);
  return withOriginalValues({
    id: `catalogue-${current.itemId}-${index}`,
    source: "catalogue",
    catalogueItemId: current.itemId,
    itemName: current.itemName,
    itemNameEn: current.itemNameEn ?? null,
    itemNameMs: current.itemNameMs ?? null,
    category: current.category,
    sourceCategory: current.sourceCategory ?? null,
    imageUrl: current.imageUrl || row.basketItem?.imageUrl || row.source.imageUrl || null,
    packageSize: current.packageSize,
    quantity,
    unitPriceRm,
    lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
    actualPriceRm: null,
    actualQuantity: null,
    quantitySource: "planned",
    priceSource: cataloguePriceSource(current.priceSource, unitPriceRm),
    observedDate: current.observedDate ?? null,
    status: "neutral",
  });
}

function checklistItemFromBasketPrice(price: BasketItemPrice, index: number): ChecklistItem {
  const quantity = normalizeQuantity(price.quantity);
  const unitPriceRm = normalizeCataloguePrice(price.unitPriceRm);
  return withOriginalValues({
    id: `catalogue-${price.itemId}-${index}`,
    source: "catalogue",
    catalogueItemId: price.itemId,
    itemName: price.itemName,
    itemNameEn: price.itemNameEn ?? null,
    itemNameMs: price.itemNameMs ?? null,
    category: price.category,
    sourceCategory: price.sourceCategory ?? null,
    packageSize: price.packageSize,
    quantity,
    unitPriceRm,
    lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
    actualPriceRm: null,
    actualQuantity: null,
    quantitySource: "planned",
    priceSource: cataloguePriceSource(price.priceSource, unitPriceRm),
    observedDate: price.priceObservedDate ?? null,
    status: "neutral",
  });
}

/**
 * Creates a frozen checklist snapshot. Replacement-aware detail rows take
 * precedence; basketPrices is the fallback when alternatives are unavailable.
 */
export function createShoppingChecklist(
  store: StoreRecommendation,
  rows: RecommendationDetailRow[] = [],
  options: ChecklistCreationOptions = {},
): ShoppingChecklist {
  const createdAt = options.createdAt ?? nowIso();
  const items = rows.length > 0
    ? rows.map(checklistItemFromDetail)
    : store.basketPrices.map(checklistItemFromBasketPrice);
  const alternativeStoreEstimates: AlternativeStoreEstimate[] = (
    options.alternativeStores ?? []
  )
    .filter(candidate => candidate.premiseId !== store.premiseId)
    .map(candidate => ({
      premiseId: candidate.premiseId,
      name: candidate.name,
      estimatedRoundTripCostRm: money(candidate.estimatedRoundTripCostRm),
      estimatedTotalCostRm: candidate.estimatedTotalCostRm == null
        ? null
        : money(candidate.estimatedTotalCostRm),
    }));

  return {
    version: SHOPPING_CHECKLIST_VERSION,
    id: options.checklistId ?? generatedId("checklist"),
    store: {
      premiseId: store.premiseId,
      premiseCode: store.premiseCode,
      name: store.name,
      address: store.address,
    },
    createdAt,
    updatedAt: createdAt,
    plannedSubtotalRm: store.basketSubtotalRm == null ? null : money(store.basketSubtotalRm),
    estimatedRoundTripCostRm: Number.isFinite(store.estimatedRoundTripCostRm)
      ? money(store.estimatedRoundTripCostRm)
      : null,
    plannedCombinedTotalRm: store.estimatedTotalCostRm == null
      ? null
      : money(store.estimatedTotalCostRm),
    alternativeStoreEstimates,
    estimatedSavings: options.estimatedSavings ?? null,
    // AC 8.2.3: frozen only when the caller knows it, mirroring the pattern
    // used for estimatedSavings so serialised output is unchanged for callers
    // that predate the field.
    ...(options.routeProvider ? { routeProvider: options.routeProvider } : {}),
    items,
  };
}

export function toggleChecklistItemStatus(
  checklist: ShoppingChecklist,
  itemId: string,
  status: Exclude<ChecklistStatus, "neutral">,
  updatedAt = nowIso(),
): ShoppingChecklist {
  const index = checklist.items.findIndex(item => item.id === itemId);
  if (index < 0) return checklist;
  const current = checklist.items[index];
  const nextStatus: ChecklistStatus = current.status === status ? "neutral" : status;
  return {
    ...checklist,
    updatedAt,
    items: checklist.items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, status: nextStatus } : item
    )),
  };
}

function parseQuantity(value: number | string): number | null {
  if (typeof value === "string" && !/^\d+$/.test(value)) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  // AC 5.1.5: any positive whole number is accepted; no upper bound.
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= Number.MAX_SAFE_INTEGER
    ? parsed
    : null;
}

function parseManualUnitPrice(value: number | string): number | null {
  if (typeof value === "string" && !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = parsed * 100;
  if (Math.abs(cents - Math.round(cents)) > 1e-8) return null;
  return money(parsed);
}

export function validateManualChecklistItem(
  input: ManualChecklistItemInput,
): ManualChecklistItemValidation {
  const itemName = input.itemName.trim();
  const quantity = parseQuantity(input.quantity);
  // AC 5.1.5: the price may be left blank when the shopper does not know it
  // yet; a blank string means "unknown", not an error. A provided price must
  // still be a positive amount with no more than two decimals.
  const priceIsBlank = input.unitPriceRm == null
    || (typeof input.unitPriceRm === "string" && input.unitPriceRm.trim() === "");
  const unitPriceRm = priceIsBlank ? null : parseManualUnitPrice(input.unitPriceRm!);
  const errors: ManualChecklistItemErrors = {};
  if (!itemName) errors.itemName = "required";
  if (quantity == null) errors.quantity = "invalid";
  if (!priceIsBlank && unitPriceRm == null) errors.unitPriceRm = "invalid";
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    value: { itemName, quantity: quantity!, unitPriceRm },
  };
}

export function addManualChecklistItem(
  checklist: ShoppingChecklist,
  input: ManualChecklistItemInput,
  options: AddManualItemOptions = {},
): ShoppingChecklist | null {
  const validation = validateManualChecklistItem(input);
  if (!validation.success) return null;
  const { itemName, quantity, unitPriceRm } = validation.value;
  const item: ChecklistItem = withOriginalValues({
    id: options.itemId ?? generatedId("manual"),
    source: "manual",
    catalogueItemId: null,
    itemName,
    itemNameEn: null,
    itemNameMs: null,
    category: null,
    sourceCategory: null,
    packageSize: null,
    quantity,
    unitPriceRm,
    lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
    actualPriceRm: null,
    actualQuantity: null,
    quantitySource: "planned",
    priceSource: "manual",
    observedDate: null,
    status: "neutral",
  });
  return {
    ...checklist,
    updatedAt: options.updatedAt ?? nowIso(),
    items: [...checklist.items, item],
  };
}

export function editChecklistItem(
  checklist: ShoppingChecklist,
  itemId: string,
  input: ManualChecklistItemInput,
  updatedAt = nowIso(),
): ShoppingChecklist | null {
  const index = checklist.items.findIndex(item => item.id === itemId);
  const validation = validateManualChecklistItem(input);
  if (index < 0 || !validation.success) return null;
  const { itemName, quantity, unitPriceRm } = validation.value;
  return {
    ...checklist,
    updatedAt,
    items: checklist.items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      source: "manual",
      catalogueItemId: null,
      itemName,
      itemNameEn: null,
      itemNameMs: null,
      quantity,
      unitPriceRm,
      lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
      priceSource: "manual",
      observedDate: null,
    } : item),
  };
}

export type ChecklistEditableField = "itemName" | "quantity" | "unitPriceRm";

/** The single price and quantity presented in the checklist row. */
export function effectiveChecklistUnitPrice(item: ChecklistItem): number | null {
  return item.actualPriceRm ?? item.unitPriceRm;
}

export function effectiveChecklistQuantity(item: ChecklistItem): number {
  return item.actualQuantity ?? item.quantity;
}

export function effectiveChecklistLineTotal(item: ChecklistItem): number | null {
  const price = effectiveChecklistUnitPrice(item);
  return price == null ? null : money(price * effectiveChecklistQuantity(item));
}

export function updateChecklistItemField(
  checklist: ShoppingChecklist,
  itemId: string,
  field: ChecklistEditableField,
  raw: string,
  updatedAt = nowIso(),
): ShoppingChecklist | null {
  const item = checklist.items.find(candidate => candidate.id === itemId);
  if (!item) return null;
  const next: ChecklistItem = { ...item, originalValues: item.originalValues ?? originalValues(item) };
  if (field === "itemName") {
    const name = raw.trim();
    if (!name) return null;
    if (name === item.itemName) return checklist;
    next.itemName = name;
    next.itemNameEn = name === next.originalValues?.itemName ? next.originalValues.itemNameEn : null;
    next.itemNameMs = name === next.originalValues?.itemName ? next.originalValues.itemNameMs : null;
  } else if (field === "quantity") {
    const quantity = parseQuantity(raw);
    if (quantity == null) return null;
    if (quantity === effectiveChecklistQuantity(item)) return checklist;
    next.quantity = quantity;
    next.actualQuantity = null;
    next.quantitySource = "planned";
  } else {
    const price = raw.trim() === "" ? null : parseManualUnitPrice(raw);
    if (raw.trim() !== "" && price == null) return null;
    if (price === effectiveChecklistUnitPrice(item)) return checklist;
    next.unitPriceRm = price;
    next.actualPriceRm = null;
    next.priceSource = price === next.originalValues?.unitPriceRm
      ? next.originalValues.priceSource
      : price == null && item.source === "catalogue" ? null : "manual";
    next.observedDate = price === next.originalValues?.unitPriceRm ? next.originalValues.observedDate : null;
  }
  next.lineTotalRm = effectiveChecklistLineTotal(next);
  return {
    ...checklist,
    updatedAt,
    items: checklist.items.map(candidate => candidate.id === itemId ? next : candidate),
  };
}

/** Apply the edit dialog atomically while preserving catalogue identity. */
export function editChecklistValues(
  checklist: ShoppingChecklist,
  itemId: string,
  input: ManualChecklistItemInput,
): ShoppingChecklist | null {
  const validation = validateManualChecklistItem(input);
  if (!validation.success || !checklist.items.some(item => item.id === itemId)) return null;
  const { itemName, quantity, unitPriceRm } = validation.value;
  const fields: [ChecklistEditableField, string][] = [
    ["itemName", itemName], ["quantity", String(quantity)], ["unitPriceRm", unitPriceRm == null ? "" : String(unitPriceRm)],
  ];
  return fields.reduce((current, [field, value]) => updateChecklistItemField(current, itemId, field, value) ?? current, checklist);
}

export function revertChecklistItem(
  checklist: ShoppingChecklist,
  itemId: string,
  updatedAt = nowIso(),
): ShoppingChecklist {
  const item = checklist.items.find(candidate => candidate.id === itemId);
  if (!item?.originalValues) return checklist;
  const original = item.originalValues;
  const restored: ChecklistItem = {
    ...item,
    ...original,
    actualPriceRm: null,
    actualQuantity: null,
    quantitySource: "planned",
    lineTotalRm: original.unitPriceRm == null ? null : money(original.unitPriceRm * original.quantity),
  };
  if (JSON.stringify(restored) === JSON.stringify(item)) return checklist;
  return {
    ...checklist,
    updatedAt,
    items: checklist.items.map(candidate => candidate.id === itemId ? restored : candidate),
  };
}

export function boughtChecklistTotal(checklist: ShoppingChecklist): number | null {
  const totals = checklist.items
    .filter(item => item.status === "bought")
    .map(effectiveChecklistLineTotal)
    .filter((value): value is number => value != null);
  return totals.length === 0 ? null : money(totals.reduce((sum, value) => sum + value, 0));
}

/**
 * AC 5.3.1: validates an actual unit price typed by the shopper. A blank
 * input clears the recorded price (success with null); anything else must be
 * a positive amount with no more than two decimals.
 */
export function validateActualUnitPrice(
  input: string,
): { success: true; value: number | null } | { success: false } {
  const trimmed = input.trim();
  if (trimmed === "") return { success: true, value: null };
  const parsed = parseManualUnitPrice(trimmed);
  return parsed == null ? { success: false } : { success: true, value: parsed };
}

/**
 * AC 5.3.1/5.3.2: records or clears the shopper-observed unit price on a
 * Purchased line. The official/reference price fields are never touched.
 * Returns null when the line does not exist or is not marked bought.
 */
export function setChecklistItemActualPrice(
  checklist: ShoppingChecklist,
  itemId: string,
  actualPriceRm: number | null,
  updatedAt = nowIso(),
): ShoppingChecklist | null {
  const index = checklist.items.findIndex(item => item.id === itemId);
  if (index < 0) return null;
  const target = checklist.items[index];
  if (target.status !== "bought") return null;
  if (actualPriceRm != null && (!Number.isFinite(actualPriceRm) || actualPriceRm <= 0)) return null;
  const normalized = actualPriceRm == null ? null : money(actualPriceRm);
  if (target.actualPriceRm === normalized) return checklist;
  return {
    ...checklist,
    updatedAt,
    items: checklist.items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, actualPriceRm: normalized } : item
    )),
  };
}

/**
 * AC 5.3.3: the actual line total exists only while an actual unit price is
 * recorded; a cleared/unknown price yields null (rendered blank, never 0.00).
 * The quantity is the shopper-recorded actual quantity when present (AC
 * 5.3.4), otherwise the planned quantity.
 */
export function actualLineTotalRm(item: ChecklistItem): number | null {
  return item.actualPriceRm == null
    ? null
    : money(item.actualPriceRm * (item.actualQuantity ?? item.quantity));
}

/**
 * AC 5.3.4: validates an actual quantity typed by the shopper. A blank input
 * means "use the planned quantity" (success with null); anything else must be
 * a positive whole number (same rule as AC 5.1.5).
 */
export function validateActualQuantity(
  input: string,
): { success: true; value: number | null } | { success: false } {
  const trimmed = input.trim();
  if (trimmed === "") return { success: true, value: null };
  const parsed = parseQuantity(trimmed);
  return parsed == null ? { success: false } : { success: true, value: parsed };
}

/**
 * AC 5.3.4: records or clears the actual quantity on a Purchased line and
 * marks the quantity source planned/actual accordingly. Returns null when the
 * line does not exist or is not marked bought.
 */
export function setChecklistItemActualQuantity(
  checklist: ShoppingChecklist,
  itemId: string,
  actualQuantity: number | null,
  updatedAt = nowIso(),
): ShoppingChecklist | null {
  const index = checklist.items.findIndex(item => item.id === itemId);
  if (index < 0) return null;
  const target = checklist.items[index];
  if (target.status !== "bought") return null;
  if (actualQuantity != null
    && (!Number.isInteger(actualQuantity)
      || actualQuantity < 1
      || actualQuantity > Number.MAX_SAFE_INTEGER)) return null;
  const nextSource: ChecklistQuantitySource = actualQuantity == null ? "planned" : "actual";
  if (target.actualQuantity === actualQuantity && target.quantitySource === nextSource) {
    return checklist;
  }
  return {
    ...checklist,
    updatedAt,
    items: checklist.items.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, actualQuantity: actualQuantity ?? null, quantitySource: nextSource }
        : item
    )),
  };
}

export function deleteChecklistItem(
  checklist: ShoppingChecklist,
  itemId: string,
  updatedAt = nowIso(),
): ShoppingChecklist {
  if (!checklist.items.some(item => item.id === itemId)) return checklist;
  return {
    ...checklist,
    updatedAt,
    items: checklist.items.filter(candidate => candidate.id !== itemId),
  };
}

export function plannedChecklistSubtotal(checklist: ShoppingChecklist): number | null {
  const pricedLines = checklist.items
    .map(item => item.lineTotalRm)
    .filter((value): value is number => value != null);
  return pricedLines.length > 0
    ? money(pricedLines.reduce((total, value) => total + value, 0))
    : null;
}

export function checklistProgress(checklist: ShoppingChecklist): ChecklistProgress {
  const bought = checklist.items.filter(item => item.status === "bought").length;
  const notBought = checklist.items.filter(item => item.status === "not_bought").length;
  const total = checklist.items.length;
  // A red "not bought" choice records the outcome but does not count towards
  // the shopping-completion indicator.
  const completed = bought;
  return {
    total,
    completed,
    bought,
    notBought,
    neutral: total - bought - notBought,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFiniteMoneyOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isChecklistItem(value: unknown): value is ChecklistItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const sourceIsValid = item.source === "catalogue" || item.source === "manual";
  const statusIsValid = item.status === "neutral" || item.status === "bought"
    || item.status === "not_bought";
  const priceSourceIsValid = item.priceSource === null
    || item.priceSource === "store"
    || item.priceSource === "median"
    || item.priceSource === "manual";
  const commonFieldsAreValid = typeof item.id === "string"
    && item.id.length > 0
    && sourceIsValid
    && isNullableString(item.catalogueItemId)
    && typeof item.itemName === "string"
    && item.itemName.trim().length > 0
    && isNullableString(item.itemNameEn)
    && isNullableString(item.itemNameMs)
    && (item.category === null || isItemCategory(item.category))
    && (item.sourceCategory === undefined || item.sourceCategory === null || isSourceCategory(item.sourceCategory))
    && (item.imageUrl === undefined || isNullableString(item.imageUrl))
    && isNullableString(item.packageSize)
    && typeof item.quantity === "number"
    && Number.isInteger(item.quantity)
    && item.quantity >= 1
    && isFiniteMoneyOrNull(item.unitPriceRm)
    && isFiniteMoneyOrNull(item.lineTotalRm)
    && (item.actualPriceRm === null
      || (typeof item.actualPriceRm === "number" && item.actualPriceRm > 0))
    && (item.actualQuantity === null
      || (typeof item.actualQuantity === "number"
        && Number.isInteger(item.actualQuantity)
        && item.actualQuantity >= 1))
    && (item.quantitySource === "planned" || item.quantitySource === "actual")
    && priceSourceIsValid
    && isNullableString(item.observedDate)
    && statusIsValid
    && (item.originalValues === undefined || isOriginalValues(item.originalValues));
  if (!commonFieldsAreValid) return false;

  if ((item.unitPriceRm === null) !== (item.lineTotalRm === null)) return false;
  // AC 5.3.4: a recorded actual quantity must carry the "actual" source, and
  // a cleared one must fall back to "planned".
  if ((item.actualQuantity === null) !== (item.quantitySource === "planned")) return false;
  if (item.source === "manual") {
    return item.catalogueItemId === null
      && item.category === null
      && (item.sourceCategory === undefined || item.sourceCategory === null)
      && item.priceSource === "manual"
      && (item.unitPriceRm === null
        || (typeof item.unitPriceRm === "number" && item.unitPriceRm > 0))
      && item.observedDate === null;
  }
  return typeof item.catalogueItemId === "string"
    && item.catalogueItemId.length > 0
    && (item.unitPriceRm === null ? item.priceSource === null : item.priceSource !== null);
}

function isOriginalValues(value: unknown): value is ChecklistOriginalValues {
  if (!value || typeof value !== "object") return false;
  const original = value as Record<string, unknown>;
  return typeof original.itemName === "string"
    && original.itemName.trim().length > 0
    && isNullableString(original.itemNameEn)
    && isNullableString(original.itemNameMs)
    && typeof original.quantity === "number"
    && Number.isInteger(original.quantity)
    && original.quantity >= 1
    && isFiniteMoneyOrNull(original.unitPriceRm)
    && (original.priceSource === null || original.priceSource === "store"
      || original.priceSource === "median" || original.priceSource === "manual")
    && isNullableString(original.observedDate);
}

function isAlternativeStoreEstimate(value: unknown): value is AlternativeStoreEstimate {
  if (!value || typeof value !== "object") return false;
  const estimate = value as Record<string, unknown>;
  return typeof estimate.premiseId === "string"
    && estimate.premiseId.length > 0
    && typeof estimate.name === "string"
    && estimate.name.length > 0
    && typeof estimate.estimatedRoundTripCostRm === "number"
    && Number.isFinite(estimate.estimatedRoundTripCostRm)
    && estimate.estimatedRoundTripCostRm >= 0
    && isFiniteMoneyOrNull(estimate.estimatedTotalCostRm);
}

export function isShoppingChecklist(value: unknown): value is ShoppingChecklist {
  if (!value || typeof value !== "object") return false;
  const checklist = value as Record<string, unknown>;
  if (checklist.version !== SHOPPING_CHECKLIST_VERSION
    || typeof checklist.id !== "string"
    || checklist.id.length === 0
    || !isIsoDate(checklist.createdAt)
    || !isIsoDate(checklist.updatedAt)
    || !isFiniteMoneyOrNull(checklist.plannedSubtotalRm)
    || !isFiniteMoneyOrNull(checklist.estimatedRoundTripCostRm)
    || !isFiniteMoneyOrNull(checklist.plannedCombinedTotalRm)
    || !Array.isArray(checklist.alternativeStoreEstimates)
    || !checklist.alternativeStoreEstimates.every(isAlternativeStoreEstimate)
    || (checklist.estimatedSavings !== undefined
      && checklist.estimatedSavings !== null
      && !isEstimatedSavingsSnapshot(checklist.estimatedSavings))
    // AC 8.2.3 / AC 5.5.4: optional provenance. Absent is valid (records
    // predate it); present must be one of the two known providers, so a
    // corrupt value is rejected rather than silently trusted.
    || (checklist.routeProvider !== undefined
      && checklist.routeProvider !== "google"
      && checklist.routeProvider !== "straight_line")
    || !Array.isArray(checklist.items)
    || !checklist.items.every(isChecklistItem)) return false;

  if (!checklist.store || typeof checklist.store !== "object") return false;
  const store = checklist.store as Record<string, unknown>;
  return typeof store.premiseId === "string"
    && store.premiseId.length > 0
    && typeof store.premiseCode === "string"
    && typeof store.name === "string"
    && store.name.length > 0
    && isNullableString(store.address);
}

export function serializeShoppingChecklist(checklist: ShoppingChecklist): string {
  return JSON.stringify(checklist);
}

/**
 * Upgrade supported local versions to the single-price row model. Legacy
 * price and quantity overrides become the visible row values, while the
 * starting values are kept for Revert. Missing optional price dates become
 * null. Unknown versions are dropped safely.
 */
export function migrateShoppingChecklist(raw: unknown): ShoppingChecklist | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  // Preserve every supported local version; only unknown envelopes are dropped.
  if (candidate.version !== 1
    && candidate.version !== 2
    && candidate.version !== 3
    && candidate.version !== 4
    && candidate.version !== 5
    && candidate.version !== SHOPPING_CHECKLIST_VERSION) return null;
  const normalized = {
    ...candidate,
    version: SHOPPING_CHECKLIST_VERSION,
    plannedSubtotalRm: candidate.plannedSubtotalRm ?? null,
    estimatedRoundTripCostRm: candidate.estimatedRoundTripCostRm ?? null,
    plannedCombinedTotalRm: candidate.plannedCombinedTotalRm ?? null,
    // Missing entirely (legacy payloads) → empty list; a present-but-malformed
    // value is left as-is so validation rejects it instead of hiding corruption.
    alternativeStoreEstimates: candidate.alternativeStoreEstimates ?? [],
    items: Array.isArray(candidate.items)
      ? candidate.items.map(item => {
          if (!item || typeof item !== "object") return item;
          const legacy = item as Record<string, unknown>;
          const base: Record<string, unknown> = {
            actualPriceRm: null,
            actualQuantity: null,
            quantitySource: "planned",
            ...legacy,
            ...(candidate.version === SHOPPING_CHECKLIST_VERSION ? {} : {
              category: legacy.category === undefined ? null : legacy.category,
            }),
            observedDate: legacy.observedDate ?? null,
            originalValues: legacy.originalValues && typeof legacy.originalValues === "object"
              ? { ...legacy.originalValues as Record<string, unknown>, observedDate: (legacy.originalValues as Record<string, unknown>).observedDate ?? null }
              : legacy.originalValues,
            status: legacy.status === "out_of_stock" ? "not_bought" : legacy.status,
          };
          if (candidate.version === SHOPPING_CHECKLIST_VERSION) return base;
          const quantity = typeof base.actualQuantity === "number"
            ? base.actualQuantity : base.quantity;
          const unitPriceRm = typeof base.actualPriceRm === "number"
            ? base.actualPriceRm : base.unitPriceRm;
          return {
            ...base,
            originalValues: {
              itemName: base.itemName,
              itemNameEn: base.itemNameEn,
              itemNameMs: base.itemNameMs,
              quantity: base.quantity,
              unitPriceRm: base.unitPriceRm,
              priceSource: base.priceSource,
              observedDate: base.observedDate,
            },
            quantity,
            unitPriceRm,
            lineTotalRm: typeof unitPriceRm === "number" && typeof quantity === "number"
              ? money(unitPriceRm * quantity) : null,
            priceSource: typeof base.actualPriceRm === "number" ? "manual" : base.priceSource,
            observedDate: typeof base.actualPriceRm === "number" ? null : base.observedDate,
            actualPriceRm: null,
            actualQuantity: null,
            quantitySource: "planned",
          };
        })
      : candidate.items,
  };
  return isShoppingChecklist(normalized) ? normalized : null;
}

export function parseShoppingChecklist(serialized: string | null | undefined): ShoppingChecklist | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    return migrateShoppingChecklist(value);
  } catch {
    return null;
  }
}
