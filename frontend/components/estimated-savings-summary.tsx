"use client";
// Owner: Shun

import type { EstimatedSavingsSnapshot } from "@/lib/estimated-savings";
import { formatRm } from "@/lib/format-rm";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Estimated savings",
    unavailable: "A comparable median plan cost is not available yet.",
    less: (amount: string) => `Estimated ${amount} savings vs the median plan, including travel.`,
    above: (amount: string) => `Estimated ${amount} above the median plan, including travel.`,
    same: "About the same cost as the median plan, including travel.",
    swapsOnly: (amount: string) => `Your applied item changes reduce this basket by ${amount}.`,
    swapsCostMore: (amount: string) => `Your applied item changes add ${amount} to this basket.`,
    storeChoice: "Plan choice",
    itemChanges: "Item changes",
  },
  ms: {
    title: "Anggaran penjimatan",
    unavailable: "Kos median pelan setara belum tersedia.",
    less: (amount: string) => `Anggaran penjimatan ${amount} berbanding median pelan, termasuk perjalanan.`,
    above: (amount: string) => `Anggaran ${amount} melebihi median pelan, termasuk perjalanan.`,
    same: "Kos hampir sama dengan median pelan, termasuk perjalanan.",
    swapsOnly: (amount: string) => `Perubahan item anda mengurangkan bakul ini sebanyak ${amount}.`,
    swapsCostMore: (amount: string) => `Perubahan item anda menambah ${amount} kepada bakul ini.`,
    storeChoice: "Pilihan pelan",
    itemChanges: "Perubahan item",
  },
} as const;

function signedAmount(value: number): string {
  if (value === 0) return formatRm(0);
  return `${value > 0 ? "+" : "−"}${formatRm(Math.abs(value))}`;
}

export function EstimatedSavingsSummary({
  snapshot,
  locale,
}: {
  snapshot: EstimatedSavingsSnapshot;
  locale: Locale;
}) {
  const text = TEXT[locale];
  const net = snapshot.netSavingRm;
  const hasMedian = snapshot.medianCombinedCostRm != null && snapshot.comparableStoreCount >= 2;
  const itemImpact = snapshot.itemChangeImpactRm;
  const title = text.title;
  const showItemChanges = itemImpact != null && itemImpact > 0;
  const headline = net == null
    ? text.unavailable
    : hasMedian
      ? net > 0
        ? text.less(formatRm(net))
        : net < 0
          ? text.above(formatRm(Math.abs(net)))
          : text.same
      : itemImpact != null && itemImpact > 0
        ? text.swapsOnly(formatRm(itemImpact))
        : itemImpact != null && itemImpact < 0
          ? text.swapsCostMore(formatRm(Math.abs(itemImpact)))
          : text.unavailable;

  return (
    <section
      aria-labelledby="estimated-savings-title"
      className="rounded-lg border border-[#dce5e0] bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="estimated-savings-title" className="text-base font-bold text-[#10152e]">{title}</h2>
        </div>
        {net != null && net > 0 ? (
          <p className="text-base font-bold text-[#007d38]">{formatRm(net)}</p>
        ) : null}
      </div>

      <p className="mt-2 text-xs leading-5 text-[#526078]">{headline}</p>

      {(snapshot.storeChoiceImpactRm != null || showItemChanges) ? (
        <dl className="mt-3 space-y-2 border-t border-[#dce5e0] pt-3">
          {snapshot.storeChoiceImpactRm != null ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-[#526078]">{text.storeChoice}</dt>
              <dd className={`whitespace-nowrap text-[13px] font-bold ${snapshot.storeChoiceImpactRm >= 0 ? "text-[#007d38]" : "text-[#9b3d00]"}`}>
                {signedAmount(snapshot.storeChoiceImpactRm)}
              </dd>
            </div>
          ) : null}
          {showItemChanges ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-[#526078]">{text.itemChanges}</dt>
              <dd className={`whitespace-nowrap text-[13px] font-bold ${itemImpact >= 0 ? "text-[#007d38]" : "text-[#9b3d00]"}`}>
                {signedAmount(itemImpact)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

    </section>
  );
}
