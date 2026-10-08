import { describe, expect, it } from "vitest";

import {
  DEFAULT_MULTI_STORE_CONFIG,
  DISTANCE_LIMITS,
  TIME_LIMITS,
  activeLimitGroups,
  changeSecondStoreLimitType,
  disableMultiStore,
  isSupportedDistancePreset,
  isSupportedTimePreset,
  secondStoreLimitLabel,
  validateSecondStoreLimits,
  type MultiStoreConfig,
} from "./multi-store";

function config(partial: Partial<MultiStoreConfig>): MultiStoreConfig {
  return { ...DEFAULT_MULTI_STORE_CONFIG, ...partial };
}

describe("configured presets (AC 6.1.3 / AC 6.1.7)", () => {
  it("offers the same distance presets as initial location selection", () => {
    expect([...DISTANCE_LIMITS]).toEqual([2, 5, 10, 15]);
  });

  it("offers the same time presets as initial location selection", () => {
    expect([...TIME_LIMITS]).toEqual([10, 20, 30, 45]);
  });

  it("accepts only configured preset values", () => {
    expect(isSupportedDistancePreset(5)).toBe(true);
    expect(isSupportedTimePreset(45)).toBe(true);
    // A manually entered value such as 999 km is not a supported preset.
    expect(isSupportedDistancePreset(999)).toBe(false);
    expect(isSupportedTimePreset(7)).toBe(false);
    expect(isSupportedDistancePreset(null)).toBe(false);
    expect(isSupportedTimePreset(null)).toBe(false);
  });
});

describe("active limit groups (AC 6.1.3 / 6.1.7 / 6.1.8)", () => {
  it("shows only distance for the Distance constraint", () => {
    expect(activeLimitGroups("distance")).toEqual(["distance"]);
  });

  it("shows only time for the Time constraint", () => {
    expect(activeLimitGroups("time")).toEqual(["time"]);
  });

  it("shows both groups for the Both constraint", () => {
    expect(activeLimitGroups("both")).toEqual(["distance", "time"]);
  });
});

describe("defaults (AC 6.1.1)", () => {
  it("starts disabled with nothing applied and nothing preselected", () => {
    expect(DEFAULT_MULTI_STORE_CONFIG).toEqual({
      enabled: false,
      limitType: "distance",
      distanceKm: null,
      timeMinutes: null,
      applied: null,
    });
  });

  it("cannot apply while disabled", () => {
    const validation = validateSecondStoreLimits(config({ distanceKm: 5 }));
    expect(validation).toEqual({ ok: false, missing: ["distance"] });
  });
});

describe("applying valid presets (AC 6.1.9)", () => {
  it("applies a single distance preset", () => {
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "distance", distanceKm: 5 }),
    );
    expect(validation).toEqual({ ok: true, limit: { type: "distance", value: 5 } });
  });

  it("applies a single time preset", () => {
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "time", timeMinutes: 20 }),
    );
    expect(validation).toEqual({ ok: true, limit: { type: "time", value: 20 } });
  });

  it("applies both presets for the Both constraint", () => {
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "both", distanceKm: 5, timeMinutes: 20 }),
    );
    expect(validation).toEqual({
      ok: true,
      limit: { type: "both", distanceKm: 5, timeMinutes: 20 },
    });
  });

  it("ignores a stale selection from an inactive group", () => {
    // Picked 5 km, then switched to Time and picked 20 min: the remembered
    // distance must not take part in the applied limit.
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "time", distanceKm: 5, timeMinutes: 20 }),
    );
    expect(validation).toEqual({ ok: true, limit: { type: "time", value: 20 } });
  });
});

describe("rejecting missing or unsupported presets (AC 6.1.10)", () => {
  it("names the missing distance group", () => {
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "distance", distanceKm: null }),
    );
    expect(validation).toEqual({ ok: false, missing: ["distance"] });
  });

  it("names the missing time group", () => {
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "time", timeMinutes: null }),
    );
    expect(validation).toEqual({ ok: false, missing: ["time"] });
  });

  it("names both groups when Both has nothing selected", () => {
    const validation = validateSecondStoreLimits(config({ enabled: true, limitType: "both" }));
    expect(validation).toEqual({ ok: false, missing: ["distance", "time"] });
  });

  it("names only the group still missing under Both", () => {
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "both", distanceKm: 10, timeMinutes: null }),
    );
    expect(validation).toEqual({ ok: false, missing: ["time"] });
  });

  it("never substitutes a default for a missing selection", () => {
    // A missing group produces a rejection, not a silently chosen value.
    const validation = validateSecondStoreLimits(
      config({ enabled: true, limitType: "both", distanceKm: 10 }),
    );
    expect(validation.ok).toBe(false);
  });
});

describe("disabling multi-store mode (AC 6.1.6)", () => {
  it("collapses and drops the applied limit but keeps the selections", () => {
    const next = disableMultiStore(config({
      enabled: true,
      limitType: "both",
      distanceKm: 5,
      timeMinutes: 20,
      applied: { type: "both", distanceKm: 5, timeMinutes: 20 },
    }));
    expect(next.enabled).toBe(false);
    expect(next.applied).toBeNull();
    // Selections survive so re-enabling does not force the shopper to rechoose.
    expect(next.distanceKm).toBe(5);
    expect(next.timeMinutes).toBe(20);
    expect(next.limitType).toBe("both");
  });

  it("leaves a disabled config otherwise unchanged", () => {
    const before = config({ enabled: false, distanceKm: 10 });
    expect(disableMultiStore(before)).toEqual({ ...before, applied: null });
  });
});

describe("changing the constraint type (AC 6.1.8)", () => {
  it("keeps selections and clears the applied limit", () => {
    const next = changeSecondStoreLimitType(
      config({ enabled: true, limitType: "distance", distanceKm: 5, applied: { type: "distance", value: 5 } }),
      "both",
    );
    expect(next.limitType).toBe("both");
    expect(next.distanceKm).toBe(5);
    // The applied limit no longer describes the active groups, so it is dropped.
    expect(next.applied).toBeNull();
  });
});

describe("limit label", () => {
  it("labels distance, time and both limits for display", () => {
    expect(secondStoreLimitLabel({ type: "distance", value: 5 }, "min")).toBe("5 km");
    expect(secondStoreLimitLabel({ type: "time", value: 20 }, "min")).toBe("20 min");
    expect(secondStoreLimitLabel({ type: "both", distanceKm: 5, timeMinutes: 20 }, "min"))
      .toBe("5 km · 20 min");
  });
});
