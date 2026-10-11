import type { Locale } from "./i18n";
import {
  periodAnalytics,
  periodAnalyticsForStart,
  type AnalyticsCadence,
  type AnalyticsCategoryId,
  type PeriodAnalytics,
  type PeriodAnalyticsComparison,
} from "./period-analytics";
import { formatInclusiveDateRange } from "./report-format";
import { buildCategoryChartRows, type CategoryChartRow } from "./report-generation";
import { displayItemName } from "./item-name";
import { boughtLineQuantity, boughtLineTotalRm, type TripRecord } from "./trip-history";

export const STATISTICS_TREND_LENGTH = 8;
export const STATISTICS_TOP_ITEMS = 5;

export interface StatisticsTrendPoint {
  periodStart: string;
  /** Short axis label: the week's start day, or the month name. */
  label: string;
  /** Full inclusive range for tooltips and the accessible table. */
  rangeLabel: string;
  amountRm: number | null;
  tripCount: number;
  selected: boolean;
}

export interface StatisticsCategoryChange {
  categoryId: AnalyticsCategoryId;
  amountRm: number;
  percent: number | null;
  partial: boolean;
  /** Confirmed amount in the comparison period; null when it had no trips. */
  previousAmountRm: number | null;
  /** Signed change in sen-exact ringgit; null without a comparison period. */
  changeRm: number | null;
}

export interface StatisticsTopItem {
  key: string;
  name: string;
  quantity: number;
  amountRm: number;
  /** Share of the period's confirmed spending, one decimal place. */
  percent: number | null;
}

