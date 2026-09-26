import type {
  AlternativeStoreEstimate,
  ChecklistItem,
  ChecklistItemSource,
  ChecklistPriceSource,
  ChecklistQuantitySource,
  ChecklistStatus,
  ChecklistStore,
  ShoppingChecklist,
} from "./shopping-checklist";
import { effectiveChecklistLineTotal } from "./shopping-checklist";
import { isItemCategory, isSourceCategory, type ItemCategory, type SourceCategory } from "./contracts";
import {
  isEstimatedSavingsSnapshot,
  type EstimatedSavingsSnapshot,
} from "./estimated-savings";

export const TRIP_HISTORY_VERSION = 3 as const;
export const TRIP_HISTORY_STORAGE_KEY = "smartcart.trip-history.v1";

/**
 * AC 5.4.1: one frozen line of a recorded trip. Every catalogue and custom
 * line is kept with its outcome; custom lines keep the name the shopper typed
 * and stay marked source="manual" (shopper-added) — they are never matched to
 * an official catalogue item (catalogueItemId stays null).
 */
export interface TripRecordLine {
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
  // Planned quantity plus the shopper-recorded actual quantity (AC 5.3.4);
  // quantitySource says which one the spending figure used.
  quantity: number;
  actualQuantity: number | null;
  quantitySource: ChecklistQuantitySource;
  // The visible catalogue or shopper-edited price at record time.
  unitPriceRm: number | null;
  priceSource: ChecklistPriceSource;
  observedDate: string | null;
  actualPriceRm: number | null;
  // Frozen bought-line total; null for unbought or unpriced lines.
  actualLineTotalRm: number | null;
  // AC 5.2.3: "neutral" lines were still unfinished when the trip was
  // recorded; they stay in the record labelled with their outcome.
  status: ChecklistStatus;
}

export interface TripRecord {
  version: typeof TRIP_HISTORY_VERSION;
  id: string;
  // AC 5.4.1: date and time of the save.
  recordedAt: string;
  checklistId: string;
  store: ChecklistStore;
  // Planned metadata (AC 5.4.2): the estimated return transport is kept here
  // as planned data only — it is never counted as money the shopper spent.
  plannedSubtotalRm: number | null;
  estimatedRoundTripCostRm: number | null;
  plannedCombinedTotalRm: number | null;
  alternativeStoreEstimates: AlternativeStoreEstimate[];
  // Optional for records created before the unified savings summary shipped.
  estimatedSavings?: EstimatedSavingsSnapshot | null;
  // Sum of priced bought lines; null when none has a price.
  actualTotalRm: number | null;
  // AC 8.2.3: how the frozen travel estimates were produced. Copied from the
  // checklist so an old trip can still disclose that its travel figure came
  // from the straight-line fallback (the recommendation response, and its
  // routeWarning, are long gone by review time). Optional: trips frozen before
  // this field existed carry no provenance and must still validate.
  routeProvider?: "google" | "straight_line";
  lines: TripRecordLine[];
}

interface TripHistoryEnvelope {
  version: typeof TRIP_HISTORY_VERSION;
  records: TripRecord[];
}

