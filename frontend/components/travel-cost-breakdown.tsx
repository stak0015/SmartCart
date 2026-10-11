"use client";

import { useId, useState, type ReactNode } from "react";
import type { TravelCostBreakdown } from "@/lib/contracts";
import type { Locale } from "@/lib/i18n";
import { formatRm } from "@/lib/format-rm";

function CostInfo({ label, explanation }: { label: string; explanation: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <span className="travel-cost-info" data-open={open}>
    <button type="button" aria-label={label} aria-describedby={id} aria-expanded={open}
      onClick={() => setOpen(value => !value)} onBlur={() => setOpen(false)}
      onKeyDown={event => { if (event.key === "Escape") { setOpen(false); event.currentTarget.blur(); } }}>i</button>
    <span id={id} role="tooltip" className="travel-cost-tooltip">{explanation}</span>
  </span>;
}

export function TravelCostDetails({ breakdowns, locale, roundTrip }: {
  breakdowns: (TravelCostBreakdown | null | undefined)[];
  locale: Locale;
  roundTrip: boolean;
}) {
  const fuel = breakdowns[0];
  // Old saved recommendations and non-petrol modes have no fuel breakdown.
  if (!fuel || breakdowns.some(value => !value)) return null;
  const fuelCost = breakdowns.reduce((sum, value) => sum + value!.fuelCostRm, 0);
  const litres = breakdowns.reduce((sum, value) => sum + value!.fuelLitres, 0);
  const english = locale === "en";
  const basis = fuel.fuelPriceBasis === "ron95_budi95" ? "RON95 BUDI95" : english ? "RON95 (general market)" : "RON95 (pasaran umum)";
  const source = fuel.fuelPriceSource === "fallback"
    ? (english ? "configured fallback; official price unavailable" : "harga sandaran; harga rasmi tidak tersedia")
    : `${fuel.fuelPriceSource === "cached" ? (english ? "last known price" : "harga terakhir") : "data.gov.my"}${fuel.fuelPriceEffectiveDate ? ` · ${fuel.fuelPriceEffectiveDate}` : ""}`;
  const returnNote = roundTrip ? (english ? "Return journey assumes the same distance as the outward journey." : "Perjalanan balik dianggarkan menggunakan jarak yang sama seperti perjalanan pergi.") : "";
  const fuelExplanation = <>
    <strong className="travel-cost-tooltip-title">{english ? "Fuel estimate" : "Anggaran bahan api"}</strong>
    <span className="travel-cost-tooltip-line"><b>{english ? "Fuel type" : "Jenis bahan api"}</b><span>{basis}</span></span>
    <span className="travel-cost-tooltip-line"><b>{english ? "Consumption" : "Penggunaan"}</b><span>{fuel.litresPer100Km} L/100 km</span></span>
    <span className="travel-cost-tooltip-line"><b>{english ? "Fuel price" : "Harga bahan api"}</b><span>RM{fuel.fuelPricePerLitreRm.toFixed(2)}/L</span></span>
    <span className="travel-cost-tooltip-line"><b>{english ? "Price source" : "Sumber harga"}</b><span>{source}</span></span>
    <span className="travel-cost-tooltip-calculation"><b>{english ? "Calculation" : "Pengiraan"}</b><span>{litres.toFixed(3)} L × RM{fuel.fuelPricePerLitreRm.toFixed(2)}/L = {formatRm(fuelCost)}</span></span>
    {returnNote && <span className="travel-cost-tooltip-note">{returnNote}</span>}
  </>;
  const tollExplanation = <>
    <strong className="travel-cost-tooltip-title">{english ? "Toll costs" : "Kos tol"}</strong>
    <span className="travel-cost-tooltip-line"><b>{english ? "Availability" : "Ketersediaan"}</b><span>{english ? "Toll prices are unavailable for Malaysia from the routing provider." : "Harga tol untuk Malaysia tidak tersedia daripada penyedia laluan."}</span></span>
    <span className="travel-cost-tooltip-note">{english ? "Tolls and parking are excluded from the total." : "Tol dan parkir tidak termasuk dalam jumlah."}</span>
  </>;
  return <section aria-label={english ? "Travel cost breakdown" : "Pecahan kos perjalanan"} className="travel-cost-breakdown">
    <div className="travel-cost-row"><span>{english ? "Expected fuel cost" : "Anggaran kos bahan api"} <CostInfo label={english ? "How fuel cost is estimated" : "Cara kos bahan api dianggarkan"} explanation={fuelExplanation}/></span><strong>{formatRm(fuelCost)}</strong></div>
    <div className="travel-cost-row"><span>{english ? "Tolls" : "Tol"} <CostInfo label={english ? "About toll costs" : "Tentang kos tol"} explanation={tollExplanation}/></span><strong>{english ? "Unavailable" : "Tidak tersedia"}</strong></div>
  </section>;
}
