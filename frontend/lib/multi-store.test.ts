import { describe, expect, it } from "vitest";

import type { PricedPlan } from "./contracts";
import {
  DEFAULT_MULTI_STORE_CONFIG,
  DISTANCE_LIMITS,
  TIME_LIMITS,
  activeLimitGroups,
  changeSecondStoreLimitType,
  disableMultiStore,
  groupAssignmentsByStore,
  isSupportedDistancePreset,
  isSupportedTimePreset,
  legRoleKey,
  savingState,
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

describe("saving state (US 6.3 display)", () => {
  it("AC 6.3.5: a positive saving is shown as a saving", () => {
    expect(savingState(12.5)).toBe("save");
  });

  it("AC 6.3.5: a negative saving is shown as costing more, not hidden", () => {
    // A split that costs more must never be implied to be a win, so the sign is
    // preserved and mapped to its own state.
    expect(savingState(-4.2)).toBe("more");
  });

  it("AC 6.3.6: a null saving (no eligible baseline) shows no number", () => {
    // The critical invariant: null must not become a "RM0 saving".
    expect(savingState(null)).toBe("none");
  });

  it("AC 6.3.6: an undefined saving also shows no number", () => {
    expect(savingState(undefined as unknown as null)).toBe("none");
  });

  it("a zero saving makes no money claim", () => {
    expect(savingState(0)).toBe("equal");
  });

  it("treats a tiny positive saving as a real saving", () => {
    expect(savingState(0.01)).toBe("save");
  });

  it("treats a tiny negative saving as costing more", () => {
    expect(savingState(-0.01)).toBe("more");
  });
});

// A minimal two-store plan whose assignments span both stores, for grouping tests.
function twoStorePlan(): PricedPlan {
  return {
    planId: "two:1:2",
    storeCount: 2,
    storePremiseIds: ["1", "2"],
    storeNames: ["Kedai A", "Kedai B"],
    basketSubtotalRm: 30,
    transportCostRm: 5,
    combinedTotalRm: 35,
    isComplete: true,
    pricedLineCount: 3,
    basketLineCount: 3,
    missingItems: [],
    totalTravelMinutes: 30,
    totalRouteDistanceKm: 12,
    assignments: [
      { itemId: "a", itemName: "Rice", quantity: 2, unitPriceRm: 10, lineTotalRm: 20, storePremiseId: "1", storeName: "Kedai A", unit: "1 kg", observedDate: "2026-08-20" },
      { itemId: "b", itemName: "Oil", quantity: 1, unitPriceRm: 6, lineTotalRm: 6, storePremiseId: "2", storeName: "Kedai B", unit: "1 L", observedDate: null },
      { itemId: "c", itemName: "Sugar", quantity: 1, unitPriceRm: 4, lineTotalRm: 4, storePremiseId: "1", storeName: "Kedai A", unit: null, observedDate: "2026-08-18" },
    ],
    interStoreDistanceKm: 4,
    interStoreTravelMinutes: 8,
    legs: [],
    reverseOrderCostRm: null,
    savingVsSingleRm: null,
  };
}

describe("group assignments by store (AC 6.4.2 / 6.4.3)", () => {
  it("groups every line under the store assigned to it, in visit order", () => {
    const groups = groupAssignmentsByStore(twoStorePlan());
    expect(groups.map(group => group.storePremiseId)).toEqual(["1", "2"]);
    // Kedai A gets the two lines assigned to it; Kedai B gets its one line.
    expect(groups[0].lines.map(line => line.itemId)).toEqual(["a", "c"]);
    expect(groups[1].lines.map(line => line.itemId)).toEqual(["b"]);
  });

  it("computes each store's own subtotal from its own lines only", () => {
    const groups = groupAssignmentsByStore(twoStorePlan());
    // 20 + 4 = 24 for store 1, 6 for store 2 — never mixed across stores.
    expect(groups[0].subtotalRm).toBe(24);
    expect(groups[1].subtotalRm).toBe(6);
  });

  it("keeps a store with no assigned lines as an empty group", () => {
    const plan = twoStorePlan();
    plan.assignments = plan.assignments.filter(line => line.storePremiseId === "1");
    const groups = groupAssignmentsByStore(plan);
    // Store 2 is still present and honest about being empty rather than dropped.
    expect(groups).toHaveLength(2);
    expect(groups[1].lines).toEqual([]);
    expect(groups[1].subtotalRm).toBe(0);
  });

  it("sums store subtotals to the plan basket subtotal", () => {
    const groups = groupAssignmentsByStore(twoStorePlan());
    const summed = groups.reduce((total, group) => total + group.subtotalRm, 0);
    expect(summed).toBe(30);
  });
});

describe("leg role label (AC 6.4.1)", () => {
  it("maps each journey segment to its own copy key", () => {
    expect(legRoleKey("origin_to_first")).toBe("legOriginToFirst");
    expect(legRoleKey("first_to_second")).toBe("legFirstToSecond");
    expect(legRoleKey("second_to_origin")).toBe("legSecondToOrigin");
  });
});
