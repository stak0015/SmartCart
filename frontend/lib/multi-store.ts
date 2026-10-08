import type { TravelLimit, TravelLimitType } from "./contracts";

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
