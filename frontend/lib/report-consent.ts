export const REPORT_CONSENT_STORAGE_KEY = "smartcart.report-consent.v1";

export type ReportConsentStatus = "accepted" | "declined";

export interface ReportConsentV1 {
  version: 1;
  status: ReportConsentStatus;
  decidedAt: string;
}

export type ReportConsentRead =
  | { status: "accepted" | "declined"; source: "valid"; record: ReportConsentV1 }
  | { status: "undecided"; source: "missing" | "invalid" | "unavailable"; record: null };

export interface ConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && ISO_INSTANT.test(value) && Number.isFinite(Date.parse(value));
}

export function parseReportConsent(serialized: string | null | undefined): ReportConsentV1 | null {
  if (typeof serialized !== "string") return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(",") !== "decidedAt,status,version"
      || record.version !== 1
      || (record.status !== "accepted" && record.status !== "declined")
      || !isIsoInstant(record.decidedAt)) return null;
    return { version: 1, status: record.status, decidedAt: record.decidedAt };
  } catch {
    return null;
  }
}

export function serializeReportConsent(record: ReportConsentV1): string {
  if (!parseReportConsent(JSON.stringify(record))) throw new TypeError("Invalid report consent record");
  return JSON.stringify(record);
}

export function readReportConsent(storage: Pick<ConsentStorage, "getItem">): ReportConsentRead {
  try {
    const serialized = storage.getItem(REPORT_CONSENT_STORAGE_KEY);
    if (serialized === null) return { status: "undecided", source: "missing", record: null };
    const record = parseReportConsent(serialized);
    return record
      ? { status: record.status, source: "valid", record }
      : { status: "undecided", source: "invalid", record: null };
  } catch {
    return { status: "undecided", source: "unavailable", record: null };
  }
}

/** Writes consent and allows the choice only after an exact successful readback. */
export function writeReportConsent(
  storage: ConsentStorage,
  status: ReportConsentStatus,
  decidedAt = new Date().toISOString(),
): ReportConsentV1 | null {
  const record: ReportConsentV1 = { version: 1, status, decidedAt };
  const serialized = serializeReportConsent(record);
  try {
    storage.setItem(REPORT_CONSENT_STORAGE_KEY, serialized);
    const readback = readReportConsent(storage);
    return readback.source === "valid"
      && readback.status === status
      && readback.record.decidedAt === decidedAt
      ? record
      : null;
  } catch {
    return null;
  }
}
