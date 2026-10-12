"use client";
// Owner: Shun

import { useMemo, useState } from "react";
import { DropdownChevron, UIIcon } from "./ui-icon";
import { ITEM_CATEGORY_LABELS } from "@/lib/contracts";
import { formatRm } from "@/lib/format-rm";
import type { Locale } from "@/lib/i18n";
import type { ReportCadence } from "@/lib/report-generation";
import { buildStatisticsView, type StatisticsTrendPoint } from "@/lib/statistics-view";
import type { TripRecord } from "@/lib/trip-history";

const COPY = {
  en: {
    weekly: "Weekly", monthly: "Monthly", cadenceGroup: "Statistics period length",
    thisPeriod: { weekly: "This week", monthly: "This month" },
    lastPeriod: { weekly: "Last week", monthly: "Last month" },
    earlierPeriod: { weekly: "Earlier week", monthly: "Earlier month" },
    olderPeriod: { weekly: "Previous week", monthly: "Previous month" },
    newerPeriod: { weekly: "Next week", monthly: "Next month" },
    vsPrevious: { weekly: "vs previous week", monthly: "vs previous month" },
    spent: "Spent", trips: "Trips", average: "Average per trip", savings: "Estimated savings",
    noComparison: "No earlier trips to compare",
    noChange: "No change",
    partial: "Partial: some bought items have no price",
    savingsAbove: "Above the typical recommended store",
    savingsBelow: "Below the typical recommended store",
    savingsSame: "Same as the typical recommended store",
    savingsUnavailable: "No saved store comparison",
    trendTitle: "Spending trend",
    trendHint: (count: number, cadence: ReportCadence) => `Confirmed spending, last ${count} ${cadence === "weekly" ? "weeks" : "months"}`,
    noTrips: "No trips",
    tripsCount: (count: number) => `${count} ${count === 1 ? "trip" : "trips"}`,
    categoriesTitle: "Spending by category",
    categoriesHint: "Share of confirmed spending",
    categoriesEmpty: "No priced items in this period.",
    newCategory: "New",
    topItemsTitle: "Top items",
    topItemsHint: "Largest confirmed spending this period",
    item: "Item", qty: "Qty", amount: "Amount", share: "Share",
    savingsTitle: "Savings breakdown",
    savingsHint: "Estimates from your saved store comparisons",
    storeChoice: "Store choice", itemChanges: "Item swaps", net: "Estimated total",
    emptyTitle: "No trips recorded in this period",
    emptyHint: "Record a trip from your checklist, or use the arrows to look at earlier periods.",
    about: "About these statistics",
    aboutBody: "Spending counts bought items with a recorded price. Travel costs are not included. Savings are estimates from the comparisons saved when you confirmed each store, compared with the median of the recommended stores.",
    tablePeriod: "Period", category: "Category", change: "Change",
  },
  ms: {
    weekly: "Mingguan", monthly: "Bulanan", cadenceGroup: "Tempoh statistik",
    thisPeriod: { weekly: "Minggu ini", monthly: "Bulan ini" },
    lastPeriod: { weekly: "Minggu lepas", monthly: "Bulan lepas" },
    earlierPeriod: { weekly: "Minggu terdahulu", monthly: "Bulan terdahulu" },
    olderPeriod: { weekly: "Minggu sebelumnya", monthly: "Bulan sebelumnya" },
    newerPeriod: { weekly: "Minggu seterusnya", monthly: "Bulan seterusnya" },
    vsPrevious: { weekly: "berbanding minggu sebelumnya", monthly: "berbanding bulan sebelumnya" },
    spent: "Dibelanjakan", trips: "Perjalanan", average: "Purata setiap perjalanan", savings: "Anggaran penjimatan",
    noComparison: "Tiada perjalanan terdahulu untuk dibandingkan",
    noChange: "Tiada perubahan",
    partial: "Separa: sesetengah item dibeli tiada harga",
    savingsAbove: "Lebih tinggi daripada kedai biasa yang disyorkan",
    savingsBelow: "Lebih rendah daripada kedai biasa yang disyorkan",
    savingsSame: "Sama dengan kedai biasa yang disyorkan",
    savingsUnavailable: "Tiada perbandingan kedai tersimpan",
    trendTitle: "Trend perbelanjaan",
    trendHint: (count: number, cadence: ReportCadence) => `Perbelanjaan disahkan, ${count} ${cadence === "weekly" ? "minggu" : "bulan"} terakhir`,
    noTrips: "Tiada perjalanan",
    tripsCount: (count: number) => `${count} perjalanan`,
    categoriesTitle: "Perbelanjaan mengikut kategori",
    categoriesHint: "Bahagian perbelanjaan disahkan",
    categoriesEmpty: "Tiada item berharga dalam tempoh ini.",
    newCategory: "Baharu",
    topItemsTitle: "Item utama",
    topItemsHint: "Perbelanjaan disahkan terbesar dalam tempoh ini",
    item: "Item", qty: "Kuantiti", amount: "Jumlah", share: "Bahagian",
    savingsTitle: "Pecahan penjimatan",
    savingsHint: "Anggaran daripada perbandingan kedai tersimpan",
    storeChoice: "Pilihan kedai", itemChanges: "Pertukaran item", net: "Anggaran keseluruhan",
    emptyTitle: "Tiada perjalanan direkodkan dalam tempoh ini",
    emptyHint: "Rekodkan perjalanan daripada senarai semak, atau gunakan anak panah untuk melihat tempoh terdahulu.",
    about: "Tentang statistik ini",
    aboutBody: "Perbelanjaan mengira item dibeli yang mempunyai harga direkodkan. Kos perjalanan tidak termasuk. Penjimatan ialah anggaran daripada perbandingan yang disimpan semasa anda mengesahkan setiap kedai, berbanding median kedai yang disyorkan.",
    tablePeriod: "Tempoh", category: "Kategori", change: "Perubahan",
  },
} as const;

