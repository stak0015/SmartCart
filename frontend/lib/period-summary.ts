import { nextPeriod, periodStart, type ReportCadence } from "./inbox";
import type { TripRecord } from "./trip-history";

const DAY_MS = 86_400_000;

/**
 * AC 8.1.1: the spending summary for one period (week or month).
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
  /**
   * AC 8.3.1: estimated savings figures frozen per trip at record time.
   * Estimates only - a caller must never present them with the same weight as
   * confirmed spending (AC 8.1.2 "estimates stay estimates").
   */
  estimatedNetSavingsRm: number | null;
  storeChoiceImpactRm: number | null;
  itemChangeImpactRm: number | null;
  /**
   * At least one record in the period carries a savings snapshot. Records
   * created before the snapshot existed carry none and must not be read as
   * "saved RM0" - absence is not zero.
   */
  savingsAvailable: boolean;
  /** Some records carry a snapshot and some do not, so savings totals are partial. */
  savingsIncomplete: boolean;
}

/**
 * AC 8.3.1/8.3.2: the current period against the previous one of the same
 * cadence. `previous` is null when the previous period holds no records at
 * all - absence, not zeros, because AC 8.3.2 forbids faking a comparison.
 */
export interface PeriodComparison {
  cadence: ReportCadence;
  current: PeriodSummary;
  previous: PeriodSummary | null;
  /** The current period has not finished yet (e.g. comparing on a Tuesday). */
  inProgress: boolean;
  daysElapsed: number;
  daysInPeriod: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumSigned(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length > 0 ? money(known.reduce((total, value) => total + value, 0)) : null;
}

type SavingsSnapshot = NonNullable<TripRecord["estimatedSavings"]>;

/** Summarise an arbitrary period. Exported so AC 8.3 can reuse it verbatim. */
export function periodSummaryForStart(
  records: TripRecord[],
  cadence: ReportCadence,
  start: Date,
): PeriodSummary {
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

  // AC 8.3.1: savings are summed only over records that actually carry a
  // snapshot; a missing snapshot is skipped, never counted as zero.
  const snapshots = inPeriod
    .map(record => record.estimatedSavings ?? null)
    .filter((snapshot): snapshot is SavingsSnapshot => snapshot != null);

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
    estimatedNetSavingsRm: sumSigned(snapshots.map(snapshot => snapshot.netSavingRm)),
    storeChoiceImpactRm: sumSigned(snapshots.map(snapshot => snapshot.storeChoiceImpactRm)),
    itemChangeImpactRm: sumSigned(snapshots.map(snapshot => snapshot.itemChangeImpactRm)),
    savingsAvailable: snapshots.length > 0,
    savingsIncomplete: snapshots.length > 0 && snapshots.length < inPeriod.length,
  };
}

export function periodSummary(
  records: TripRecord[],
  cadence: ReportCadence = "weekly",
  now = new Date(),
): PeriodSummary {
  return periodSummaryForStart(records, cadence, periodStart(now, cadence));
}

/**
 * AC 8.3.1/8.3.2. The previous period is found by stepping one day back from
 * the current period's start and re-deriving the period start, which stays
 * correct across month and year boundaries for either cadence.
 */
export function periodComparison(
  records: TripRecord[],
  cadence: ReportCadence = "weekly",
  now = new Date(),
): PeriodComparison {
  const currentStart = periodStart(now, cadence);
  const current = periodSummaryForStart(records, cadence, currentStart);

  const previousStart = periodStart(new Date(currentStart.getTime() - DAY_MS), cadence);
  const previousSummary = periodSummaryForStart(records, cadence, previousStart);

  const end = nextPeriod(currentStart, cadence);
  const daysInPeriod = Math.max(1, Math.round((end.getTime() - currentStart.getTime()) / DAY_MS));
  const daysElapsed = Math.min(
    daysInPeriod,
    Math.max(1, Math.floor((now.getTime() - currentStart.getTime()) / DAY_MS) + 1),
  );

  return {
    cadence,
    current,
    // AC 8.3.2: no previous data means no comparison object at all.
    previous: previousSummary.hasRecords ? previousSummary : null,
    inProgress: now.getTime() < end.getTime(),
    daysElapsed,
    daysInPeriod,
  };
}
