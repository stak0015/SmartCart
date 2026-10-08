"use client";

import { useState } from "react";
import { UIIcon } from "./ui-icon";
import { type AppCopy } from "@/lib/i18n";
import type { TravelLimitType } from "@/lib/contracts";
import {
  DISTANCE_LIMITS,
  TIME_LIMITS,
  activeLimitGroups,
  changeSecondStoreLimitType,
  disableMultiStore,
  secondStoreLimitLabel,
  validateSecondStoreLimits,
  type MultiStoreConfig,
} from "@/lib/multi-store";

/**
 * US 6.1 — the "Include multi-store plans" toggle and the expandable
 * Second-store travel limits menu on the recommendation page.
 *
 * Fully controlled: every edit is pushed to the parent through onChange, so the
 * configuration lives in one place and survives navigating away and back
 * (AC 6.4.4 / AC 6.4.6). Preset values come from the shared DISTANCE_LIMITS /
 * TIME_LIMITS in lib/multi-store.ts — the same source the location screen uses —
 * which is what makes AC 6.1.3 / AC 6.1.7's "same configured options" hold
 * structurally rather than by convention.
 *
 * Expansion is tied to `enabled`: enabling the toggle expands the menu
 * (AC 6.1.2) and disabling it collapses the menu (AC 6.1.6). US 6.1 only
 * configures; the two-store plan calculation is US 6.2/6.3, so this component
 * never invents a plan — it only records the limit the shopper applied.
 */
export function MultiStorePanel({
  config,
  onChange,
  copy,
}: {
  config: MultiStoreConfig;
  onChange: (next: MultiStoreConfig) => void;
  copy: AppCopy;
}) {
  const [error, setError] = useState("");

  const groups = activeLimitGroups(config.limitType);

  const setEnabled = (enabled: boolean) => {
    setError("");
    // AC 6.1.6: disabling collapses the menu and drops any applied limit so no
    // two-store plan can be requested, while the shopper's preset selections are
    // kept so re-enabling does not force them to choose again. The basket and
    // the single-store recommendations are never touched here.
    onChange(enabled ? { ...config, enabled: true } : disableMultiStore(config));
  };

  const setLimitType = (limitType: TravelLimitType) => {
    setError("");
    // AC 6.1.8: switching constraint type invalidates whatever was applied and
    // keeps each group's selection so Both can show both groups populated.
    onChange(changeSecondStoreLimitType(config, limitType));
  };

  const selectPreset = (group: "distance" | "time", value: number) => {
    setError("");
    // AC 6.1.5: selecting a preset highlights it immediately. It does not
    // re-apply on its own — the shopper presses Apply limits (AC 6.1.9).
    onChange(group === "distance"
      ? { ...config, distanceKm: value }
      : { ...config, timeMinutes: value });
  };

  const apply = () => {
    const validation = validateSecondStoreLimits(config);
    if (!validation.ok) {
      // AC 6.1.10: block submission and name the missing group rather than
      // silently substituting a default.
      setError(validation.missing.length === 2
        ? copy.secondStoreLimitRequired
        : validation.missing[0] === "distance"
          ? copy.secondStoreDistanceRequired
          : copy.secondStoreTimeRequired);
      return;
    }
    setError("");
    // AC 6.1.9: record the applied limit; the parent re-requests recommendations.
    onChange({ ...config, applied: validation.limit });
  };

  const summary = config.applied
    ? copy.multiStorePlansSummary(secondStoreLimitLabel(config.applied, copy.minutes))
    : copy.multiStorePlansOff;

  return (
    <section className={"multi-store-panel preference-panel " + (config.enabled ? "preference-open" : "")}>
      <button
        type="button"
        role="switch"
        aria-checked={config.enabled}
        aria-label={copy.multiStorePlans}
        onClick={() => setEnabled(!config.enabled)}
        className="remember-preferences"
      >
        <UIIcon name="history" size={20} />
        <span>{copy.multiStorePlans}</span>
        <span className={"remember-switch " + (config.enabled ? "is-on" : "")} />
      </button>

      {config.enabled && (
        <div className="preference-content">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10152e]">{copy.secondStoreTravelLimits}</h2>
            {/* AC 6.1.4: state which leg these limits govern — first store to
                second store, not origin to first store. */}
            <p className="mt-1 text-[16px] text-[#3e494a]">{copy.secondStoreTravelLegNote}</p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-[#718078]">{summary}</p>

          <div className="grid grid-cols-3 rounded-xl bg-[#e8efeb] p-1" aria-label={copy.secondStoreLimitType}>
            {(["distance", "time", "both"] as const).map(type => (
              <button
                type="button"
                key={type}
                onClick={() => setLimitType(type)}
                aria-pressed={config.limitType === type}
                className={"min-h-11 rounded-lg px-3 text-sm font-bold " + (config.limitType === type ? "bg-white text-[#007d38] shadow-sm" : "text-[#526078]")}
              >
                {type === "both" ? copy.both : type === "distance" ? copy.distance : copy.travelTime}
              </button>
            ))}
          </div>

          {/* AC 6.1.3 / 6.1.7 / 6.1.8: render exactly the active groups, using
              preset buttons only — no manual numeric input. */}
          {groups.map(group => (
            <fieldset key={group}>
              <legend className="mb-2 text-sm font-semibold">{group === "distance" ? copy.distance : copy.travelTime}</legend>
              <div className="grid grid-cols-4 gap-2">
                {(group === "distance" ? DISTANCE_LIMITS : TIME_LIMITS).map(value => {
                  const selected = group === "distance"
                    ? config.distanceKm === value
                    : config.timeMinutes === value;
                  return (
                    <button
                      type="button"
                      key={value}
                      onClick={() => selectPreset(group, value)}
                      aria-pressed={selected}
                      className={"h-12 rounded-xl border px-2 text-sm font-bold " + (selected ? "border-[#007d38] bg-[#007d38] text-white" : "border-[#dce5e0] bg-white text-[#405149]")}
                    >
                      {value}{group === "distance" ? " km" : " min"}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {error && <p role="alert" className="text-sm font-medium text-[#ba1a1a]">{error}</p>}

          <button
            type="button"
            onClick={apply}
            className="h-12 w-full rounded-xl border border-[#007d38] bg-[#007d38] text-sm font-bold text-white"
          >
            {copy.applyLimits}
          </button>

          {config.applied && (
            <p className="text-sm text-[#526078]">
              {copy.secondStoreLimitsApplied(secondStoreLimitLabel(config.applied, copy.minutes))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