type Tone = "good" | "bad" | "neutral";

function categoryName(categoryId: string, locale: Locale) {
  if (categoryId === "uncategorised") return locale === "en" ? "Other items" : "Item lain";
  return ITEM_CATEGORY_LABELS[categoryId as keyof typeof ITEM_CATEGORY_LABELS]?.[locale] ?? categoryId;
}

function percentText(value: number | null, locale: Locale) {
  return value == null ? "—" : `${new Intl.NumberFormat(locale === "ms" ? "ms-MY" : "en-MY", { maximumFractionDigits: 0 }).format(value)}%`;
}

function signedRm(value: number | null) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatRm(Math.abs(value))}`;
}

/** Round an axis maximum up to 1, 2, 2.5 or 5 × 10ⁿ so ticks are clean numbers. */
function niceMax(value: number) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(candidate => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

function Sparkline({ points }: { points: StatisticsTrendPoint[] }) {
  const values = points.map(point => point.amountRm ?? 0);
  const max = Math.max(...values, 0);
  if (max <= 0) return null;
  const step = 100 / Math.max(values.length - 1, 1);
  const coords = values.map((value, index) => `${(index * step).toFixed(1)},${(26 - value / max * 22).toFixed(1)}`);
  const last = coords[coords.length - 1].split(",");
  return <svg className="kpi-sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={coords.join(" ")} fill="none" vectorEffect="non-scaling-stroke"/>
    <circle cx={last[0]} cy={last[1]} r="2.5"/>
  </svg>;
}

function KpiTile({ label, value, delta, tone = "neutral", note, valueTone, children }: {
  label: string; value: string; delta: string | null; tone?: Tone; note: string; valueTone?: Tone; children?: React.ReactNode;
}) {
  return <article className="kpi-tile">
    <h3>{label}</h3>
    <p className={`kpi-value${valueTone && valueTone !== "neutral" ? ` is-${valueTone}` : ""}`}>{value}</p>
    <p className="kpi-meta">{delta && <span className={`kpi-delta is-${tone}`}>{delta}</span>}<span>{note}</span></p>
    {children}
  </article>;
}

function TrendChart({ points, title, locale }: { points: StatisticsTrendPoint[]; title: string; locale: Locale }) {
  const copy = COPY[locale];
  const [active, setActive] = useState<number | null>(null);
  // Headroom keeps the selected bar's value label inside the plot.
  const top = niceMax(Math.max(...points.map(point => point.amountRm ?? 0)) * 1.12);
  const ticks = [top, top / 2, 0];
  const shown = active ?? -1;
  const activePoint = active == null ? null : points[active];
  // Keep the tooltip inside the plot near either edge.
  const tooltipAlign = shown < 2 ? "start" : shown > points.length - 3 ? "end" : "center";
  return <figure className="trend-chart">
      <ol className="trend-axis" aria-hidden="true">{ticks.map(tick => <li key={tick}>{tick === 0 ? "0" : `RM${Math.round(tick)}`}</li>)}</ol>
      <div className="trend-area">
        <div className="trend-gridlines" aria-hidden="true">{ticks.map(tick => <span key={tick}/>)}</div>
        <ol className="trend-columns" onMouseLeave={() => setActive(null)}>
          {points.map((point, index) => <li key={point.periodStart}
            className={`${point.selected ? "is-selected" : ""}${shown === index ? " is-active" : ""}`}
            onMouseEnter={() => setActive(index)}>
            <span className="trend-bar" style={{ height: point.amountRm ? `${Math.max(point.amountRm / top * 100, 1.5)}%` : "0%" }}>
              {point.selected && point.amountRm != null && <span className="trend-cap">{formatRm(point.amountRm)}</span>}
            </span>
          </li>)}
        </ol>
        {activePoint && <div className={`trend-tooltip is-${tooltipAlign}`} role="status" style={{ left: `${(shown + 0.5) / points.length * 100}%` }}>
          <strong>{activePoint.amountRm == null ? copy.noTrips : formatRm(activePoint.amountRm)}</strong>
          <span>{activePoint.rangeLabel}</span>
          <span>{copy.tripsCount(activePoint.tripCount)}</span>
        </div>}
      </div>
    <ol className="trend-labels" aria-hidden="true">{points.map(point => <li key={point.periodStart} className={point.selected ? "is-selected" : undefined}>{point.label}</li>)}</ol>
    <table className="sr-only"><caption>{title}</caption><thead><tr><th scope="col">{copy.tablePeriod}</th><th scope="col">{copy.amount}</th><th scope="col">{copy.trips}</th></tr></thead>
      <tbody>{points.map(point => <tr key={point.periodStart}><th scope="row">{point.rangeLabel}</th><td>{point.amountRm == null ? "—" : formatRm(point.amountRm)}</td><td>{point.tripCount}</td></tr>)}</tbody></table>
  </figure>;
}

function CardHeader({ id, title, hint }: { id: string; title: string; hint: string }) {
  return <header className="dash-card-header"><h2 id={id}>{title}</h2><p>{hint}</p></header>;
}

/**
 * Statistics dashboard (US 8.1, 8.3): KPI tiles, trend, categories and top items with screen-
 * reader tables.
 */
export function StatisticsPanel({ history, cadence, locale, onCadence }: {
  history: readonly TripRecord[];
  cadence: ReportCadence;
  locale: Locale;
  onCadence: (cadence: ReportCadence) => void;
}) {
  const copy = COPY[locale];
  const [offset, setOffset] = useState(0);
  const view = useMemo(() => buildStatisticsView(history, cadence, new Date(), locale, offset), [history, cadence, locale, offset]);
  const { current } = view.analytics;
  const periodName = view.offset === 0 ? copy.thisPeriod[cadence] : view.offset === -1 ? copy.lastPeriod[cadence] : copy.earlierPeriod[cadence];
  const vsPrevious = copy.vsPrevious[cadence];
  const net = current.savings.netSaving.amountRm;
  const storeChoice = current.savings.storeChoiceImpact.amountRm;
  const itemChanges = current.savings.itemChangeImpact.amountRm;
  const maxCategory = Math.max(...view.categoryChanges.map(row => row.amountRm), 0);

  const spendDelta = view.spendingChangeRm == null ? null
    : view.spendingChangeRm === 0 ? copy.noChange
      : `${view.spendingChangeRm > 0 ? "▲" : "▼"} ${formatRm(Math.abs(view.spendingChangeRm))}${view.spendingChangePercent == null ? "" : ` (${percentText(Math.abs(view.spendingChangePercent), locale)})`}`;
  const spendTone: Tone = view.spendingChangeRm == null || view.spendingChangeRm === 0 ? "neutral" : view.spendingChangeRm > 0 ? "bad" : "good";
  const tripDelta = view.tripCountChange == null ? null : view.tripCountChange === 0 ? copy.noChange : `${view.tripCountChange > 0 ? "+" : "−"}${Math.abs(view.tripCountChange)}`;
  const averageChange = view.averagePerTripRm != null && view.previousAveragePerTripRm != null
    ? Math.round((view.averagePerTripRm - view.previousAveragePerTripRm) * 100) / 100 : null;
  const averageDelta = averageChange == null ? null : averageChange === 0 ? copy.noChange : signedRm(averageChange);
  const savingsNote = net == null ? copy.savingsUnavailable : net > 0 ? copy.savingsBelow : net < 0 ? copy.savingsAbove : copy.savingsSame;

  const changeCadence = (next: ReportCadence) => {
    setOffset(0);
    onCadence(next);
  };

  return <section id="report-panel-statistics" role="tabpanel" aria-labelledby="report-tab-statistics" className="statistics-panel">
    <div className="statistics-toolbar">
      <div className="period-nav">
        <button type="button" className="period-nav-button" aria-label={copy.olderPeriod[cadence]} disabled={!view.canGoOlder} onClick={() => setOffset(value => value - 1)}><UIIcon name="chevronLeft" size={16}/></button>
        <div className="period-nav-label" aria-live="polite"><strong>{periodName}</strong><span>{view.currentRangeLabel}</span></div>
        <button type="button" className="period-nav-button" aria-label={copy.newerPeriod[cadence]} disabled={!view.canGoNewer} onClick={() => setOffset(value => Math.min(0, value + 1))}><UIIcon name="chevronRight" size={16}/></button>
      </div>
      <div role="group" aria-label={copy.cadenceGroup} className="cadence-toggle">{(["weekly", "monthly"] as const).map(option => <button key={option} type="button" aria-pressed={cadence === option} onClick={() => changeCadence(option)}>{copy[option]}</button>)}</div>
    </div>

    <div className="kpi-grid">
      <KpiTile label={copy.spent} value={current.actualSpendingRm == null ? "—" : formatRm(current.actualSpendingRm)}
        delta={spendDelta} tone={spendTone} note={view.hasPartialSpending ? copy.partial : spendDelta ? vsPrevious : copy.noComparison}>
        <Sparkline points={view.trend}/>
      </KpiTile>
      <KpiTile label={copy.trips} value={String(current.tripCount)} delta={tripDelta} note={tripDelta ? vsPrevious : copy.noComparison}/>
      <KpiTile label={copy.average} value={view.averagePerTripRm == null ? "—" : formatRm(view.averagePerTripRm)}
        delta={averageDelta} note={averageDelta ? vsPrevious : copy.noComparison}/>
      <KpiTile label={copy.savings} value={signedRm(net)} valueTone={net == null || net === 0 ? "neutral" : net > 0 ? "good" : "bad"}
        delta={null} note={view.hasIncompleteSavings ? `${savingsNote} · ${copy.partial.split(":")[0]}` : savingsNote}/>
    </div>

    <div className="dash-grid">
      <section className="dash-card dash-trend" aria-labelledby="stats-trend-title">
        <CardHeader id="stats-trend-title" title={copy.trendTitle} hint={copy.trendHint(view.trend.length, cadence)}/>
        <TrendChart points={view.trend} title={copy.trendTitle} locale={locale}/>
      </section>

      <section className="dash-card" aria-labelledby="stats-categories-title">
        <CardHeader id="stats-categories-title" title={copy.categoriesTitle} hint={copy.categoriesHint}/>
        {view.categoryChanges.length === 0 ? <p className="dash-empty">{view.hasCurrentActivity ? copy.categoriesEmpty : copy.emptyTitle}</p> : <ol className="category-rank">
          {view.categoryChanges.map(row => <li key={row.categoryId}>
            <span className="category-rank-name">{categoryName(row.categoryId, locale)}</span>
            <span className="category-rank-amount">{formatRm(row.amountRm)}</span>
            <span className="category-rank-share">{percentText(row.percent, locale)}</span>
            <span className="category-rank-bar" aria-hidden="true"><span style={{ width: maxCategory > 0 ? `${Math.max(row.amountRm / maxCategory * 100, 2)}%` : "0%" }}/></span>
            {row.changeRm != null && <span className={`category-rank-change ${row.previousAmountRm === 0 ? "is-new" : row.changeRm > 0 ? "is-bad" : row.changeRm < 0 ? "is-good" : ""}`}>
              {row.previousAmountRm === 0 ? copy.newCategory : row.changeRm === 0 ? "—" : `${row.changeRm > 0 ? "▲" : "▼"} ${formatRm(Math.abs(row.changeRm))}`}
            </span>}
          </li>)}
        </ol>}
      </section>

      <section className="dash-card dash-items" aria-labelledby="stats-items-title">
        <CardHeader id="stats-items-title" title={copy.topItemsTitle} hint={copy.topItemsHint}/>
        {view.topItems.length === 0 ? <p className="dash-empty">{view.hasCurrentActivity ? copy.categoriesEmpty : copy.emptyHint}</p> : <table className="dash-table">
          <thead><tr><th scope="col">{copy.item}</th><th scope="col" className="is-num">{copy.qty}</th><th scope="col" className="is-num">{copy.amount}</th><th scope="col" className="is-num">{copy.share}</th></tr></thead>
          <tbody>{view.topItems.map(item => <tr key={item.key}>
            <th scope="row">{item.name}</th>
            <td className="is-num">{item.quantity}</td>
            <td className="is-num">{formatRm(item.amountRm)}</td>
            <td className="is-num">{percentText(item.percent, locale)}</td>
          </tr>)}</tbody>
        </table>}
      </section>

      <section className="dash-card" aria-labelledby="stats-savings-title">
        <CardHeader id="stats-savings-title" title={copy.savingsTitle} hint={copy.savingsHint}/>
        {net == null ? <p className="dash-empty">{copy.savingsUnavailable}</p> : <table className="dash-table">
          <tbody>
            <tr><th scope="row">{copy.storeChoice}</th><td className={`is-num${storeChoice != null && storeChoice < 0 ? " is-bad" : " is-good"}`}>{signedRm(storeChoice)}</td></tr>
            <tr><th scope="row">{copy.itemChanges}</th><td className={`is-num${itemChanges != null && itemChanges < 0 ? " is-bad" : " is-good"}`}>{signedRm(itemChanges)}</td></tr>
            <tr className="is-total"><th scope="row">{copy.net}</th><td className={`is-num${net < 0 ? " is-bad" : " is-good"}`}>{signedRm(net)}</td></tr>
          </tbody>
        </table>}
      </section>
    </div>

    <details className="statistics-about"><summary className="dropdown-summary">{copy.about}<DropdownChevron/></summary><p>{copy.aboutBody}</p></details>
  </section>;
}