interface BuildTripRecordOptions {
  recordId?: string;
  recordedAt?: string;
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

export type BoughtLineTotalInput = Pick<
  TripRecordLine,
  "actualQuantity" | "quantity" | "actualPriceRm" | "unitPriceRm"
>;

export function boughtLineQuantity(line: Pick<TripRecordLine, "actualQuantity" | "quantity">): number {
  return line.actualQuantity ?? line.quantity;
}

export function boughtLineUnitPrice(line: Pick<TripRecordLine, "actualPriceRm" | "unitPriceRm">): number | null {
  return line.actualPriceRm ?? line.unitPriceRm;
}

export function boughtLineTotalRm(line: BoughtLineTotalInput): number | null {
  const unitPrice = boughtLineUnitPrice(line);
  return unitPrice == null ? null : money(unitPrice * boughtLineQuantity(line));
}

/** Sum priced bought lines, regardless of whether the shopper edited a price. */
export function actualExpenseTotal(lines: TripRecordLine[]): number | null {
  const knownTotals = lines
    .filter(line => line.status === "bought")
    .map(boughtLineTotalRm)
    .filter((value): value is number => value != null);
  return knownTotals.length > 0
    ? money(knownTotals.reduce((total, value) => total + value, 0))
    : null;
}

function tripRecordLineFromChecklistItem(item: ChecklistItem): TripRecordLine {
  return {
    id: item.id,
    source: item.source,
    catalogueItemId: item.source === "manual" ? null : item.catalogueItemId,
    itemName: item.itemName,
    itemNameEn: item.itemNameEn,
    itemNameMs: item.itemNameMs,
    category: item.category,
    sourceCategory: item.sourceCategory ?? null,
    ...(item.imageUrl !== undefined ? { imageUrl: item.imageUrl } : {}),
    packageSize: item.packageSize,
    quantity: item.quantity,
    actualQuantity: item.actualQuantity,
    quantitySource: item.quantitySource,
    unitPriceRm: item.unitPriceRm,
    priceSource: item.priceSource,
    observedDate: item.observedDate,
    actualPriceRm: item.actualPriceRm,
    actualLineTotalRm: item.status === "bought" ? effectiveChecklistLineTotal(item) : null,
    status: item.status,
  };
}

/**
 * AC 5.4.1: freezes the current checklist into an immutable expense record.
 * The checklist itself is never mutated; the record is a deep copy.
 */
export function buildTripRecord(
  checklist: ShoppingChecklist,
  options: BuildTripRecordOptions = {},
): TripRecord {
  const lines = checklist.items.map(tripRecordLineFromChecklistItem);
  return {
    version: TRIP_HISTORY_VERSION,
    id: options.recordId ?? generatedId("trip"),
    recordedAt: options.recordedAt ?? nowIso(),
    checklistId: checklist.id,
    store: { ...checklist.store },
    plannedSubtotalRm: checklist.plannedSubtotalRm,
    estimatedRoundTripCostRm: checklist.estimatedRoundTripCostRm,
    plannedCombinedTotalRm: checklist.plannedCombinedTotalRm,
    alternativeStoreEstimates: checklist.alternativeStoreEstimates.map(estimate => ({
      ...estimate,
    })),
    estimatedSavings: checklist.estimatedSavings
      ? { ...checklist.estimatedSavings }
      : null,
    actualTotalRm: actualExpenseTotal(lines),
    // AC 8.2.3: carry the frozen route provenance onto the record, but only
    // when the checklist actually knew it (mirrors createShoppingChecklist so
    // serialised output is unchanged for callers that predate it).
    ...(checklist.routeProvider ? { routeProvider: checklist.routeProvider } : {}),
    lines,
  };
}

/** Newest first: a freshly recorded trip is prepended. */
export function addTripRecord(records: TripRecord[], record: TripRecord): TripRecord[] {
  return [record, ...records];
}

/** Remove one saved trip while preserving the order of all remaining records. */
export function removeTripRecord(records: TripRecord[], recordId: string): TripRecord[] {
  return records.filter(record => record.id !== recordId);
}

/** Newest first by recordedAt, stable for equal timestamps. */
export function listTripRecords(records: TripRecord[]): TripRecord[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const byDate = Date.parse(b.record.recordedAt) - Date.parse(a.record.recordedAt);
      return byDate !== 0 ? byDate : a.index - b.index;
    })
    .map(entry => entry.record);
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

function isTripRecordLine(value: unknown): value is TripRecordLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  const sourceIsValid = line.source === "catalogue" || line.source === "manual";
  const statusIsValid = line.status === "neutral" || line.status === "bought"
    || line.status === "not_bought";
  const priceSourceIsValid = line.priceSource === null
    || line.priceSource === "store"
    || line.priceSource === "median"
    || line.priceSource === "manual";
  const commonFieldsAreValid = typeof line.id === "string"
    && line.id.length > 0
    && sourceIsValid
    && isNullableString(line.catalogueItemId)
    && typeof line.itemName === "string"
    && line.itemName.trim().length > 0
    && isNullableString(line.itemNameEn)
    && isNullableString(line.itemNameMs)
    && (line.category === null || isItemCategory(line.category))
    && (line.sourceCategory === undefined || line.sourceCategory === null || isSourceCategory(line.sourceCategory))
    && (line.imageUrl === undefined || isNullableString(line.imageUrl))
    && isNullableString(line.packageSize)
    && typeof line.quantity === "number"
    && Number.isInteger(line.quantity)
    && line.quantity >= 1
    && (line.actualQuantity === null
      || (typeof line.actualQuantity === "number"
        && Number.isInteger(line.actualQuantity)
        && line.actualQuantity >= 1))
    && (line.quantitySource === "planned" || line.quantitySource === "actual")
    && isFiniteMoneyOrNull(line.unitPriceRm)
    && priceSourceIsValid
    && isNullableString(line.observedDate)
    && (line.actualPriceRm === null
      || (typeof line.actualPriceRm === "number" && line.actualPriceRm > 0))
    && isFiniteMoneyOrNull(line.actualLineTotalRm)
    && statusIsValid;
  if (!commonFieldsAreValid) return false;
  // The quantity source label must agree with the actual quantity (AC 5.3.4).
  if ((line.actualQuantity === null) !== (line.quantitySource === "planned")) return false;
  if (line.source === "manual") {
    // Shopper-added lines are never matched to an official item (AC 5.4.1).
    return line.catalogueItemId === null && line.priceSource === "manual" && line.category === null
      && (line.sourceCategory === undefined || line.sourceCategory === null);
  }
  return typeof line.catalogueItemId === "string" && line.catalogueItemId.length > 0;
}

