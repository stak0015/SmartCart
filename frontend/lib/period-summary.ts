import type { AnalyticsCadence, PeriodAnalytics } from "./period-analytics";
import { periodAnalytics, periodAnalyticsForStart } from "./period-analytics";
import type { TripRecord } from "./trip-history";

const DAY_MS = 86_400_000;

/** Existing Statistics summary shape retained while using the shared analytics calculation. */
export interface PeriodSummary {
  cadence: AnalyticsCadence;
  periodStart: string;
  periodEnd: string;
  tripCount: number;
  hasRecords: boolean;
  hasConfirmedSpending: boolean;
  hasEstimatedOnly: boolean;
  confirmedSpendingRm: number | null;
  spendingIncomplete: boolean;
  estimatedNetSavingsRm: number | null;
  storeChoiceImpactRm: number | null;
  itemChangeImpactRm: number | null;
  savingsAvailable: boolean;
  savingsIncomplete: boolean;
}

export interface PeriodComparison {
  cadence: AnalyticsCadence;
  current: PeriodSummary;
  previous: PeriodSummary | null;
  inProgress: boolean;
  daysElapsed: number;
  daysInPeriod: number;
}

function legacySummary(period: PeriodAnalytics): PeriodSummary {
  return {
    cadence: period.cadence,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    tripCount: period.tripCount,
    hasRecords: period.hasActivity,
    hasConfirmedSpending: period.hasConfirmedSpending,
    hasEstimatedOnly: period.hasEstimatedOnly,
    confirmedSpendingRm: period.actualSpendingRm,
    spendingIncomplete: period.spendingIncomplete,
    estimatedNetSavingsRm: period.savings.netSaving.amountRm,
    storeChoiceImpactRm: period.savings.storeChoiceImpact.amountRm,
    itemChangeImpactRm: period.savings.itemChangeImpact.amountRm,
    savingsAvailable: period.savings.available,
    savingsIncomplete: period.savings.incomplete,
  };
}

/** Summarise a period for existing callers; boundaries use Malaysia calendar time. */
export function periodSummaryForStart(
  records: TripRecord[],
  cadence: AnalyticsCadence,
  start: Date,
): PeriodSummary {
  return legacySummary(periodAnalyticsForStart(records, cadence, start));
}

export function periodSummary(
  records: TripRecord[],
  cadence: AnalyticsCadence = "weekly",
  now = new Date(),
): PeriodSummary {
  return legacySummary(periodAnalytics(records, cadence, now).current);
}

/** Existing comparison surface backed by the immediate Malaysia calendar period. */
export function periodComparison(
  records: TripRecord[],
  cadence: AnalyticsCadence = "weekly",
  now = new Date(),
): PeriodComparison {
  const analytics = periodAnalytics(records, cadence, now);
  const current = legacySummary(analytics.current);
  const previous = analytics.previous.hasActivity ? legacySummary(analytics.previous) : null;
  const start = Date.parse(current.periodStart);
  const end = Date.parse(current.periodEnd);
  const nowTime = now.getTime();
  const daysInPeriod = Math.max(1, Math.round((end - start) / DAY_MS));
  const daysElapsed = Math.min(
    daysInPeriod,
    Math.max(1, Math.floor((nowTime - start) / DAY_MS) + 1),
  );

  return {
    cadence,
    current,
    previous,
    inProgress: nowTime < end,
    daysElapsed,
    daysInPeriod,
  };
}
