"use client";

import { useEffect, useMemo, useState } from "react";

import type { StoreRecommendation } from "@/lib/contracts";
import { getEarlyPurchasePreview } from "@/lib/festival-api";
import { readFestivalContext } from "@/lib/festival-context";
import { buildStorePreviewLines } from "@/lib/festival-savings";
import { formatRm } from "@/lib/format-rm";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Estimated early-purchase saving",
    description: "Buying now versus the festival peak price.",
    separate: "Separate from comparison savings.",
  },
  ms: {
    title: "Anggaran penjimatan belian awal",
    description: "Beli sekarang berbanding harga puncak perayaan.",
    separate: "Berasingan daripada penjimatan perbandingan.",
  },
} as const;

export function FestivalEarlyPurchaseSaving({
  store,
  locale,
}: {
  store: StoreRecommendation;
  locale: Locale;
}) {
  const [amount, setAmount] = useState<number | null>(null);
  const lines = useMemo(
    () => buildStorePreviewLines(store.basketPrices),
    [store.basketPrices],
  );
  const text = TEXT[locale];

  useEffect(() => {
    const context = readFestivalContext();
    if (!context.state || lines.length === 0) {
      setAmount(null);
      return;
    }
    const controller = new AbortController();
    getEarlyPurchasePreview(context.state, lines, context.on, controller.signal)
      .then(result => setAmount(result.total_early_purchase_estimated_saving_rm))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAmount(null);
      });
    return () => controller.abort();
  }, [lines]);

  if (amount == null || amount <= 0) return null;
  return (
    <section className="rounded-2xl border border-[#b9e5cd] bg-[#effaf3] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-[#006b31]">{text.title}</h2>
        <strong className="text-xl font-extrabold text-[#007d38]">{formatRm(amount)}</strong>
      </div>
      <p className="mt-1 text-xs font-semibold text-[#27483d]">{text.description}</p>
      <p className="mt-1 text-xs text-[#526078]">{text.separate}</p>
    </section>
  );
}
