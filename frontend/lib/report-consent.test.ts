import { describe, expect, it, vi } from "vitest";
import {
  parseReportConsent,
  readReportConsent,
  REPORT_CONSENT_STORAGE_KEY,
  serializeReportConsent,
  writeReportConsent,
} from "./report-consent";

const RECORD = { version: 1 as const, status: "accepted" as const, decidedAt: "2026-09-26T12:00:00.000Z" };

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; }),
    value: () => value,
  };
}

describe("report consent v1", () => {
  it("serializes the exact accepted and declined record shape", () => {
    expect(serializeReportConsent(RECORD)).toBe(JSON.stringify(RECORD));
    expect(parseReportConsent(JSON.stringify({ ...RECORD, status: "declined" }))).toEqual({ ...RECORD, status: "declined" });
  });

  it("fails closed for missing, malformed, extra-field, and unknown-version records", () => {
    expect(readReportConsent(memoryStorage()).source).toBe("missing");
    for (const value of ["{broken", JSON.stringify({ ...RECORD, version: 2 }), JSON.stringify({ ...RECORD, extra: true }), JSON.stringify({ ...RECORD, decidedAt: "not-a-date" })]) {
      expect(parseReportConsent(value)).toBeNull();
      expect(readReportConsent(memoryStorage(value))).toMatchObject({ status: "undecided", source: "invalid", record: null });
    }
  });

  it("requires successful storage write and accepted readback before returning a usable choice", () => {
    const storage = memoryStorage();
    expect(writeReportConsent(storage, "accepted", RECORD.decidedAt)).toEqual(RECORD);
    expect(storage.setItem).toHaveBeenCalledWith(REPORT_CONSENT_STORAGE_KEY, JSON.stringify(RECORD));

    const unwritable = memoryStorage();
    unwritable.setItem.mockImplementation(() => { throw new Error("denied"); });
    expect(writeReportConsent(unwritable, "accepted", RECORD.decidedAt)).toBeNull();

    const failedReadback = memoryStorage();
    failedReadback.getItem.mockReturnValue(null);
    expect(writeReportConsent(failedReadback, "accepted", RECORD.decidedAt)).toBeNull();
  });

  it("treats failed consent reads as unavailable and fail-closed", () => {
    const storage = { getItem: () => { throw new Error("blocked"); } };
    expect(readReportConsent(storage)).toMatchObject({ status: "undecided", source: "unavailable" });
  });
});
