import { afterEach, describe, expect, it, vi } from "vitest";
import { currentPlannedWeek, isPlannedWeek, plannedWeekLabel, plannedWeekOptions } from "./planned-week";
import { parseNextTrip, schedulePlannedItem, serializeNextTrip, type NextTripItem } from "./next-trip";

const item: NextTripItem = {
  id: "catalogue:1", source: "catalogue", catalogueItemId: "1", itemName: "Rice",
  itemNameEn: "Rice", itemNameMs: "Beras", category: null, sourceCategory: null,
  packageSize: "5 kg", quantity: 2,
};

afterEach(() => vi.useRealTimers());

describe("planned purchase weeks", () => {
  it("uses Malaysia's Monday boundary, including Sunday UTC and year rollover", () => {
    expect(currentPlannedWeek(new Date("2026-10-11T15:59:59Z"))).toBe("2026-10-05");
    expect(currentPlannedWeek(new Date("2026-10-11T16:00:00Z"))).toBe("2026-10-12");
    expect(plannedWeekOptions(new Date("2026-12-31T00:00:00Z"))).toEqual([
      "2026-12-28", "2027-01-04", "2027-01-11", "2027-01-18", "2027-01-25",
    ]);
  });

  it("only permits this week through four weeks ahead, and reschedules without duplicating", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T04:00:00Z"));
    const saved = schedulePlannedItem([], item, "2026-11-02");
    expect(saved).toEqual([{ ...item, plannedWeek: "2026-11-02" }]);
    expect(schedulePlannedItem(saved, item, "2026-10-05")).toEqual([{ ...item, plannedWeek: "2026-10-05" }]);
    for (const invalid of ["2026-09-28", "2026-11-09", "2026-10-06", "bad"]) {
      expect(schedulePlannedItem(saved, item, invalid)).toBe(saved);
    }
    expect(parseNextTrip(serializeNextTrip(saved))).toEqual(saved);
  });

  it("keeps legacy and overdue items, while rejecting malformed stored weeks", () => {
    expect(parseNextTrip(JSON.stringify({ version: 2, items: [item] }))).toEqual([item]);
    const past = { ...item, plannedWeek: "2025-12-29" };
    expect(parseNextTrip(serializeNextTrip([past]))).toEqual([past]);
    expect(parseNextTrip(serializeNextTrip([{ ...item, plannedWeek: "2026-10-06" }]))).toEqual([]);
    expect(isPlannedWeek("2026-02-30")).toBe(false);
    expect(isPlannedWeek("2026-10-05")).toBe(true);
    expect(plannedWeekLabel("2026-10-05", "en")).toContain("11 Oct 2026");
    expect(plannedWeekLabel(null, "en")).toBe("Week not set");
  });
});