export interface StatisticsViewModel {
  analytics: PeriodAnalyticsComparison;
  currentRangeLabel: string;
  comparisonRangeLabel: string;
  categoryRows: CategoryChartRow[];
  hasCurrentActivity: boolean;
  hasConfirmedSpending: boolean;
  hasPartialSpending: boolean;
  hasIncompleteSavings: boolean;
  hasComparisonActivity: boolean;
  /** 0 is the period containing `now`; -1 the one before, and so on. */
  offset: number;
  isCurrentPeriod: boolean;
  canGoOlder: boolean;
  canGoNewer: boolean;
  /** Signed change in confirmed spending vs the comparison period. */
  spendingChangeRm: number | null;
  spendingChangePercent: number | null;
  averagePerTripRm: number | null;
  previousAveragePerTripRm: number | null;
  tripCountChange: number | null;
  topItems: StatisticsTopItem[];
  categoryChanges: StatisticsCategoryChange[];
  trend: StatisticsTrendPoint[];
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function shortLabel(period: PeriodAnalytics, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", period.cadence === "weekly"
    ? { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" }
    : { month: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(period.periodStart));
}

function periodBefore(records: readonly TripRecord[], cadence: AnalyticsCadence, period: PeriodAnalytics): PeriodAnalytics {
  return periodAnalyticsForStart(records, cadence, new Date(Date.parse(period.periodStart) - 1));
}

export function buildStatisticsView(
  records: readonly TripRecord[],
  cadence: AnalyticsCadence,
  now: string | Date,
  locale: Locale,
  offset = 0,
): StatisticsViewModel {
  const safeOffset = Math.min(0, Math.trunc(offset));
  let anchor = periodAnalytics(records, cadence, now).current;
  for (let step = 0; step > safeOffset; step -= 1) anchor = periodBefore(records, cadence, anchor);
  const analytics: PeriodAnalyticsComparison = {
    cadence,
    current: anchor,
    previous: periodBefore(records, cadence, anchor),
  };
  const { current, previous } = analytics;

  const trend: StatisticsTrendPoint[] = [];
  let cursor = current;
  for (let index = 0; index < STATISTICS_TREND_LENGTH; index += 1) {
    trend.unshift({
      periodStart: cursor.periodStart,
      label: shortLabel(cursor, locale),
      rangeLabel: formatInclusiveDateRange(cursor.periodStart, cursor.periodEnd, locale),
      amountRm: cursor.actualSpendingRm,
      tripCount: cursor.tripCount,
      selected: index === 0,
    });
    cursor = index === 0 ? previous : periodBefore(records, cadence, cursor);
  }

  const earliest = records.reduce<number>((min, record) => {
    const time = Date.parse(record.recordedAt);
    return Number.isFinite(time) && time < min ? time : min;
  }, Number.POSITIVE_INFINITY);

  const comparable = previous.hasActivity && current.actualSpendingRm != null && previous.actualSpendingRm != null;
  const spendingChangeRm = comparable ? (cents(current.actualSpendingRm!) - cents(previous.actualSpendingRm!)) / 100 : null;
  const spendingChangePercent = comparable && previous.actualSpendingRm! > 0
    ? Math.round(spendingChangeRm! / previous.actualSpendingRm! * 1000) / 10
    : null;

  const categoryRows = buildCategoryChartRows(current.categoryTotals, current.actualSpendingRm);
  const previousById = new Map(previous.categoryTotals.map(row => [row.categoryId, row.amountRm]));
  const categoryChanges = categoryRows.map(row => {
    const previousAmountRm = previous.hasActivity ? previousById.get(row.categoryId) ?? 0 : null;
    return {
      categoryId: row.categoryId,
      amountRm: row.amountRm,
      percent: row.percent,
      partial: row.partial,
      previousAmountRm,
      changeRm: previousAmountRm == null ? null : (cents(row.amountRm) - cents(previousAmountRm)) / 100,
    };
  });

  const start = Date.parse(current.periodStart);
  const end = Date.parse(current.periodEnd);
  const items = new Map<string, StatisticsTopItem>();
  for (const record of records) {
    const recordedAt = Date.parse(record.recordedAt);
    if (!(recordedAt >= start && recordedAt < end)) continue;
    for (const line of record.lines) {
      if (line.status !== "bought") continue;
      const total = boughtLineTotalRm(line);
      if (total == null) continue;
      const rawName = (locale === "ms" ? line.itemNameMs : line.itemNameEn) || line.itemName;
      const key = line.catalogueItemId ?? `name:${rawName.trim().toLocaleLowerCase()}`;
      const existing = items.get(key);
      items.set(key, {
        key,
        name: existing?.name ?? displayItemName(rawName.trim(), locale),
        quantity: (existing?.quantity ?? 0) + boughtLineQuantity(line),
        amountRm: (cents(existing?.amountRm ?? 0) + cents(total)) / 100,
        percent: null,
      });
    }
  }
  const topItems = [...items.values()]
    .sort((left, right) => right.amountRm - left.amountRm || left.name.localeCompare(right.name))
    .slice(0, STATISTICS_TOP_ITEMS)
    .map(item => ({
      ...item,
      percent: current.actualSpendingRm ? Math.round(item.amountRm / current.actualSpendingRm * 1000) / 10 : null,
    }));
  const average = (period: typeof current) => period.actualSpendingRm != null && period.tripCount > 0
    ? Math.round(period.actualSpendingRm / period.tripCount * 100) / 100
    : null;

  return {
    analytics,
    currentRangeLabel: formatInclusiveDateRange(current.periodStart, current.periodEnd, locale),
    comparisonRangeLabel: formatInclusiveDateRange(previous.periodStart, previous.periodEnd, locale),
    categoryRows,
    hasCurrentActivity: current.hasActivity,
    hasConfirmedSpending: current.hasConfirmedSpending,
    hasPartialSpending: current.spendingIncomplete,
    hasIncompleteSavings: current.savings.incomplete,
    hasComparisonActivity: previous.hasActivity,
    offset: safeOffset,
    isCurrentPeriod: safeOffset === 0,
    canGoOlder: earliest < Date.parse(current.periodStart),
    canGoNewer: safeOffset < 0,
    spendingChangeRm,
    spendingChangePercent,
    averagePerTripRm: average(current),
    previousAveragePerTripRm: previous.hasActivity ? average(previous) : null,
    tripCountChange: previous.hasActivity ? current.tripCount - previous.tripCount : null,
    topItems,
    categoryChanges,
    trend,
  };
}
