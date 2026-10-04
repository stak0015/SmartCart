"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getFestivalAlerts } from "@/lib/festival-api";
import type { FestivalAlert } from "@/lib/festival-contracts";
import {
  ALERT_STATE_STORAGE_KEY,
  MALAYSIA_STATES,
  inferStateFromLabel,
  isMalaysiaState,
  type MalaysiaState,
} from "@/lib/festival-alert-state";
import type { Locale } from "@/lib/i18n";

const DISMISSED_KEY = "smartcart.festival-alert-dismissed";

const TEXT = {
  en: {
    title: "Prices may rise before these festivals",
    window: "Expected price-rise window",
    affected: (count: number) => `${count} affected item${count === 1 ? "" : "s"}`,
    expand: "View affected items",
    evidence: "View evidence",
    dismiss: "Dismiss",
    state: "Your state",
    allStates: "All Malaysia (national festivals)",
  },
  ms: {
    title: "Harga mungkin naik sebelum perayaan ini",
    window: "Tetingkap kenaikan harga dijangka",
    affected: (count: number) => `${count} item terjejas`,
    expand: "Lihat item terjejas",
    evidence: "Lihat bukti",
    dismiss: "Tutup",
    state: "Negeri anda",
    allStates: "Seluruh Malaysia (perayaan kebangsaan)",
  },
} as const;

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

function alertKey(alert: FestivalAlert): string {
  return `${alert.festival_id}|${alert.rise_start}|${alert.rise_end}`;
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

export default function FestivalAlertBanner({
  locale,
  locationLabel,
}: {
  locale: Locale;
  locationLabel?: string | null;
}) {
  const text = TEXT[locale];
  const router = useRouter();
  const inferredState = inferStateFromLabel(locationLabel);
  const [selectedState, setSelectedState] = useState<MalaysiaState | null>(null);
  const [alerts, setAlerts] = useState<FestivalAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [alertDate, setAlertDate] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    setDismissed(readDismissed());
    const params = new URLSearchParams(window.location.search);
    const queryState = params.get("alertState");
    const stored = sessionStorage.getItem(ALERT_STATE_STORAGE_KEY);
    const initial = inferStateFromLabel(locationLabel)
      ?? (isMalaysiaState(queryState) ? queryState : null)
      ?? (isMalaysiaState(stored) ? stored : null);
    if (initial) setSelectedState(initial);
    setAlertDate(params.get("alertDate"));
  }, [locationLabel]);

  useEffect(() => {
    if (inferredState && inferredState !== selectedState) {
      setSelectedState(inferredState);
      sessionStorage.setItem(ALERT_STATE_STORAGE_KEY, inferredState);
    }
  }, [inferredState, selectedState]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    getFestivalAlerts(selectedState, alertDate, controller.signal)
      .then(payload => {
        setAlerts(payload.alerts);
        setStatus("ready");
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [selectedState, alertDate]);

  const visibleAlerts = useMemo(
    () => alerts.filter(alert => !dismissed.has(alertKey(alert))),
    [alerts, dismissed],
  );

  if (status !== "ready" || visibleAlerts.length === 0) return null;

  const names = visibleAlerts
    .map(alert => locale === "en" ? alert.name_en : alert.name_ms)
    .join(", ");
  const totalItems = visibleAlerts.reduce((total, alert) => total + alert.affected_item_count, 0);

  const dismiss = () => {
    const next = new Set(dismissed);
    visibleAlerts.forEach(alert => next.add(alertKey(alert)));
    setDismissed(next);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  };

  return (
    <aside role="status" className="mx-4 mt-4 rounded-2xl border border-[#f0c36b] bg-[#fff8e8] p-4 shadow-[0_6px_20px_rgba(120,77,0,0.08)] sm:mx-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 text-xl">⚠</span>
          <div>
            <p className="text-base font-extrabold text-[#6f4300]">{text.title}</p>
            <p className="mt-1 text-sm font-bold text-[#7a4b00]">{names}</p>
            <p className="mt-1 text-xs text-[#7a5b2b]">{text.affected(totalItems)}</p>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="rounded-lg px-2 py-1 text-xs font-bold text-[#7a4b00] underline underline-offset-2">
          {text.dismiss}
        </button>
      </div>

      <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-[#6f4300]">
        <span>{text.state}</span>
        <select
          value={selectedState ?? ""}
          onChange={event => {
            const next = isMalaysiaState(event.target.value) ? event.target.value : null;
            setSelectedState(next);
            if (next) sessionStorage.setItem(ALERT_STATE_STORAGE_KEY, next);
            else sessionStorage.removeItem(ALERT_STATE_STORAGE_KEY);
          }}
          className="min-h-9 rounded-lg border border-[#e1b75e] bg-white px-2 text-xs font-semibold text-[#10152e]"
        >
          <option value="">{text.allStates}</option>
          {MALAYSIA_STATES.map(state => <option key={state} value={state}>{state}</option>)}
        </select>
      </label>

      <div className="mt-3 space-y-2">
        {visibleAlerts.map(alert => (
          <div key={alert.festival_id} className="rounded-xl border border-[#eed79f] bg-white/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-[#10152e]">{locale === "en" ? alert.name_en : alert.name_ms}</p>
                <p className="mt-1 text-xs text-[#526078]">{text.window}: {formatDate(alert.rise_start, locale)} – {formatDate(alert.rise_end, locale)}</p>
              </div>
              <button type="button" onClick={() => router.push(alert.evidence_url)} className="rounded-lg bg-[#007d38] px-3 py-2 text-xs font-extrabold text-white">
                {text.evidence}
              </button>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-bold text-[#006b31]">{text.expand} ({alert.affected_item_count})</summary>
              <ul className="mt-2 grid gap-1 text-xs text-[#526078] sm:grid-cols-2">
                {alert.affected_items.slice(0, 12).map(item => (
                  <li key={item.item_code}>{item.item_name} · {item.rise_pct}%</li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>
    </aside>
  );
}
