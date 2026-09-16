import { describe, expect, it } from "vitest";
import type { TripRecord } from "./trip-history";
import {
  EMPTY_INBOX,
  INBOX_VERSION,
  markReportRead,
  parseInboxState,
  serializeInboxState,
  setReportCadence,
  syncInboxReports,
  type InboxState,
} from "./inbox";

function trip(id: string, recordedAt: string, actualTotalRm: number | null, saving: number | null): TripRecord {
  return {
    version: 1,
    id,
    recordedAt,
    checklistId: `checklist-${id}`,
    store: { premiseId: "1", premiseCode: "P1", name: "Store", address: null },
    plannedSubtotalRm: 20,
    estimatedRoundTripCostRm: 2,
    plannedCombinedTotalRm: 22,
    alternativeStoreEstimates: [],
    estimatedSavings: saving == null ? null : {
      medianCombinedCostRm: 25,
      selectedBaselineCombinedCostRm: 22,
      selectedCurrentCombinedCostRm: 20,
      storeChoiceImpactRm: 3,
      itemChangeImpactRm: 2,
      netSavingRm: saving,
      comparableStoreCount: 3,
      estimatedPriceCount: 0,
      routeEstimated: false,
    },
    actualTotalRm,
    lines: [],
  };
}

describe("inbox reports", () => {
  it("creates one unread report for a completed week with activity", () => {
    const state = syncInboxReports(
      EMPTY_INBOX,
      [
        trip("a", "2026-09-07T10:00:00.000Z", 20, 5),
        trip("b", "2026-09-09T10:00:00.000Z", 30, 4),
      ],
      new Date("2026-09-14T08:00:00.000Z"),
    );

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      id: "weekly:2026-09-07",
      tripCount: 2,
      actualSpendingRm: 50,
      estimatedNetSavingsRm: 9,
      read: false,
    });
  });

  it("does not generate a message for the current incomplete period", () => {
    const state = syncInboxReports(
      EMPTY_INBOX,
      [trip("a", "2026-09-14T10:00:00.000Z", 20, 5)],
      new Date("2026-09-15T08:00:00.000Z"),
    );
    expect(state.messages).toEqual([]);
  });

  it("supports cadence, read state, persistence, and deduplication", () => {
    const monthly = setReportCadence(EMPTY_INBOX, "monthly");
    const generated = syncInboxReports(
      monthly,
      [trip("a", "2026-08-12T10:00:00.000Z", null, null)],
      new Date("2026-09-15T08:00:00.000Z"),
    );
    const duplicate = syncInboxReports(generated, [trip("a", "2026-08-12T10:00:00.000Z", null, null)], new Date("2026-09-15T08:00:00.000Z"));
    expect(duplicate.messages).toHaveLength(1);
    expect(duplicate.messages[0].spendingIncomplete).toBe(true);
    expect(duplicate.messages[0].savingsIncomplete).toBe(true);

    const read = markReportRead(duplicate, duplicate.messages[0].id);
    expect(read.messages[0].read).toBe(true);
    expect(parseInboxState(serializeInboxState(read))).toEqual(read);
    expect(parseInboxState("{broken")).toEqual(EMPTY_INBOX);
  });
});

describe("summary visibility setting (AC 8.4.3)", () => {
  it("defaults to visible so hiding is always an opt-in choice", () => {
    expect(EMPTY_INBOX.summaryHidden).toBe(false);
    expect(parseInboxState(null).summaryHidden).toBe(false);
  });

  it("normalises payloads written before the field existed", () => {
    // The version is deliberately unchanged: hiding a section is additive, so
    // an older payload must still parse rather than be discarded.
    const legacy = JSON.stringify({
      version: INBOX_VERSION,
      cadence: "weekly",
      messages: [],
    });
    const parsed = parseInboxState(legacy);
    expect(parsed).toEqual(EMPTY_INBOX);
    expect(parsed.summaryHidden).toBe(false);
  });

  it("treats any non-boolean value as visible instead of trusting it", () => {
    for (const bad of ["yes", 1, 0, null, {}, []]) {
      const parsed = parseInboxState(JSON.stringify({
        version: INBOX_VERSION,
        cadence: "weekly",
        messages: [],
        summaryHidden: bad,
      }));
      expect(parsed.summaryHidden).toBe(false);
    }
  });

  it("round-trips the hidden setting through local storage", () => {
    const hidden: InboxState = { ...EMPTY_INBOX, summaryHidden: true };
    const restored = parseInboxState(serializeInboxState(hidden));
    expect(restored.summaryHidden).toBe(true);
    expect(restored).toEqual(hidden);
  });

  it("keeps the setting when the cadence switches", () => {
    const hidden = setReportCadence({ ...EMPTY_INBOX, summaryHidden: true }, "monthly");
    expect(hidden.summaryHidden).toBe(true);
    expect(hidden.cadence).toBe("monthly");
  });

  it("keeps the setting when a report is marked read", () => {
    const generated = syncInboxReports(
      EMPTY_INBOX,
      [trip("a", "2026-08-12T10:00:00.000Z", 20, 3)],
      new Date("2026-09-15T08:00:00.000Z"),
    );
    const hidden: InboxState = { ...generated, summaryHidden: true };
    const read = markReportRead(hidden, hidden.messages[0].id);
    expect(read.summaryHidden).toBe(true);
    expect(read.messages[0].read).toBe(true);
  });

  it("is not reset by the automatic report sync", () => {
    // syncInboxReports runs from an effect on every history change, so losing
    // the field here would silently un-hide the summary on every app launch.
    const hidden = syncInboxReports(
      { ...EMPTY_INBOX, summaryHidden: true },
      [trip("a", "2026-08-12T10:00:00.000Z", 20, 3)],
      new Date("2026-09-15T08:00:00.000Z"),
    );
    expect(hidden.summaryHidden).toBe(true);
    expect(hidden.messages).toHaveLength(1);
  });
});
