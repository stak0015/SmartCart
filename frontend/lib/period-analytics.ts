import {
  ITEM_CATEGORY_IDS,
  ITEM_CATEGORY_SPENDING_CLASS,
  type ItemCategoryId,
  type ItemCategorySpendingClass,
  type SourceCategory,
} from "./contracts";
import { boughtLineTotalRm, type BoughtLineTotalInput } from "./trip-history";

export type AnalyticsCadence = "weekly" | "monthly";

export interface AnalyticsTripLine extends BoughtLineTotalInput {
  status: string;
  category: { id: string } | null;
  sourceCategory?: SourceCategory | null;
}

export interface AnalyticsSavingsSnapshot {
  storeChoiceImpactRm?: number | null;
  itemChangeImpactRm?: number | null;
  netSavingRm?: number | null;
}

export interface AnalyticsTripRecord {
  recordedAt: string;
  lines: readonly AnalyticsTripLine[];
  estimatedSavings?: AnalyticsSavingsSnapshot | null;
  plannedSubtotalRm?: number | null;
  estimatedRoundTripCostRm?: number | null;
}

export type AnalyticsCategoryId = ItemCategoryId | "uncategorised";

export interface CategoryPeriodTotal {
  categoryId: AnalyticsCategoryId;
  spendingClass: ItemCategorySpendingClass;
  amountRm: number;
  partial: boolean;
}

export interface SpecificCategoryTotal {
  categoryId: string;
  labelEn: string;
  labelMs: string;
  amountRm: number;
  partial: boolean;
}

export interface SavingsPeriodValue {
  amountRm: number | null;
  available: boolean;
  incomplete: boolean;
}

export interface PeriodAnalytics {
  cadence: AnalyticsCadence;
  periodStart: string;
  periodEnd: string;
  tripCount: number;
  hasActivity: boolean;
  hasEstimatedOnly: boolean;
  actualSpendingRm: number | null;
  hasConfirmedSpending: boolean;
  missingPriceCount: number;
  spendingIncomplete: boolean;
  categoryTotals: CategoryPeriodTotal[];
  specificCategoryTotals: SpecificCategoryTotal[];
  spendingClassTotals: Record<ItemCategorySpendingClass, number | null>;
  savings: {
    available: boolean;
    incomplete: boolean;
    storeChoiceImpact: SavingsPeriodValue;
    itemChangeImpact: SavingsPeriodValue;
    netSaving: SavingsPeriodValue;
  };
}

export interface PeriodAnalyticsComparison {
  cadence: AnalyticsCadence;
  current: PeriodAnalytics;
  previous: PeriodAnalytics;
}

interface PeriodRange {
  start: Date;
  end: Date;
}

const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SAVINGS_COMPONENTS = [
  ["storeChoiceImpact", "storeChoiceImpactRm"],
  ["itemChangeImpact", "itemChangeImpactRm"],
  ["netSaving", "netSavingRm"],
] as const;
const SPENDING_CLASSES: readonly ItemCategorySpendingClass[] = [
  "essential", "discretionary", "mixed_or_unknown",
];
const TAXONOMY_ORDER = new Map<string, number>(ITEM_CATEGORY_IDS.map((id, index) => [id, index]));

