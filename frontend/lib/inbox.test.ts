import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clearInboxReports,
  EMPTY_INBOX,
  INBOX_VERSION,
  markReportRead,
  parseInboxState,
  saveReadyReport,
  serializeInboxState,
  setReportCadence,
} from "./inbox";
import type { GeneratedReport } from "./report-generation";

const fixture = JSON.parse(readFileSync(new URL(
  "../../tests/fixtures/reports/G4-report-response.json",
  import.meta.url,
), "utf8")) as { expected: GeneratedReport };
const report = fixture.expected;

describe("device-local ready inbox", () => {
  it("stores complete G4 reports only and preserves read state on a stable-id replacement", () => {
    const generated = saveReadyReport(EMPTY_INBOX, report);
    expect(generated.messages).toHaveLength(1);
    expect(generated.messages[0]).toMatchObject({ id: report.id, read: false, sections: report.sections });

    const opened = markReportRead(generated, report.id);
    const refreshed = saveReadyReport(opened, { ...report, generatedAt: "2026-09-27T12:00:00.000Z" });
    expect(refreshed.messages).toHaveLength(1);
    expect(refreshed.messages[0].read).toBe(true);
    expect(parseInboxState(serializeInboxState(refreshed))).toEqual(refreshed);
  });

  it("supports cadence, read state, clearing only reports, and unread counts through state shape", () => {
    const populated = saveReadyReport(EMPTY_INBOX, report);
    const monthly = setReportCadence(populated, "monthly");
    expect(monthly.cadence).toBe("monthly");
    const read = markReportRead(monthly, report.id);
    expect(read.messages[0].read).toBe(true);
    expect(clearInboxReports(read)).toEqual({ ...read, messages: [] });
  });

  it("clears older reports while retaining the v3 cadence preference", () => {
    for (const version of [1, 2]) {
      const legacy = JSON.stringify({ version, cadence: "weekly", messages: [{ id: "weekly:2026-09-13", read: false }] });
      expect(parseInboxState(legacy)).toEqual(EMPTY_INBOX);
    }
    const v3 = JSON.stringify({ version: 3, cadence: "monthly", messages: [{ ...report, read: true }] });
    expect(parseInboxState(v3)).toEqual({ ...EMPTY_INBOX, cadence: "monthly" });
    expect(INBOX_VERSION).toBe(4);
  });

  it("rejects malformed, incomplete, duplicated, and noncanonical ready reports", () => {
    const incomplete = { ...report, sections: report.sections.slice(0, 3) };
    const duplicated = { ...EMPTY_INBOX, messages: [{ ...report, read: false }, { ...report, read: true }] };
    const noncanonical = { ...report, id: "weekly:2026-09-13" };
    for (const value of [
      "{broken",
      JSON.stringify({ ...EMPTY_INBOX, messages: [incomplete] }),
      JSON.stringify(duplicated),
      JSON.stringify({ ...EMPTY_INBOX, messages: [{ ...noncanonical, read: false }] }),
    ]) expect(parseInboxState(value)).toEqual(EMPTY_INBOX);
  });
});
