import type { BasketItemPrice, StoreRecommendation } from "./contracts";
import type { RecommendationDetailRow } from "./recommendation-detail";

export const SHOPPING_CHECKLIST_VERSION = 1 as const;
export const SHOPPING_CHECKLIST_STORAGE_KEY = "smartcart.shopping-checklist.v1";

export type ChecklistStatus = "neutral" | "bought" | "not_bought" | "out_of_stock";
export type ChecklistPriceSource = "store" | "median" | "manual" | null;
export type ChecklistItemSource = "catalogue" | "manual";

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
  packageSize: string | null;
  quantity: number;
  unitPriceRm: number | null;
  lineTotalRm: number | null;
  priceSource: ChecklistPriceSource;
  observedDate: string | null;
  status: ChecklistStatus;
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
  outOfStock: number;
  neutral: number;
  percent: number;
}

interface ChecklistCreationOptions {
  checklistId?: string;
  createdAt?: string;
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
  return {
    id: `catalogue-${current.itemId}-${index}`,
    source: "catalogue",
    catalogueItemId: current.itemId,
    itemName: current.itemName,
    itemNameEn: current.itemNameEn ?? null,
    itemNameMs: current.itemNameMs ?? null,
    packageSize: current.packageSize,
    quantity,
    unitPriceRm,
    lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
    priceSource: cataloguePriceSource(current.priceSource, unitPriceRm),
    observedDate: current.observedDate,
    status: "neutral",
  };
}

function checklistItemFromBasketPrice(price: BasketItemPrice, index: number): ChecklistItem {
  const quantity = normalizeQuantity(price.quantity);
  const unitPriceRm = normalizeCataloguePrice(price.unitPriceRm);
  return {
    id: `catalogue-${price.itemId}-${index}`,
    source: "catalogue",
    catalogueItemId: price.itemId,
    itemName: price.itemName,
    itemNameEn: price.itemNameEn ?? null,
    itemNameMs: price.itemNameMs ?? null,
    packageSize: price.packageSize,
    quantity,
    unitPriceRm,
    lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
    priceSource: cataloguePriceSource(price.priceSource, unitPriceRm),
    observedDate: price.priceObservedDate,
    status: "neutral",
  };
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
  const item: ChecklistItem = {
    id: options.itemId ?? generatedId("manual"),
    source: "manual",
    catalogueItemId: null,
    itemName,
    itemNameEn: null,
    itemNameMs: null,
    packageSize: null,
    quantity,
    unitPriceRm,
    lineTotalRm: unitPriceRm == null ? null : money(unitPriceRm * quantity),
    priceSource: "manual",
    observedDate: null,
    status: "neutral",
  };
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
  const outOfStock = checklist.items.filter(item => item.status === "out_of_stock").length;
  const total = checklist.items.length;
  // A red "not bought" choice records the outcome but does not count towards
  // the shopping-completion indicator.
  const completed = bought;
  return {
    total,
    completed,
    bought,
    notBought,
    outOfStock,
    neutral: total - bought - notBought - outOfStock,
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
    || item.status === "not_bought" || item.status === "out_of_stock";
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
    && isNullableString(item.packageSize)
    && typeof item.quantity === "number"
    && Number.isInteger(item.quantity)
    && item.quantity >= 1
    && isFiniteMoneyOrNull(item.unitPriceRm)
    && isFiniteMoneyOrNull(item.lineTotalRm)
    && priceSourceIsValid
    && isNullableString(item.observedDate)
    && statusIsValid;
  if (!commonFieldsAreValid) return false;

  if ((item.unitPriceRm === null) !== (item.lineTotalRm === null)) return false;
  if (item.source === "manual") {
    return item.catalogueItemId === null
      && item.priceSource === "manual"
      && (item.unitPriceRm === null
        || (typeof item.unitPriceRm === "number" && item.unitPriceRm > 0))
      && item.observedDate === null;
  }
  return typeof item.catalogueItemId === "string"
    && item.catalogueItemId.length > 0
    && item.priceSource !== "manual"
    && (item.unitPriceRm === null ? item.priceSource === null : item.priceSource !== null);
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
 * Migration chain entry point (D5.0). v1 payloads written before the planned
 * totals existed are filled with null; unknown versions are dropped safely.
 * The first real version-to-version migration lands with the v2 envelope.
 */
export function migrateShoppingChecklist(raw: unknown): ShoppingChecklist | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== SHOPPING_CHECKLIST_VERSION) return null;
  const normalized = {
    ...candidate,
    plannedSubtotalRm: candidate.plannedSubtotalRm ?? null,
    estimatedRoundTripCostRm: candidate.estimatedRoundTripCostRm ?? null,
    plannedCombinedTotalRm: candidate.plannedCombinedTotalRm ?? null,
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
