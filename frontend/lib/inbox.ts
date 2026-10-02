import { isGeneratedReport, type GeneratedReport, type LocalInboxReport, type ReportCadence } from "./report-generation";

export type { ReportCadence } from "./report-generation";

export const INBOX_STORAGE_KEY = "smartcart.inbox.v1";
export const INBOX_VERSION = 4 as const;

export interface InboxState {
  version: typeof INBOX_VERSION;
  cadence: ReportCadence;
  messages: LocalInboxReport[];
}

export const EMPTY_INBOX: InboxState = {
  version: INBOX_VERSION,
  cadence: "weekly",
  messages: [],
};

function isLocalInboxReport(value: unknown): value is LocalInboxReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.read !== "boolean") return false;
  const report = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "read"));
  return isGeneratedReport(report);
}

export function parseInboxState(serialized: string | null | undefined): InboxState {
  if (!serialized) return EMPTY_INBOX;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_INBOX;
    const state = value as Record<string, unknown>;
    // The v4 newsletter format intentionally clears saved v3 reports while
    // retaining the shopper's weekly/monthly preference.
    if (state.version === 3 && (state.cadence === "weekly" || state.cadence === "monthly")) {
      return { ...EMPTY_INBOX, cadence: state.cadence };
    }
    if (Object.keys(state).sort().join(",") !== "cadence,messages,version"
      || state.version !== INBOX_VERSION
      || (state.cadence !== "weekly" && state.cadence !== "monthly")
      || !Array.isArray(state.messages)
      || !state.messages.every(isLocalInboxReport)) return EMPTY_INBOX;
    const messages = state.messages as LocalInboxReport[];
    if (new Set(messages.map(message => message.id)).size !== messages.length) return EMPTY_INBOX;
    return { version: INBOX_VERSION, cadence: state.cadence, messages };
  } catch {
    return EMPTY_INBOX;
  }
}

export function serializeInboxState(state: InboxState): string {
  return JSON.stringify(state);
}

export function setReportCadence(state: InboxState, cadence: ReportCadence): InboxState {
  return state.cadence === cadence ? state : { ...state, cadence };
}

export function saveReadyReport(state: InboxState, report: GeneratedReport): InboxState {
  if (!isGeneratedReport(report)) return state;
  const existing = state.messages.find(message => message.id === report.id);
  const ready: LocalInboxReport = { ...report, read: existing?.read ?? false };
  const messages = [...state.messages.filter(message => message.id !== report.id), ready]
    .sort((left, right) => Date.parse(right.periodEnd) - Date.parse(left.periodEnd)
      || left.cadence.localeCompare(right.cadence));
  return { ...state, messages };
}

export function markReportRead(state: InboxState, id: string): InboxState {
  if (!state.messages.some(message => message.id === id && !message.read)) return state;
  return {
    ...state,
    messages: state.messages.map(message => message.id === id ? { ...message, read: true } : message),
  };
}

export function clearInboxReports(state: InboxState): InboxState {
  return state.messages.length === 0 ? state : { ...state, messages: [] };
}

export function unreadReportCount(state: InboxState): number {
  return state.messages.reduce((count, message) => count + (message.read ? 0 : 1), 0);
}

export function readBackInboxState(
  storage: { getItem(key: string): string | null },
): InboxState | null {
  try {
    const serialized = storage.getItem(INBOX_STORAGE_KEY);
    if (serialized === null) return null;
    const parsed = parseInboxState(serialized);
    return parsed.version === INBOX_VERSION ? parsed : null;
  } catch {
    return null;
  }
}
