import { nextPeriod, periodStart, type ReportCadence } from "./inbox";
import type { TripRecord } from "./trip-history";

/**
 * AC 8.1.1: the weekly summary for the period the shopper is currently in.
 *
 * This is deliberately separate from the archived reports in inbox.ts: those
 * are frozen once a period has *finished* (syncInboxReports skips the current
 * period), while AC 8.1.1/8.1.3 ask what has been spent "this week" while the
 * week is still open. Both derive their period boundaries from the same
 * exported helpers, so a trip near a boundary can never be counted by one and
 * missed by the other.
 */
export interface PeriodSummary {
  cadence: ReportCadence;
  periodStart: string;
  periodEnd: string;
  tripCount: number;
  /** AC 8.1.3: no records at all in the period. */
  hasRecords: boolean;
  /** AC 8.1.1: at least one record carries a confirmed actual total. */
  hasConfirmedSpending: boolean;
  /**
   * AC 8.1.2: records exist and carry planned/estimated figures, but no
   * confirmed spending. The estimate amounts are intentionally NOT exposed
   * here: US 8.1 is "what I spent", and an estimate is not spending. Keeping
   * the amount out of the summary makes it impossible for a caller to render
   * it in the confirmed slot.
   */
  hasEstimatedOnly: boolean;
  /** AC 8.1.1/8.1.3/8.1.4: null when nothing is confirmed - never 0. */
  confirmedSpendingRm: number | null;
  /** Some bought lines had no actual price, so the total is partial. */
  spendingIncomplete: boolean;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function periodSummary(
  records: TripRecord[],
  cadence: ReportCadence = "weekly",
  now = new Date(),
): PeriodSummary {
  const start = periodStart(now, cadence);
  const end = nextPeriod(start, cadence);

  // AC 5.5.4 spirit: a record with an unparseable date is skipped, never
  // allowed to crash the summary or to be guessed into the period.
  const inPeriod = records.filter(record => {
    const recordedAt = new Date(record.recordedAt);
    if (!Number.isFinite(recordedAt.getTime())) return false;
    return periodStart(recordedAt, cadence).getTime() === start.getTime();
  });

  // AC 8.1.2: only actualTotalRm is confirmed spending. plannedSubtotalRm,
  // estimatedRoundTripCostRm and plannedCombinedTotalRm are estimates and are
  // never summed into this figure.
  const confirmed = inPeriod
    .map(record => record.actualTotalRm)
    .filter((value): value is number => value != null);

  const confirmedSpendingRm = confirmed.length > 0
    ? money(confirmed.reduce((total, value) => total + value, 0))
    : null;

  const hasEstimate = inPeriod.some(record => (
    record.plannedSubtotalRm != null || record.estimatedRoundTripCostRm != null
  ));

  const spendingIncomplete = inPeriod.some(record => (
    record.actualTotalRm == null
    || record.lines.some(line => line.status === "bought" && line.actualLineTotalRm == null)
  ));

  return {
    cadence,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    tripCount: inPeriod.length,
    hasRecords: inPeriod.length > 0,
    hasConfirmedSpending: confirmedSpendingRm != null,
    hasEstimatedOnly: inPeriod.length > 0 && confirmedSpendingRm == null && hasEstimate,
    confirmedSpendingRm,
    spendingIncomplete,
  };
}
