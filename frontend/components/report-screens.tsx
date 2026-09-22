"use client";

import { UIIcon } from "./ui-icon";

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
    report: "Reports", inbox: "Inbox", statistics: "Statistics", weekly: "Weekly", monthly: "Monthly",
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

function localDate(value: string, locale: Locale, utc = false) {
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric", ...(utc ? {timeZone: "UTC"} : {}) }).format(new Date(value));
}

function periodLabel(message: SavingsReportMessage, locale: Locale) {
  return `${localDate(message.periodStart, locale, true)} – ${localDate(new Date(Date.parse(message.periodEnd) - 1).toISOString(), locale, true)}`;
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
    <div className="screen-enter history-screen">
      <h1 className="text-3xl font-extrabold text-[#10152e]">{copy.history}</h1><p className="page-description">{locale === "en" ? "Your recorded shopping trips and receipts." : "Perjalanan membeli-belah dan resit anda."}</p>
      {records.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#becdc6] bg-white p-7 text-center"><p className="font-bold">{copy.emptyHistory}</p><p className="mt-1 text-sm text-[#526078]">{copy.emptyHistoryHint}</p></div> : (
        <ol className="mt-5 space-y-3">{records.map((record, index) => {
          const bought = record.lines.filter(line => line.status === "bought");
          const incomplete = bought.some(line => boughtLineTotalRm(line) == null);
          const hasCatalogue = bought.some(line => line.actualPriceRm == null && line.unitPriceRm != null && line.priceSource === "store");
          const hasEstimate = bought.some(line => line.actualPriceRm == null && line.unitPriceRm != null && line.priceSource === "median");
          const travel = tripTravelSavingsInsight(record);
          const receipt = receiptTotals(record);
          return (
            <li key={record.id} className="receipt-card">
              <details open={index === 0 ? true : undefined}>
                <summary className="receipt-heading cursor-pointer list-none p-4 marker:hidden sm:p-5">
                  <span className="receipt-heading-content"><span className="receipt-store-icon" aria-hidden="true"><UIIcon name="bag" size={32}/></span><span><span className="block text-lg font-extrabold text-[#10152e]">{record.store.name}</span><span className="mt-1 block text-xs text-[#526078]">{localDate(record.recordedAt, locale)} · {bought.length} {copy.bought.toLowerCase()}</span></span><span className="text-right"><span className="block text-xs text-[#526078]">{copy.tripTotal}</span><span className="block text-xl font-extrabold text-[#007d38]">{receipt.total == null ? "—" : formatRm(receipt.total)}</span></span></span>
                </summary>
                <div className="receipt-body">
                  {bought.length === 0 ? <p className="py-3 text-sm text-[#526078]">{copy.noBought}</p> : (
                    <ul className="receipt-lines">{bought.map(line => {
                      const quantity = boughtLineQuantity(line);
                      const unitPrice = boughtLineUnitPrice(line);
                      const lineTotal = boughtLineTotalRm(line);
                      const name = (locale === "ms" ? line.itemNameMs : line.itemNameEn) || line.itemName;
                      return <li key={line.id} className="flex justify-between gap-3 py-2 text-sm"><div className="min-w-0"><p className="font-bold text-[#10152e]">{name}</p><p className="text-xs text-[#526078]">{quantity} × {unitPrice == null ? "—" : formatRm(unitPrice)}</p></div><span className="shrink-0 font-bold tabular-nums text-[#10152e]">{lineTotal == null ? "—" : formatRm(lineTotal)}</span></li>;
                    })}</ul>
                  )}
                  <div className="receipt-totals"><h2>{locale === "en" ? "Trip summary" : "Ringkasan perjalanan"}</h2><p className="flex justify-between gap-3"><span>{copy.itemsTotal}</span><span>{receipt.items == null ? "—" : formatRm(receipt.items)}</span></p><p className="flex justify-between gap-3"><span>{copy.travelCost}</span><span>{receipt.travel == null ? "—" : formatRm(receipt.travel)}</span></p></div>
                  <div className="receipt-grand-total"><span>{copy.tripTotal}</span><span>{receipt.total == null ? "—" : formatRm(receipt.total)}</span></div>
                  {(incomplete || hasEstimate || hasCatalogue) && <p className="mt-2 text-xs text-[#526078]">{[incomplete && copy.incomplete, hasEstimate && copy.estimate, hasCatalogue && copy.catalogue].filter(Boolean).join(" · ")}</p>}
                  <details className="receipt-planning"><summary className="cursor-pointer font-bold text-[#007d38]">{copy.planDetails}</summary><div className="mt-2 space-y-1"><p>{copy.planned}: {record.plannedCombinedTotalRm == null ? "—" : formatRm(record.plannedCombinedTotalRm)}</p>{record.estimatedSavings?.netSavingRm != null && <p>{copy.savings}: {signedRm(record.estimatedSavings.netSavingRm)}</p>}{travel.available && travel.savingsRm != null && <p>{copy.travel}: {formatRm(travel.savingsRm)}</p>}{record.routeProvider === "straight_line" && <p>{copy.routeEstimate}</p>}</div></details>
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
  const missingPriceCount = current ? history.filter(record => record.recordedAt >= current.periodStart && record.recordedAt < current.periodEnd).reduce((count, record) => count + record.lines.filter(line => line.status === "bought" && boughtLineTotalRm(line) == null).length, 0) : 0;
  const metrics = current ? [
    {label: copy.periodTotal, value: current.confirmedSpendingRm == null ? "—" : formatRm(current.confirmedSpendingRm), previous: previous?.confirmedSpendingRm == null ? "—" : formatRm(previous.confirmedSpendingRm), tone: "green", icon: "basket"},
    {label: locale === "en" ? "Trips" : "Perjalanan", value: String(current.tripCount), previous: previous ? String(previous.tripCount) : "—", tone: "blue", icon: "bag"},
    {label: copy.savings, value: signedRm(current.estimatedNetSavingsRm), previous: signedRm(previous?.estimatedNetSavingsRm ?? null), tone: "purple", icon: "savings"},
    {label: locale === "en" ? "Items without prices" : "Item tanpa harga", value: String(missingPriceCount), previous: null, tone: "amber", icon: "warning"},
  ] : [];
  return (
    <div className="screen-enter reports-screen">
      <header className="reports-heading"><div><h1>{copy.report}</h1><p className="page-description">{locale === "en" ? (tab === "inbox" ? "Your weekly and monthly shopping summaries." : "Your shopping insights, based on your locally stored trips.") : "Ringkasan dan statistik membeli-belah anda."}</p></div><p className="privacy-notice">{copy.privacy}</p></header>
      <div role="tablist" aria-label={copy.report} className="report-tabs">
        {(["inbox", "statistics"] as const).map(option => <button key={option} id={`report-tab-${option}`} type="button" role="tab" aria-selected={tab === option} aria-controls={`report-panel-${option}`} tabIndex={tab === option ? 0 : -1} onClick={() => setTab(option)} onKeyDown={event => onTabKeyDown(event, option)}><span aria-hidden="true"><UIIcon name={option === "inbox" ? "document" : "reports"}/></span>{copy[option]}{option === "inbox" && state.messages.some(message => !message.read) ? <span className="report-unread-count">{state.messages.filter(message => !message.read).length}</span> : null}</button>)}
      </div>
      {tab === "inbox" ? <section id="report-panel-inbox" role="tabpanel" aria-labelledby="report-tab-inbox" className="report-inbox">
        {state.messages.length === 0 ? <div className="report-empty"><p>{copy.emptyReports}</p><p>{copy.emptyReportsHint}</p></div> : <ol>{state.messages.map(message => <li key={message.id} className={"report-card " + (openReportId === message.id ? "is-open" : "")}>
          <button type="button" aria-expanded={openReportId === message.id} onClick={() => {setOpenReportId(id => id === message.id ? null : message.id); onRead(message.id);}} className="report-card-heading">
            <span className="report-document-icon" aria-hidden="true"><UIIcon name="document" size={38}/></span><span className="report-card-name"><strong>{message.cadence === "weekly" ? copy.weekly : copy.monthly} {copy.report}{!message.read && <span className="report-new">● {copy.unread}</span>}</strong><span>{periodLabel(message, locale)} · {copy.trips(message.tripCount)}</span></span>
            <span className="report-card-total"><strong>{message.actualSpendingRm == null ? "—" : formatRm(message.actualSpendingRm)}</strong><span>{copy.periodTotal}</span></span><span aria-hidden="true">{openReportId === message.id ? "⌃" : "⌄"}</span>
          </button>
          {openReportId === message.id && <div className="report-card-body"><div className="report-impact"><div><strong>{message.actualSpendingRm == null ? "—" : formatRm(message.actualSpendingRm)}</strong><span>{copy.periodTotal}</span></div><div><strong>{signedRm(message.estimatedNetSavingsRm)}</strong><span>{copy.savings}</span></div><div><strong>{signedRm(message.storeChoiceImpactRm)}</strong><span>{copy.storeChoice}</span></div></div>
            {message.spendingIncomplete && <p className="report-warning">{copy.incomplete}</p>}{message.savingsIncomplete && <p className="report-warning">{copy.savingsIncomplete}</p>}
            <details className="report-details"><summary>{copy.reportDetails}</summary><p>{copy.itemChanges}: {signedRm(message.itemChangeImpactRm)}</p><p>{copy.estimateNote}</p></details>
          </div>}
        </li>)}</ol>}
      </section> : <section id="report-panel-statistics" role="tabpanel" aria-labelledby="report-tab-statistics" className="statistics-panel">
        <div className="statistics-controls"><div role="group" aria-label={copy.statistics} className="cadence-toggle">{(["weekly", "monthly"] as const).map(cadence => <button key={cadence} type="button" aria-pressed={state.cadence === cadence} onClick={() => onCadence(cadence)}>{copy[cadence]}</button>)}</div><button type="button" className="secondary-button" aria-pressed={state.summaryHidden} onClick={onToggleSummary}>{state.summaryHidden ? copy.show : copy.hide}</button></div>
        {state.summaryHidden ? <p className="report-empty">{copy.hidden}</p> : current && <>
          <div className="statistics-period"><strong>{copy.current}</strong><span>{localDate(current.periodStart, locale, true)} – {localDate(new Date(Date.parse(current.periodEnd)-1).toISOString(), locale, true)}</span></div>
          <div className="statistics-metrics">{metrics.map(metric => <article key={metric.tone} className={"stat-metric tone-" + metric.tone}><span className="metric-icon" aria-hidden="true"><UIIcon name={metric.icon} size={34}/></span><h2>{metric.label}</h2><strong>{metric.value}</strong>{metric.previous !== null && previous && <p>{copy.previous}: {metric.previous}</p>}</article>)}</div>
          {!current.hasRecords && <p className="report-notice">{copy.noData}</p>}{current.hasRecords && current.confirmedSpendingRm == null && <p className="report-notice">{copy.noPriced}</p>}{current.spendingIncomplete && current.confirmedSpendingRm != null && <p className="report-warning">{copy.incomplete}</p>}{current.savingsIncomplete && <p className="report-warning">{copy.savingsIncomplete}</p>}
          {comparison?.inProgress && <p className="report-notice">{copy.inProgress}</p>}
          <section className="statistics-comparison"><h2>{copy.current} / {copy.previous}</h2>{previous ? <table><thead><tr><th>{locale === "en" ? "Metric" : "Metrik"}</th><th>{copy.current}</th><th>{copy.previous}</th></tr></thead><tbody>{metrics.filter(metric => metric.previous !== null).map(metric => <tr key={metric.tone}><th scope="row">{metric.label}</th><td>{metric.value}</td><td>{metric.previous}</td></tr>)}</tbody></table> : <p>{copy.noPrevious}</p>}</section>
          <details className="statistics-about"><summary>{locale === "en" ? "About these statistics" : "Tentang statistik ini"}</summary><p>{copy.privacy} {copy.estimateNote}</p></details>
        </>}
      </section>}
    </div>
  );
}
