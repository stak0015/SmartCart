import type { TripRecord } from "./trip-history";

export const INBOX_STORAGE_KEY = "smartcart.inbox.v1";
export const INBOX_VERSION = 1 as const;

export type ReportCadence = "weekly" | "monthly";

export interface SavingsReportMessage {
  id: string;
  cadence: ReportCadence;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  read: boolean;
  tripCount: number;
  actualSpendingRm: number | null;
  estimatedNetSavingsRm: number | null;
  storeChoiceImpactRm: number | null;
  itemChangeImpactRm: number | null;
  spendingIncomplete: boolean;
  savingsIncomplete: boolean;
}

export interface InboxState {
  version: typeof INBOX_VERSION;
  cadence: ReportCadence;
  messages: SavingsReportMessage[];
}

export const EMPTY_INBOX: InboxState = {
  version: INBOX_VERSION,
  cadence: "weekly",
  messages: [],
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function startOfUtcWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - mondayOffset);
  return result;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

// Exported so the current-period spending summary (AC 8.1.1) and the archived
// period reports share one definition of a period boundary. Re-implementing it
// would let a trip near a boundary be counted twice, or by neither.
export function periodStart(date: Date, cadence: ReportCadence): Date {
  return cadence === "weekly" ? startOfUtcWeek(date) : startOfUtcMonth(date);
}

export function nextPeriod(start: Date, cadence: ReportCadence): Date {
  const next = new Date(start);
  if (cadence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length > 0 ? money(known.reduce((total, value) => total + value, 0)) : null;
}

function buildReport(
  records: TripRecord[],
  cadence: ReportCadence,
  start: Date,
  end: Date,
  generatedAt: string,
): SavingsReportMessage {
  const snapshots = records.map(record => record.estimatedSavings ?? null);
  const boughtPriceMissing = records.some(record => record.lines.some(line => (
    line.status === "bought" && line.actualLineTotalRm == null
  )));

  return {
    id: `${cadence}:${dateKey(start)}`,
    cadence,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    generatedAt,
    read: false,
    tripCount: records.length,
    actualSpendingRm: sumKnown(records.map(record => record.actualTotalRm)),
    estimatedNetSavingsRm: sumKnown(snapshots.map(snapshot => snapshot?.netSavingRm ?? null)),
    storeChoiceImpactRm: sumKnown(snapshots.map(snapshot => snapshot?.storeChoiceImpactRm ?? null)),
    itemChangeImpactRm: sumKnown(snapshots.map(snapshot => snapshot?.itemChangeImpactRm ?? null)),
    spendingIncomplete: boughtPriceMissing || records.some(record => record.actualTotalRm == null),
    savingsIncomplete: snapshots.some(snapshot => snapshot?.netSavingRm == null),
  };
}

export function syncInboxReports(
  state: InboxState,
  records: TripRecord[],
  now = new Date(),
): InboxState {
  const currentStart = periodStart(now, state.cadence);
  const grouped = new Map<string, { start: Date; end: Date; records: TripRecord[] }>();

  for (const record of records) {
    const recordedAt = new Date(record.recordedAt);
    if (!Number.isFinite(recordedAt.getTime())) continue;
    const start = periodStart(recordedAt, state.cadence);
    if (start >= currentStart) continue;
    const key = dateKey(start);
    const group = grouped.get(key) ?? { start, end: nextPeriod(start, state.cadence), records: [] };
    group.records.push(record);
    grouped.set(key, group);
  }

  const existingIds = new Set(state.messages.map(message => message.id));
  const generatedAt = now.toISOString();
  const additions = [...grouped.values()]
    .map(group => buildReport(group.records, state.cadence, group.start, group.end, generatedAt))
    .filter(message => !existingIds.has(message.id));

  if (additions.length === 0) return state;
  return {
    ...state,
    messages: [...additions, ...state.messages].sort((a, b) => (
      Date.parse(b.periodStart) - Date.parse(a.periodStart)
    )),
  };
}

export function setReportCadence(state: InboxState, cadence: ReportCadence): InboxState {
  return state.cadence === cadence ? state : { ...state, cadence };
}

export function markReportRead(state: InboxState, id: string): InboxState {
  if (!state.messages.some(message => message.id === id && !message.read)) return state;
  return {
    ...state,
    messages: state.messages.map(message => message.id === id ? { ...message, read: true } : message),
  };
}

function isNullableMoney(value: unknown, signed = false): boolean {
  return value === null || (typeof value === "number"
    && Number.isFinite(value)
    && (signed || value >= 0));
}

function isReportMessage(value: unknown): value is SavingsReportMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return typeof message.id === "string"
    && (message.cadence === "weekly" || message.cadence === "monthly")
    && typeof message.periodStart === "string"
    && Number.isFinite(Date.parse(message.periodStart))
    && typeof message.periodEnd === "string"
    && Number.isFinite(Date.parse(message.periodEnd))
    && typeof message.generatedAt === "string"
    && Number.isFinite(Date.parse(message.generatedAt))
    && typeof message.read === "boolean"
    && typeof message.tripCount === "number"
    && Number.isInteger(message.tripCount)
    && message.tripCount > 0
    && isNullableMoney(message.actualSpendingRm)
    && isNullableMoney(message.estimatedNetSavingsRm, true)
    && isNullableMoney(message.storeChoiceImpactRm, true)
    && isNullableMoney(message.itemChangeImpactRm, true)
    && typeof message.spendingIncomplete === "boolean"
    && typeof message.savingsIncomplete === "boolean";
}

export function parseInboxState(serialized: string | null | undefined): InboxState {
  if (!serialized) return EMPTY_INBOX;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return EMPTY_INBOX;
    const state = value as Record<string, unknown>;
    if (state.version !== INBOX_VERSION
      || (state.cadence !== "weekly" && state.cadence !== "monthly")
      || !Array.isArray(state.messages)
      || !state.messages.every(isReportMessage)) return EMPTY_INBOX;
    return state as unknown as InboxState;
  } catch {
    return EMPTY_INBOX;
  }
}

export function serializeInboxState(state: InboxState): string {
  return JSON.stringify(state);
}
