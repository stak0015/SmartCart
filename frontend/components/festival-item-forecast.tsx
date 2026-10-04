"use client";

import { useEffect, useState } from "react";

import { getFestivalItemForecast } from "@/lib/festival-api";
import type { FestivalItemForecast as Forecast } from "@/lib/festival-contracts";
import { readFestivalContext } from "@/lib/festival-context";
import { formatRm } from "@/lib/format-rm";
import type { Item } from "@/lib/api";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    title: "Festival price alert",
    rise: "Expected rise",
    price: "Expected price",
    buyEarly: (festival: string) => `Buy early before ${festival}.`,
  },
  ms: {
    title: "Amaran harga perayaan",
    rise: "Anggaran kenaikan",
    price: "Anggaran harga",
    buyEarly: (festival: string) => `Beli awal sebelum ${festival}.`,
  },
} as const;

export function FestivalItemForecast({
  item,
  locale,
}: {
  item: Item;
  locale: Locale;
}) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const text = TEXT[locale];

  useEffect(() => {
    const context = readFestivalContext();
    if (!context.state) {
      setForecast(null);
      return;
    }
    const controller = new AbortController();
    getFestivalItemForecast(item.item_id, context.state, context.on, controller.signal)
      .then(result => setForecast(result.forecast))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setForecast(null);
      });
    return () => controller.abort();
  }, [item.item_id]);

  if (!forecast || !forecast.price_range) return null;
  const festivalName = locale === "ms" ? forecast.festival_name_ms : forecast.festival_name_en;
  return (
    <div className="rounded-xl border border-[#f0c36b] bg-[#fff8e8] p-3 text-[#6f4300]">
      <p className="text-xs font-extrabold uppercase tracking-wide">{text.title}</p>
      <p className="mt-1 text-sm font-extrabold">{festivalName}</p>
      <p className="mt-1 text-xs font-semibold">
        {text.rise}: +{forecast.rise_pct_min}% – +{forecast.rise_pct_max}%
      </p>
      <p className="text-xs font-semibold">
        {text.price}: {formatRm(Number(forecast.price_range.min))} – {formatRm(Number(forecast.price_range.max))}
      </p>
      <p className="mt-1 text-xs font-bold">{text.buyEarly(festivalName)}</p>
    </div>
  );
}
