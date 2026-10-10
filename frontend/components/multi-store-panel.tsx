"use client";

import { useEffect, useRef, useState } from "react";
import { DropdownChevron, UIIcon } from "./ui-icon";
import { type AppCopy } from "@/lib/i18n";
import type { TravelLimitType } from "@/lib/contracts";
import {
  DISTANCE_LIMITS,
  TIME_LIMITS,
  activeLimitGroups,
  changeSecondStoreLimitType,
  disableMultiStore,
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
 * Store plans opens an overlay; inside it, enabling the toggle reveals the
 * limits (AC 6.1.2) and disabling it hides them (AC 6.1.6). US 6.1 only
 * configures; the two-store plan calculation is US 6.2/6.3, so this component
 * never invents a plan — it only records the limit the shopper applied.
 */
export function MultiStorePanel({
  config,
  onChange,
  copy,
  routeError,
}: {
  config: MultiStoreConfig;
  onChange: (next: MultiStoreConfig) => void;
  copy: AppCopy;
  routeError?: string | null;
}) {
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

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

  return (
    <details ref={menuRef} id="multi-store-settings" className="store-plans-dropdown">
      <summary className="store-plans-trigger">
        <UIIcon name="route" size={18} />
        <span>{copy.storePlans}</span>
        {config.applied && <span className="store-plans-active" />}
        <DropdownChevron className="store-plans-chevron" />
      </summary>
      <section className={"multi-store-panel" + (config.limitType === "both" ? " has-both-limits" : "")} aria-label={copy.storePlans}>
        <div className="multi-store-header">
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label={copy.multiStorePlans}
            onClick={() => setEnabled(!config.enabled)}
            className="multi-store-toggle"
          >
            <UIIcon name="route" size={18} />
            <span>{copy.multiStorePlans}</span>
            <span className={"remember-switch " + (config.enabled ? "is-on" : "")} />
          </button>
        </div>

        {config.enabled && (
          <div className="multi-store-content">
            <div className="multi-store-intro">
              <h2>{copy.secondStoreTravelLimits}</h2>
              {/* AC 6.1.4: state which leg these limits govern — first store to
                  second store, not origin to first store. */}
              <p>{copy.secondStoreTravelLegNote}</p>
            </div>
            <div className="multi-store-controls">
              <div className="multi-store-types" role="group" aria-label={copy.secondStoreLimitType}>
                {(["distance", "time", "both"] as const).map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setLimitType(type)}
                    aria-pressed={config.limitType === type}
                  >
                    {type === "both" ? copy.both : type === "distance" ? copy.distance : copy.travelTime}
                  </button>
                ))}
              </div>

              {/* AC 6.1.3 / 6.1.7 / 6.1.8: render exactly the active groups, using
                  preset buttons only — no manual numeric input. */}
              <div className="multi-store-presets">
                {groups.map(group => (
                  <fieldset key={group}>
                    <legend>{group === "distance" ? copy.distance : copy.travelTime}</legend>
                    <div>
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
                          >
                            {value}{group === "distance" ? " km" : " min"}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>

              <button
                type="button"
                onClick={apply}
                className="multi-store-apply"
              >
                {copy.applyLimits}
              </button>
            </div>
            {(error || routeError) && <p role="alert" className="multi-store-error">{error || routeError}</p>}
          </div>
        )}
      </section>
    </details>
  );
}
