import type { Locale } from "./i18n";
import { periodAnalytics, type AnalyticsCadence, type PeriodAnalyticsComparison } from "./period-analytics";
import { formatInclusiveDateRange } from "./report-format";
import { buildCategoryChartRows, type CategoryChartRow } from "./report-generation";
import type { TripRecord } from "./trip-history";

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
}

export function buildStatisticsView(
  records: readonly TripRecord[],
  cadence: AnalyticsCadence,
  now: string | Date,
  locale: Locale,
): StatisticsViewModel {
  const analytics = periodAnalytics(records, cadence, now);
  const { current, previous } = analytics;
  return {
    analytics,
    currentRangeLabel: formatInclusiveDateRange(current.periodStart, current.periodEnd, locale),
    comparisonRangeLabel: formatInclusiveDateRange(previous.periodStart, previous.periodEnd, locale),
    categoryRows: buildCategoryChartRows(current.categoryTotals, current.actualSpendingRm),
    hasCurrentActivity: current.hasActivity,
    hasConfirmedSpending: current.hasConfirmedSpending,
    hasPartialSpending: current.spendingIncomplete,
    hasIncompleteSavings: current.savings.incomplete,
    hasComparisonActivity: previous.hasActivity,
  };
}
