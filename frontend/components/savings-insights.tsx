"use client";

import { formatRm } from "@/lib/format-rm";
import type { AppCopy } from "@/lib/i18n";
import type {
  PriceSavingsInsight,
  SavingsInsights,
  TravelSavingsInsight,
} from "@/lib/savings-insights";

// AC 8.2.1/8.2.2/8.2.3: a stateless summary of what SmartCart could save the
// shopper. It renders whatever insights it is handed and never derives an
// amount of its own, so the estimate/potential wording cannot drift from the
// calculation. Placement is decided when expense records (US 5.4) land; until
// then nothing imports this component.
export interface SavingsInsightsSummaryProps {
  insights: SavingsInsights;
  copy: AppCopy;
}

// The badge is driven by the insight kind rather than chosen by the component,
// so a potential price saving can never be relabelled as money already saved.
function KindBadge({ kind, copy }: { kind: SavingsInsights["travel"]["kind"]; copy: AppCopy }) {
  const label = kind === "estimate" ? copy.estimateBadge : copy.potentialBadge;
  const theme = kind === "estimate"
    ? "bg-[#dceef2] text-[#00535b]"
    : "bg-[#f0e6d2] text-[#6b4f10]";
  return (
    <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${theme}`}>
      {label}
    </span>
  );
}

function TravelSavingsRow({ insight, copy }: { insight: TravelSavingsInsight; copy: AppCopy }) {
  if (!insight.available || insight.savingsRm == null || !insight.cheaperStoreName) return null;

  return (
    <li className="flex flex-col gap-1 rounded-xl border border-[#d9e1dd] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-[#10231d]">{copy.travelSavingsLabel}</p>
        <KindBadge kind={insight.kind} copy={copy} />
      </div>
      <p className="text-[18px] font-extrabold text-[#087f5b]">{formatRm(insight.savingsRm)}</p>
      <p className="text-xs leading-5 text-[#53635c]">
        {copy.travelSavingsDetail(
          formatRm(insight.savingsRm),
          insight.cheaperStoreName,
        )}
      </p>
      <p className="text-[11px] leading-4 text-[#617069]">{copy.travelEstimateNote}</p>
      {insight.routeEstimated && (
        <p className="text-[11px] leading-4 text-[#6d5700]">
          {copy.straightLineTravelNote}
          {insight.routeWarning ? ` ${insight.routeWarning}` : ""}
        </p>
      )}
    </li>
  );
}

function PriceSavingsRow({ insight, copy }: { insight: PriceSavingsInsight; copy: AppCopy }) {
  if (!insight.available || insight.savingsRm == null || !insight.cheaperStoreName) return null;

  return (
    <li className="flex flex-col gap-1 rounded-xl border border-[#d9e1dd] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-[#10231d]">{copy.potentialPriceSavingsLabel}</p>
        <KindBadge kind={insight.kind} copy={copy} />
      </div>
      <p className="text-[18px] font-extrabold text-[#7a4d00]">{formatRm(insight.savingsRm)}</p>
      <p className="text-xs leading-5 text-[#53635c]">
        {copy.potentialPriceSavingsDetail(
          formatRm(insight.savingsRm),
          insight.cheaperStoreName,
        )}
      </p>
      {insight.myComparableSubtotalRm != null && insight.cheaperComparableSubtotalRm != null && (
        <p className="text-xs font-semibold text-[#3f4944]">
          {formatRm(insight.myComparableSubtotalRm)} → {formatRm(insight.cheaperComparableSubtotalRm)}
        </p>
      )}
      <p className="text-[11px] leading-4 text-[#617069]">
        {copy.comparableItemsNote(insight.comparableLineCount, insight.basketLineCount)}
      </p>
      {insight.medianLineCount > 0 && (
        <p className="text-[11px] leading-4 text-[#6d5700]">{copy.mixedPriceSourcesNote}</p>
      )}
      <p className="text-[11px] leading-4 text-[#617069]">{copy.potentialNotActualNote}</p>
    </li>
  );
}

export function SavingsInsightsSummary({ insights, copy }: SavingsInsightsSummaryProps) {
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5"
      aria-label={copy.savingsInsightsTitle}
    >
      <h2 className="text-[18px] font-extrabold leading-6 text-[#10231d]">
        {copy.savingsInsightsTitle}
      </h2>

      {insights.hasAny ? (
        <ul className="flex flex-col gap-2">
          <TravelSavingsRow insight={insights.travel} copy={copy} />
          <PriceSavingsRow insight={insights.price} copy={copy} />
        </ul>
      ) : (
        <p className="text-[13px] leading-5 text-[#53635c]">{copy.noSavingsInsights}</p>
      )}
    </section>
  );
}