export function isTripRecord(value: unknown): value is TripRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.version !== TRIP_HISTORY_VERSION
    || typeof record.id !== "string"
    || record.id.length === 0
    || !isIsoDate(record.recordedAt)
    || typeof record.checklistId !== "string"
    || record.checklistId.length === 0
    || !isFiniteMoneyOrNull(record.plannedSubtotalRm)
    || !isFiniteMoneyOrNull(record.estimatedRoundTripCostRm)
    || !isFiniteMoneyOrNull(record.plannedCombinedTotalRm)
    || !Array.isArray(record.alternativeStoreEstimates)
    || !record.alternativeStoreEstimates.every(isAlternativeStoreEstimate)
    || (record.estimatedSavings !== undefined
      && record.estimatedSavings !== null
      && !isEstimatedSavingsSnapshot(record.estimatedSavings))
    || !isFiniteMoneyOrNull(record.actualTotalRm)
    || !Array.isArray(record.lines)
    || !record.lines.every(isTripRecordLine)) return false;

  if (!record.store || typeof record.store !== "object") return false;
  const store = record.store as Record<string, unknown>;
  return typeof store.premiseId === "string"
    && store.premiseId.length > 0
    && typeof store.premiseCode === "string"
    && typeof store.name === "string"
    && store.name.length > 0
    && isNullableString(store.address);
}

/**
 * AC 5.5.4: the record format is versioned. Records whose version or shape is
 * unknown are ignored individually — one bad record never crashes the app or
 * hides the healthy ones, and totals are never invented.
 */
export function migrateTripHistory(raw: unknown): TripRecord[] {
  if (!raw || typeof raw !== "object") return [];
  const envelope = raw as Record<string, unknown>;
  if ((envelope.version !== 1 && envelope.version !== 2 && envelope.version !== TRIP_HISTORY_VERSION)
    || !Array.isArray(envelope.records)) return [];
  return envelope.records
    .map(record => {
      if (!record || typeof record !== "object") return record;
      const candidate = record as Record<string, unknown>;
      if (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== TRIP_HISTORY_VERSION) return record;
      if (!Array.isArray(candidate.lines)) return record;
      // Out-of-stock registration was abolished: legacy out_of_stock lines
      // degrade to not_bought instead of dropping the whole record.
      return {
        ...candidate,
        version: TRIP_HISTORY_VERSION,
        lines: candidate.lines.map(line => {
          if (!line || typeof line !== "object") return line;
          const fields = line as Record<string, unknown>;
          return {
            ...fields,
            ...(candidate.version === TRIP_HISTORY_VERSION ? {} : {
              category: fields.category === undefined ? null : fields.category,
            }),
            observedDate: fields.observedDate ?? null,
            status: fields.status === "out_of_stock" ? "not_bought" : fields.status,
          };
        }),
      };
    })
    .filter(isTripRecord)
    .map(record => {
      const lines = record.lines.map(line => ({
        ...line,
        actualLineTotalRm: line.status === "bought" ? boughtLineTotalRm(line) : null,
      }));
      return { ...record, lines, actualTotalRm: actualExpenseTotal(lines) };
    });
}

export function serializeTripHistory(records: TripRecord[]): string {
  const envelope: TripHistoryEnvelope = { version: TRIP_HISTORY_VERSION, records };
  return JSON.stringify(envelope);
}

export function parseTripHistory(serialized: string | null | undefined): TripRecord[] {
  if (!serialized) return [];
  try {
    const value: unknown = JSON.parse(serialized);
    return migrateTripHistory(value);
  } catch {
    return [];
  }
}
