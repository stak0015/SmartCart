import type {
  PlanStoreAssignment,
  PricedPlan,
  TravelLimit,
  TravelLimitType,
} from "./contracts";

// AC 6.1.3 / AC 6.1.7: the second-store menu must offer "the same configured
// options as initial location selection". Both menus import these arrays from
// here, so the two option sets cannot drift apart — changing a preset updates
// the location screen and the second-store menu together.
export const DISTANCE_LIMITS = [2, 5, 10, 15] as const;
export const TIME_LIMITS = [10, 20, 30, 45] as const;

export type DistancePreset = (typeof DISTANCE_LIMITS)[number];
export type TimePreset = (typeof TIME_LIMITS)[number];

/** AC 6.1.9: a limit value only counts as supported if it is one of the
 * configured preset buttons. Nothing outside the presets is accepted, which
 * is what makes a manual numeric input unnecessary. */
export function isSupportedDistancePreset(value: number | null): value is DistancePreset {
  return value !== null && (DISTANCE_LIMITS as readonly number[]).includes(value);
}

export function isSupportedTimePreset(value: number | null): value is TimePreset {
  return value !== null && (TIME_LIMITS as readonly number[]).includes(value);
}

/**
 * Multi-store configuration state (US 6.1).
 *
 * `distanceKm` / `timeMinutes` stay null until the shopper picks a preset. They
 * are deliberately not pre-filled with a default, because AC 6.1.10 requires a
 * missing selection to block submission rather than be silently substituted —
 * a hidden default would make that requirement untestable and would let a plan
 * be applied under limits the shopper never chose.
 *
 * `applied` holds the limit that the current recommendation request was built
 * with, so the UI can show what is actually in force and so AC 6.4.6 can
 * restore the highlight after navigating back.
 */
export interface MultiStoreConfig {
  enabled: boolean;
  limitType: TravelLimitType;
  distanceKm: number | null;
  timeMinutes: number | null;
  applied: TravelLimit | null;
}

/** AC 6.1.1: multi-store plans are off and the second-store menu is collapsed
 * for a new recommendation session. */
export const DEFAULT_MULTI_STORE_CONFIG: MultiStoreConfig = {
  enabled: false,
  limitType: "distance",
  distanceKm: null,
  timeMinutes: null,
  applied: null,
};

/** The preset groups the menu must render for a constraint type.
 * AC 6.1.3 -> distance only, AC 6.1.7 -> time only, AC 6.1.8 -> both. */
export function activeLimitGroups(
  limitType: TravelLimitType,
): readonly ("distance" | "time")[] {
  if (limitType === "distance") return ["distance"];
  if (limitType === "time") return ["time"];
  return ["distance", "time"];
}

export type SecondStoreValidation =
  | { ok: true; limit: TravelLimit }
  | { ok: false; missing: readonly ("distance" | "time")[] };

/**
 * AC 6.1.9 / AC 6.1.10: a config is applicable only when every active group
 * has a supported preset selected. Anything else is reported as missing so the
 * caller can name the offending group instead of guessing a value.
 *
 * An inactive group's stale selection is ignored rather than rejected: picking
 * a distance, switching to Time and applying is valid, and the remembered
 * distance simply does not take part.
 */
export function validateSecondStoreLimits(config: MultiStoreConfig): SecondStoreValidation {
  if (!config.enabled) return { ok: false, missing: activeLimitGroups(config.limitType) };

  const groups = activeLimitGroups(config.limitType);
  const missing = groups.filter(group => group === "distance"
    ? !isSupportedDistancePreset(config.distanceKm)
    : !isSupportedTimePreset(config.timeMinutes));
  if (missing.length > 0) return { ok: false, missing };

  const distance = config.distanceKm as DistancePreset;
  const minutes = config.timeMinutes as TimePreset;
  if (config.limitType === "both") {
    return { ok: true, limit: { type: "both", distanceKm: distance, timeMinutes: minutes } };
  }
  if (config.limitType === "distance") {
    return { ok: true, limit: { type: "distance", value: distance } };
  }
  return { ok: true, limit: { type: "time", value: minutes } };
}

/** A human-readable label for an applied limit, used in the summary line and in
 * the note that explains what the recalculation is bound by. */
export function secondStoreLimitLabel(limit: TravelLimit, minutesWord: string): string {
  if (limit.type === "both") return `${limit.distanceKm} km · ${limit.timeMinutes} ${minutesWord}`;
  return limit.type === "distance" ? `${limit.value} km` : `${limit.value} ${minutesWord}`;
}