function parseInstant(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearPart, monthPart, dayPart, hourPart, minutePart, secondPart, fractionPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = Number(secondPart);
  const millisecond = Number((fractionPart ?? "").padEnd(3, "0"));
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (calendar.getUTCFullYear() !== year
    || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function parseNow(now: string | Date): Date {
  const parsed = now instanceof Date ? new Date(now.getTime()) : parseInstant(now);
  if (!parsed || !Number.isFinite(parsed.getTime())) {
    throw new RangeError("now must be a valid ISO timestamp with an explicit offset");
  }
  return parsed;
}

function iso(date: Date): string {
  return date.toISOString();
}

function rangeFor(now: Date, cadence: AnalyticsCadence): PeriodRange {
  // Kuala Lumpur currently uses UTC+08:00 without daylight-saving changes.
  // Shifting the instant by eight hours exposes its local calendar fields.
  const malaysiaClock = new Date(now.getTime() + MALAYSIA_OFFSET_MS);
  const year = malaysiaClock.getUTCFullYear();
  const month = malaysiaClock.getUTCMonth();
  const day = malaysiaClock.getUTCDate();
  const dayOffset = cadence === "weekly" ? (malaysiaClock.getUTCDay() + 6) % 7 : day - 1;
  const localStart = new Date(Date.UTC(year, month, day - dayOffset));
  const start = new Date(localStart.getTime() - MALAYSIA_OFFSET_MS);
  const nextLocalStart = new Date(localStart.getTime());
  if (cadence === "weekly") nextLocalStart.setUTCDate(nextLocalStart.getUTCDate() + 7);
  else nextLocalStart.setUTCMonth(nextLocalStart.getUTCMonth() + 1);
  return { start, end: new Date(nextLocalStart.getTime() - MALAYSIA_OFFSET_MS) };
}

function previousRange(current: PeriodRange, cadence: AnalyticsCadence): PeriodRange {
  if (cadence === "weekly") {
    return {
      start: new Date(current.start.getTime() - 7 * DAY_MS),
      end: current.start,
    };
  }
  const localCurrentStart = new Date(current.start.getTime() + MALAYSIA_OFFSET_MS);
  let year = localCurrentStart.getUTCFullYear();
  let month = localCurrentStart.getUTCMonth();
  if (month === 0) {
    year -= 1;
    month = 11;
  } else {
    month -= 1;
  }
  const localPreviousStart = new Date(Date.UTC(year, month, 1));
  return {
    start: new Date(localPreviousStart.getTime() - MALAYSIA_OFFSET_MS),
    end: current.start,
  };
}

function toCents(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  // Normalize each frozen savings value to the nearest cent, ties away from
  // zero, then aggregate integer cents. Bought lines are rounded by the
  // existing boughtLineTotalRm contract before reaching this module.
  const sign = value < 0 ? -1 : 1;
  const cents = sign * Math.round((Math.abs(value) + Number.EPSILON) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function fromCents(cents: number): number {
  return cents === 0 ? 0 : cents / 100;
}

function isSpendingClass(value: unknown): value is ItemCategorySpendingClass {
  return value === "essential" || value === "discretionary" || value === "mixed_or_unknown";
}

function categoryFor(line: AnalyticsTripLine): {
  categoryId: AnalyticsCategoryId;
  spendingClass: ItemCategorySpendingClass;
} {
  const id = line.category?.id;
  if (typeof id === "string" && TAXONOMY_ORDER.has(id)) {
    const categoryId = id as ItemCategoryId;
    const spendingClass = ITEM_CATEGORY_SPENDING_CLASS[categoryId];
    if (isSpendingClass(spendingClass)) return { categoryId, spendingClass };
  }
  return { categoryId: "uncategorised", spendingClass: "mixed_or_unknown" };
}

function sumSnapshotComponent(
  trips: readonly AnalyticsTripRecord[],
  componentKey: keyof AnalyticsSavingsSnapshot,
): SavingsPeriodValue {
  let availableCount = 0;
  let snapshotCount = 0;
  let cents = 0;
  for (const trip of trips) {
    if (trip.estimatedSavings != null) snapshotCount += 1;
    const value = trip.estimatedSavings?.[componentKey];
    if (typeof value !== "number") continue;
    const valueCents = toCents(value);
    if (valueCents == null) continue;
    cents += valueCents;
    availableCount += 1;
  }
  return {
    amountRm: availableCount > 0 ? fromCents(cents) : null,
    available: availableCount > 0,
    incomplete: snapshotCount > 0 && availableCount < trips.length,
  };
}

function analyzeRange(
  records: readonly AnalyticsTripRecord[],
  cadence: AnalyticsCadence,
  range: PeriodRange,
): PeriodAnalytics {
  const trips = records.filter(record => {
    const recordedAt = parseInstant(record.recordedAt);
    return recordedAt != null
      && recordedAt.getTime() >= range.start.getTime()
      && recordedAt.getTime() < range.end.getTime();
  });

  const categoryCents = new Map<AnalyticsCategoryId, { cents: number; spendingClass: ItemCategorySpendingClass }>();
  const specificCategoryCents = new Map<string, { cents: number; labelEn: string; labelMs: string }>();
  const classCents = new Map<ItemCategorySpendingClass, number>(SPENDING_CLASSES.map(value => [value, 0]));
  let pricedLineCount = 0;
  let missingPriceCount = 0;
  let totalCents = 0;

  for (const trip of trips) {
    for (const line of trip.lines) {
      if (line.status !== "bought") continue;
      const lineTotal = boughtLineTotalRm(line);
      const lineCents = lineTotal == null ? null : toCents(lineTotal);
      if (lineCents == null) {
        missingPriceCount += 1;
        continue;
      }
      pricedLineCount += 1;
      totalCents += lineCents;
      const category = categoryFor(line);
      const previous = categoryCents.get(category.categoryId);
      categoryCents.set(category.categoryId, {
        cents: (previous?.cents ?? 0) + lineCents,
        spendingClass: category.spendingClass,
      });
      classCents.set(category.spendingClass, (classCents.get(category.spendingClass) ?? 0) + lineCents);
      const source = line.sourceCategory;
      const sourceId = source?.id?.trim() || "uncategorised";
      const previousSource = specificCategoryCents.get(sourceId);
      specificCategoryCents.set(sourceId, {
        cents: (previousSource?.cents ?? 0) + lineCents,
        labelEn: sourceId === "uncategorised" ? "Uncategorised" : source?.labelEn || sourceId,
        labelMs: sourceId === "uncategorised" ? "Tidak berkategori" : source?.labelMs || sourceId,
      });
    }
  }

  const categoryTotals = [...categoryCents.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      spendingClass: total.spendingClass,
      amountRm: fromCents(total.cents),
      partial: missingPriceCount > 0,
    }))
    .sort((left, right) => (
      right.amountRm - left.amountRm
      || (TAXONOMY_ORDER.get(left.categoryId) ?? ITEM_CATEGORY_IDS.length)
        - (TAXONOMY_ORDER.get(right.categoryId) ?? ITEM_CATEGORY_IDS.length)
    ));

  const specificCategoryTotals = [...specificCategoryCents.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      labelEn: total.labelEn,
      labelMs: total.labelMs,
      amountRm: fromCents(total.cents),
      partial: missingPriceCount > 0,
    }))
    .sort((left, right) => right.amountRm - left.amountRm
      || (left.categoryId < right.categoryId ? -1 : left.categoryId > right.categoryId ? 1 : 0));

  const actualSpendingRm = pricedLineCount > 0 ? fromCents(totalCents) : null;
  const savingsValues = Object.fromEntries(SAVINGS_COMPONENTS.map(([publicKey, inputKey]) => [
    publicKey,
    sumSnapshotComponent(trips, inputKey),
  ])) as {
    storeChoiceImpact: SavingsPeriodValue;
    itemChangeImpact: SavingsPeriodValue;
    netSaving: SavingsPeriodValue;
  };
  const savingsAvailable = Object.values(savingsValues).some(value => value.available);
  const savingsIncomplete = Object.values(savingsValues).some(value => value.incomplete);
  const hasEstimates = trips.some(trip => (
    trip.plannedSubtotalRm != null || trip.estimatedRoundTripCostRm != null
  ));

  return {
    cadence,
    periodStart: iso(range.start),
    periodEnd: iso(range.end),
    tripCount: trips.length,
    hasActivity: trips.length > 0,
    hasEstimatedOnly: trips.length > 0 && actualSpendingRm == null && hasEstimates,
    actualSpendingRm,
    hasConfirmedSpending: actualSpendingRm != null,
    missingPriceCount,
    spendingIncomplete: missingPriceCount > 0,
    categoryTotals,
    specificCategoryTotals,
    spendingClassTotals: Object.fromEntries(SPENDING_CLASSES.map(value => [
      value,
      pricedLineCount > 0 ? fromCents(classCents.get(value) ?? 0) : null,
    ])) as Record<ItemCategorySpendingClass, number | null>,
    savings: {
      available: savingsAvailable,
      incomplete: savingsIncomplete,
      ...savingsValues,
    },
  };
}

/** Pure deterministic analytics for the current and immediately previous Malaysia period. */
export function periodAnalytics(
  records: readonly AnalyticsTripRecord[],
  cadence: AnalyticsCadence,
  now: string | Date,
): PeriodAnalyticsComparison {
  const currentRange = rangeFor(parseNow(now), cadence);
  const priorRange = previousRange(currentRange, cadence);
  return {
    cadence,
    current: analyzeRange(records, cadence, currentRange),
    previous: analyzeRange(records, cadence, priorRange),
  };
}

/** Analyze one Malaysia calendar period whose start is derived from an instant. */
export function periodAnalyticsForStart(
  records: readonly AnalyticsTripRecord[],
  cadence: AnalyticsCadence,
  periodStart: string | Date,
): PeriodAnalytics {
  const range = rangeFor(parseNow(periodStart), cadence);
  return analyzeRange(records, cadence, range);
}
