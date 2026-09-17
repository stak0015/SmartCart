"use client";

import { useState, type KeyboardEvent } from "react";
import { formatRm } from "@/lib/format-rm";
import type { InboxState, ReportCadence, SavingsReportMessage } from "@/lib/inbox";
import type { Locale } from "@/lib/i18n";
import { periodComparison } from "@/lib/period-summary";
import { tripTravelSavingsInsight } from "@/lib/savings-insights";
import { boughtLineQuantity, boughtLineTotalRm, boughtLineUnitPrice, listTripRecords, type TripRecord } from "@/lib/trip-history";

const COPY = {
  en: {
    history: "Shopping history", emptyHistory: "No trips recorded yet", emptyHistoryHint: "Record a trip from your checklist to see it here.",
    bought: "Bought", total: "Total", incomplete: "Some bought items have no price. This total is partial.",
    catalogue: "Includes catalogue prices", estimate: "Includes estimated prices", noBought: "No bought items on this trip.",
    itemsTotal: "Items", travelCost: "Return travel (estimated)", tripTotal: "Trip total",
    planDetails: "Planning details", planned: "Planned basket + transport", savings: "Estimated net savings",
    travel: "Travel-cost saving vs cheapest alternative", routeEstimate: "Travel used an approximate straight-line route.",
    report: "Report", inbox: "Inbox", statistics: "Statistics", weekly: "Weekly", monthly: "Monthly",
    emptyReports: "No reports yet", emptyReportsHint: "Reports appear after a completed week or month with a recorded trip.",
    unread: "Unread", read: "Read", trips: (count: number) => `${count} ${count === 1 ? "trip" : "trips"}`,
    periodTotal: "Bought total", reportDetails: "Report details", storeChoice: "Store choice", itemChanges: "Item changes",
    savingsIncomplete: "Some trips have no comparable savings estimate.", estimateNote: "Totals may include catalogue prices. Savings remain estimates.",
    current: "Current period", previous: "Previous period", change: "Change", noData: "No trips in this period.",
    noPriced: "No priced bought items in this period.", noPrevious: "No previous period to compare.",
    hide: "Hide statistics", show: "Show statistics", hidden: "Statistics are hidden on this device.",
    privacy: "Calculated on this device. Your shopping history is not uploaded.",
    inProgress: "The current period is still in progress.",
  },
  ms: {
    history: "Sejarah membeli-belah", emptyHistory: "Belum ada perjalanan direkodkan", emptyHistoryHint: "Rekodkan perjalanan daripada senarai semak untuk melihatnya di sini.",
    bought: "Dibeli", total: "Jumlah", incomplete: "Sesetengah item dibeli tiada harga. Jumlah ini separa.",
    catalogue: "Termasuk harga katalog", estimate: "Termasuk harga anggaran", noBought: "Tiada item dibeli dalam perjalanan ini.",
    itemsTotal: "Item", travelCost: "Perjalanan pergi balik (anggaran)", tripTotal: "Jumlah perjalanan",
    planDetails: "Butiran perancangan", planned: "Bakul + pengangkutan yang dirancang", savings: "Anggaran penjimatan bersih",
    travel: "Penjimatan perjalanan vs alternatif termurah", routeEstimate: "Perjalanan menggunakan anggaran jarak garis lurus.",
    report: "Laporan", inbox: "Peti masuk", statistics: "Statistik", weekly: "Mingguan", monthly: "Bulanan",
    emptyReports: "Belum ada laporan", emptyReportsHint: "Laporan muncul selepas minggu atau bulan lengkap dengan perjalanan direkodkan.",
    unread: "Belum dibaca", read: "Dibaca", trips: (count: number) => `${count} perjalanan`,
    periodTotal: "Jumlah dibeli", reportDetails: "Butiran laporan", storeChoice: "Pilihan kedai", itemChanges: "Perubahan item",
    savingsIncomplete: "Sesetengah perjalanan tiada anggaran penjimatan setara.", estimateNote: "Jumlah mungkin termasuk harga katalog. Penjimatan kekal anggaran.",
    current: "Tempoh semasa", previous: "Tempoh sebelumnya", change: "Perubahan", noData: "Tiada perjalanan dalam tempoh ini.",
    noPriced: "Tiada item dibeli yang berharga dalam tempoh ini.", noPrevious: "Tiada tempoh sebelumnya untuk dibandingkan.",
    hide: "Sembunyikan statistik", show: "Paparkan statistik", hidden: "Statistik disembunyikan pada peranti ini.",
    privacy: "Dikira pada peranti ini. Sejarah membeli-belah anda tidak dimuat naik.",
    inProgress: "Tempoh semasa masih berlangsung.",
  },
} as const;

function localDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function periodLabel(message: SavingsReportMessage, locale: Locale) {
  return `${localDate(message.periodStart, locale)} – ${localDate(new Date(Date.parse(message.periodEnd) - 1).toISOString(), locale)}`;
}

function signedRm(value: number | null) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatRm(Math.abs(value))}`;
}

function receiptTotals(record: TripRecord) {
  const items = record.actualTotalRm;
  const travel = record.estimatedRoundTripCostRm;
  const total = items == null
    ? null
    : Math.round((items + (travel ?? 0) + Number.EPSILON) * 100) / 100;
  return { items, travel, total };
}

export function ReceiptHistoryScreen({ history, locale }: { history: TripRecord[]; locale: Locale }) {
  const copy = COPY[locale];
  const records = listTripRecords(history);
  return (
    <div className="screen-enter px-4 pb-12 pt-8 sm:px-6">
      <h1 className="text-3xl font-extrabold text-[#10231d]">{copy.history}</h1>
      {records.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#becdc6] bg-white p-7 text-center"><p className="font-bold">{copy.emptyHistory}</p><p className="mt-1 text-sm text-[#617069]">{copy.emptyHistoryHint}</p></div> : (
        <ol className="mt-5 space-y-3">{records.map((record, index) => {
          const bought = record.lines.filter(line => line.status === "bought");
          const incomplete = bought.some(line => boughtLineTotalRm(line) == null);
          const hasCatalogue = bought.some(line => line.actualPriceRm == null && line.unitPriceRm != null && line.priceSource === "store");
          const hasEstimate = bought.some(line => line.actualPriceRm == null && line.unitPriceRm != null && line.priceSource === "median");
          const travel = tripTravelSavingsInsight(record);
          const receipt = receiptTotals(record);
          return (
            <li key={record.id} className="overflow-hidden rounded-2xl border border-[#dce5e0] bg-white shadow-[0_4px_18px_rgba(16,35,29,0.05)]">
              <details open={index === 0 ? true : undefined}>
                <summary className="cursor-pointer list-none p-4 marker:hidden sm:p-5">
                  <span className="flex items-start justify-between gap-3"><span><span className="block text-lg font-extrabold text-[#10231d]">{record.store.name}</span><span className="mt-1 block text-xs text-[#617069]">{localDate(record.recordedAt, locale)} · {bought.length} {copy.bought.toLowerCase()}</span></span><span className="text-right"><span className="block text-xs text-[#617069]">{copy.tripTotal}</span><span className="block text-xl font-extrabold text-[#087f5b]">{receipt.total == null ? "—" : formatRm(receipt.total)}</span></span></span>
                </summary>
                <div className="border-t border-dashed border-[#cbd8d1] px-4 pb-5 pt-3 sm:px-5">
                  {bought.length === 0 ? <p className="py-3 text-sm text-[#617069]">{copy.noBought}</p> : (
                    <ul className="divide-y divide-dashed divide-[#e2e9e5]">{bought.map(line => {
                      const quantity = boughtLineQuantity(line);
                      const unitPrice = boughtLineUnitPrice(line);
                      const lineTotal = boughtLineTotalRm(line);
                      const name = (locale === "ms" ? line.itemNameMs : line.itemNameEn) || line.itemName;
                      return <li key={line.id} className="flex justify-between gap-3 py-2 text-sm"><div className="min-w-0"><p className="font-bold text-[#17362c]">{name}</p><p className="text-xs text-[#617069]">{quantity} × {unitPrice == null ? "—" : formatRm(unitPrice)}</p></div><span className="shrink-0 font-bold tabular-nums text-[#17362c]">{lineTotal == null ? "—" : formatRm(lineTotal)}</span></li>;
                    })}</ul>
                  )}
                  <div className="mt-4 space-y-2 border-t border-[#dce5e0] pt-3 text-sm"><p className="flex justify-between gap-3"><span>{copy.itemsTotal}</span><span>{receipt.items == null ? "—" : formatRm(receipt.items)}</span></p><p className="flex justify-between gap-3"><span>{copy.travelCost}</span><span>{receipt.travel == null ? "—" : formatRm(receipt.travel)}</span></p></div>
                  <div className="mt-3 flex justify-between gap-3 border-t-2 border-[#17362c] pt-3 text-lg font-extrabold"><span>{copy.tripTotal}</span><span>{receipt.total == null ? "—" : formatRm(receipt.total)}</span></div>
                  {(incomplete || hasEstimate || hasCatalogue) && <p className="mt-2 text-xs text-[#617069]">{[incomplete && copy.incomplete, hasEstimate && copy.estimate, hasCatalogue && copy.catalogue].filter(Boolean).join(" · ")}</p>}
                  <details className="mt-4 text-xs text-[#617069]"><summary className="cursor-pointer font-bold text-[#087f5b]">{copy.planDetails}</summary><div className="mt-2 space-y-1"><p>{copy.planned}: {record.plannedCombinedTotalRm == null ? "—" : formatRm(record.plannedCombinedTotalRm)}</p>{record.estimatedSavings?.netSavingRm != null && <p>{copy.savings}: {signedRm(record.estimatedSavings.netSavingRm)}</p>}{travel.available && travel.savingsRm != null && <p>{copy.travel}: {formatRm(travel.savingsRm)}</p>}{record.routeProvider === "straight_line" && <p>{copy.routeEstimate}</p>}</div></details>
                </div>
              </details>
            </li>
          );
        })}</ol>
      )}
    </div>
  );
}

export function ReportScreen({ state, locale, history, onCadence, onRead, onToggleSummary }: {
  state: InboxState;
  locale: Locale;
  history: TripRecord[];
  onCadence: (cadence: ReportCadence) => void;
  onRead: (id: string) => void;
  onToggleSummary: () => void;
}) {
  const copy = COPY[locale];
  const [tab, setTab] = useState<"inbox" | "statistics">("inbox");
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const comparison = tab === "statistics" && !state.summaryHidden ? periodComparison(history, state.cadence) : null;
  const current = comparison?.current;
  const previous = comparison?.previous;
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: "inbox" | "statistics") => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = currentTab === "inbox" ? "statistics" : "inbox";
    setTab(next);
    document.getElementById(`report-tab-${next}`)?.focus();
  };
  return (
    <div className="screen-enter px-4 pb-12 pt-8 sm:px-6">
      <h1 className="text-3xl font-extrabold text-[#10231d]">{copy.report}</h1>
      <div role="tablist" aria-label={copy.report} className="mt-5 grid grid-cols-2 rounded-xl bg-[#e8efeb] p-1">
        {(["inbox", "statistics"] as const).map(option => <button key={option} id={`report-tab-${option}`} type="button" role="tab" aria-selected={tab === option} aria-controls={`report-panel-${option}`} tabIndex={tab === option ? 0 : -1} onClick={() => setTab(option)} onKeyDown={event => onTabKeyDown(event, option)} className={`min-h-11 rounded-lg text-sm font-bold ${tab === option ? "bg-white text-[#087f5b] shadow-sm" : "text-[#53635c]"}`}>{copy[option]}{option === "inbox" && state.messages.some(message => !message.read) ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#e8590c]" aria-hidden="true" /> : null}</button>)}
      </div>

      {tab === "inbox" ? <section id="report-panel-inbox" role="tabpanel" aria-labelledby="report-tab-inbox" className="mt-5">
        {state.messages.length === 0 ? <div className="rounded-2xl border border-dashed border-[#becdc6] bg-white p-7 text-center"><p className="font-bold">{copy.emptyReports}</p><p className="mt-1 text-sm text-[#617069]">{copy.emptyReportsHint}</p></div> : (
          <ol className="space-y-3">{state.messages.map(message => <li key={message.id} className="overflow-hidden rounded-2xl border border-[#dce5e0] bg-white">
            <button type="button" aria-expanded={openReportId === message.id} onClick={() => { setOpenReportId(currentId => currentId === message.id ? null : message.id); onRead(message.id); }} className="flex min-h-20 w-full items-center justify-between gap-3 p-4 text-left">
              <span><span className="flex items-center gap-2 text-sm font-extrabold text-[#17362c]">{message.cadence === "weekly" ? copy.weekly : copy.monthly}{!message.read && <span className="h-2 w-2 rounded-full bg-[#e8590c]" aria-label={copy.unread} />}</span><span className="mt-1 block text-xs text-[#617069]">{periodLabel(message, locale)} · {copy.trips(message.tripCount)}</span></span>
              <span className="shrink-0 text-right"><span className="block text-xs text-[#617069]">{copy.periodTotal}</span><span className="block text-lg font-extrabold text-[#087f5b]">{message.actualSpendingRm == null ? "—" : formatRm(message.actualSpendingRm)}</span></span>
            </button>
            {openReportId === message.id && <div className="space-y-2 border-t border-[#edf1ef] px-4 pb-4 pt-3 text-sm"><p className="flex justify-between gap-3"><span>{copy.savings}</span><strong>{signedRm(message.estimatedNetSavingsRm)}</strong></p><p className="flex justify-between gap-3 text-xs text-[#617069]"><span>{copy.storeChoice}</span><span>{signedRm(message.storeChoiceImpactRm)}</span></p><p className="flex justify-between gap-3 text-xs text-[#617069]"><span>{copy.itemChanges}</span><span>{signedRm(message.itemChangeImpactRm)}</span></p>{message.spendingIncomplete && <p className="text-xs text-[#9b5b00]">{copy.incomplete}</p>}{message.savingsIncomplete && <p className="text-xs text-[#617069]">{copy.savingsIncomplete}</p>}<p className="text-xs text-[#617069]">{copy.estimateNote}</p></div>}
          </li>)}</ol>
        )}
      </section> : <section id="report-panel-statistics" role="tabpanel" aria-labelledby="report-tab-statistics" className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <div role="group" aria-label={copy.statistics} className="inline-flex rounded-xl border border-[#cbd8d1] bg-white p-1">{(["weekly", "monthly"] as const).map(cadence => <button key={cadence} type="button" aria-pressed={state.cadence === cadence} onClick={() => onCadence(cadence)} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${state.cadence === cadence ? "bg-[#087f5b] text-white" : "text-[#087f5b]"}`}>{copy[cadence]}</button>)}</div>
          <button type="button" aria-pressed={state.summaryHidden} onClick={onToggleSummary} className="min-h-11 text-xs font-bold text-[#087f5b]">{state.summaryHidden ? copy.show : copy.hide}</button>
        </div>
        {state.summaryHidden ? <p className="mt-5 rounded-2xl border border-dashed border-[#becdc6] bg-white p-5 text-sm">{copy.hidden}</p> : current && <>
          <div className="mt-5 rounded-2xl border border-[#9ed2bb] bg-[#f0faf5] p-5"><p className="text-sm font-bold text-[#087f5b]">{state.cadence === "weekly" ? copy.weekly : copy.monthly} · {copy.current}</p><p className="mt-1 text-xs text-[#617069]">{copy.periodTotal}</p><p className="mt-1 text-3xl font-extrabold text-[#087f5b]">{current.confirmedSpendingRm == null ? "—" : formatRm(current.confirmedSpendingRm)}</p><p className="mt-1 text-xs text-[#617069]">{copy.trips(current.tripCount)}</p>{!current.hasRecords && <p className="mt-2 text-sm text-[#617069]">{copy.noData}</p>}{current.hasRecords && current.confirmedSpendingRm == null && <p className="mt-2 text-sm text-[#617069]">{copy.noPriced}</p>}{current.spendingIncomplete && current.confirmedSpendingRm != null && <p className="mt-2 text-xs text-[#9b5b00]">{copy.incomplete}</p>}</div>
          <div className="mt-4 rounded-2xl border border-[#dce5e0] bg-white p-5"><h2 className="text-lg font-extrabold text-[#10231d]">{copy.current} / {copy.previous}</h2>{previous ? <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div className="text-left text-[#617069]">{copy.periodTotal}</div><strong>{current.confirmedSpendingRm == null ? "—" : formatRm(current.confirmedSpendingRm)}</strong><span>{previous.confirmedSpendingRm == null ? "—" : formatRm(previous.confirmedSpendingRm)}</span><div className="text-left text-[#617069]">{copy.trips(0)}</div><strong>{current.tripCount}</strong><span>{previous.tripCount}</span><div className="text-left text-[#617069]">{copy.savings}</div><strong>{signedRm(current.estimatedNetSavingsRm)}</strong><span>{signedRm(previous.estimatedNetSavingsRm)}</span></div> : <p className="mt-2 text-sm text-[#617069]">{copy.noPrevious}</p>}{comparison?.inProgress && <p className="mt-3 text-xs text-[#617069]">{copy.inProgress}</p>}</div>
          <p className="mt-4 text-xs leading-5 text-[#617069]">{copy.privacy} {copy.estimateNote}</p>
        </>}
      </section>}
    </div>
  );
}