/**
 * AC 6.1.6: disabling multi-store mode removes two-store plans but leaves the
 * single-store recommendations and the basket untouched. The returned config
 * clears the applied limit (so no two-store plan can be requested) while
 * keeping the shopper's preset selections, so re-enabling does not force them
 * to choose again.
 */
export function disableMultiStore(config: MultiStoreConfig): MultiStoreConfig {
  return { ...config, enabled: false, applied: null };
}

/** Switching constraint type keeps each group's existing selection so that
 * AC 6.1.8 can show both groups already populated when one was chosen before. */
export function changeSecondStoreLimitType(
  config: MultiStoreConfig,
  limitType: TravelLimitType,
): MultiStoreConfig {
  // A change of constraint type invalidates whatever was applied, because the
  // applied limit no longer describes the active groups.
  return { ...config, limitType, applied: null };
}

// ── US 6.3: combined-cost comparison view state ───────────────────────────────

/**
 * How a two-store plan's saving against single-store plans should be shown.
 *
 * This is a pure decision so the AC 6.3.5 / 6.3.6 rules are unit-testable and
 * the render layer cannot accidentally invent a number:
 * - "none"  (AC 6.3.6): no baseline existed; show no numeric saving at all.
 * - "save": strictly positive saving; show how much it saves.
 * - "more": negative saving; splitting costs more — shown explicitly rather
 *           than hidden, so a more expensive split is never implied to be a win.
 * - "equal": zero saving; neither better nor worse, so no money claim is made.
 */
export type SavingState = "none" | "save" | "more" | "equal";

/** AC 6.3.5/6.3.6: classify a two-store plan's saving for display. `savingRm`
 * is the backend's `savingVsSingleRm`, which is null when there was no eligible
 * complete single-store baseline. A null is never rendered as RM0. */
export function savingState(savingRm: number | null): SavingState {
  if (savingRm === null || savingRm === undefined) return "none";
  if (savingRm > 0) return "save";
  if (savingRm < 0) return "more";
  return "equal";
}

/**
 * AC 6.3.4: a plan is "incomplete" when the backend says so. The incomplete set
 * is rendered separately and never ranked among complete plans, so this is kept
 * as a single predicate rather than re-deriving it in the JSX.
 */
export function isPlanComplete(plan: { isComplete: boolean }): boolean {
  return plan.isComplete;
}

// ── US 6.4: inspecting one two-store plan ─────────────────────────────────────

/** One store's share of a two-store plan, with every line assigned to it. */
export interface PlanStoreGroup {
  storePremiseId: string;
  storeName: string;
  lines: PlanStoreAssignment[];
  // Sum of this store's assigned line totals.
  subtotalRm: number;
}

/**
 * AC 6.4.2: group a plan's assigned lines by the store that buys them, in the
 * visit order the plan uses (storePremiseIds[0] is visited first).
 *
 * Grouping by store — rather than rendering one flat list — is what lets AC
 * 6.4.3 keep each store's own labels beside its own lines. A line can only ever
 * appear under the store it was assigned to, so a store's freshness/source
 * labels cannot be applied to another store's items by construction.
 *
 * A store with no assigned lines is still included (empty), so the detail view
 * can say so honestly instead of silently dropping it.
 */
export function groupAssignmentsByStore(plan: PricedPlan): PlanStoreGroup[] {
  return plan.storePremiseIds.map((storePremiseId, index) => {
    const lines = plan.assignments.filter(line => line.storePremiseId === storePremiseId);
    const subtotalRm = lines.reduce((total, line) => total + line.lineTotalRm, 0);
    return {
      storePremiseId,
      storeName: plan.storeNames[index] ?? plan.storeNames[0] ?? storePremiseId,
      lines,
      // Round to cents to avoid float drift from summing line totals.
      subtotalRm: Math.round((subtotalRm + Number.EPSILON) * 100) / 100,
    };
  });
}

/**
 * AC 6.4.1: the human label for one journey leg. The leg's own `role` names the
 * segment, so the detail view explains the trip in order and can flag which leg
 * the second-store limits govern (the first-to-second leg only).
 */
export function legRoleKey(
  role: "origin_to_first" | "first_to_second" | "second_to_origin",
): "legOriginToFirst" | "legFirstToSecond" | "legSecondToOrigin" {
  if (role === "origin_to_first") return "legOriginToFirst";
  if (role === "first_to_second") return "legFirstToSecond";
  return "legSecondToOrigin";
}
