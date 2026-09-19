"use client";

import type { EstimatedSavingsSnapshot } from "@/lib/estimated-savings";
import { formatRm } from "@/lib/format-rm";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Estimated savings",
    differenceTitle: "Estimated cost difference",
    unavailable: "A like-for-like savings estimate is not available yet.",
    less: (amount: string) => `You could spend an estimated ${amount} less than a typical recommended store.`,
    above: (amount: string) => `This plan is ${amount} above the typical recommended-store cost.`,
    same: "This plan costs about the same as a typical recommended store.",
    swapsOnly: (amount: string) => `Your applied item changes reduce this basket by ${amount}.`,
    swapsCostMore: (amount: string) => `Your applied item changes add ${amount} to this basket.`,
    storeChoice: "Store choice",
    itemChanges: "Item changes",
  },
  ms: {
    title: "Anggaran penjimatan",
    differenceTitle: "Anggaran perbezaan kos",
    unavailable: "Anggaran penjimatan setara belum tersedia.",
    less: (amount: string) => `Anda mungkin berbelanja ${amount} kurang berbanding kedai cadangan biasa.`,
    above: (amount: string) => `Pelan ini ${amount} melebihi kos biasa kedai cadangan.`,
    same: "Kos pelan ini hampir sama dengan kedai cadangan biasa.",
    swapsOnly: (amount: string) => `Perubahan item anda mengurangkan bakul ini sebanyak ${amount}.`,
    swapsCostMore: (amount: string) => `Perubahan item anda menambah ${amount} kepada bakul ini.`,
    storeChoice: "Pilihan kedai",
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
  const title = net != null && net < 0 ? text.differenceTitle : text.title;
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
      className="rounded-[22px] border border-[#bddfce] bg-[linear-gradient(135deg,#f3fbf7,#eaf7f1)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="estimated-savings-title" className="mt-1 text-xl font-extrabold text-[#10231d]">{title}</h2>
        </div>
        {net != null && net > 0 ? (
          <p className="text-2xl font-extrabold text-[#087f5b]">{formatRm(net)}</p>
        ) : null}
      </div>

      <p className="mt-2 text-sm font-semibold leading-5 text-[#27483d]">{headline}</p>

      {(snapshot.storeChoiceImpactRm != null || itemImpact != null) ? (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {snapshot.storeChoiceImpactRm != null ? (
            <div className="rounded-xl border border-[#d5e9df] bg-white px-3 py-2">
              <dt className="text-[11px] text-[#617069]">{text.storeChoice}</dt>
              <dd className={`mt-0.5 text-sm font-extrabold ${snapshot.storeChoiceImpactRm >= 0 ? "text-[#087f5b]" : "text-[#9b3d00]"}`}>
                {signedAmount(snapshot.storeChoiceImpactRm)}
              </dd>
            </div>
          ) : null}
          {itemImpact != null ? (
            <div className="rounded-xl border border-[#d5e9df] bg-white px-3 py-2">
              <dt className="text-[11px] text-[#617069]">{text.itemChanges}</dt>
              <dd className={`mt-0.5 text-sm font-extrabold ${itemImpact >= 0 ? "text-[#087f5b]" : "text-[#9b3d00]"}`}>
                {signedAmount(itemImpact)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

    </section>
  );
}
