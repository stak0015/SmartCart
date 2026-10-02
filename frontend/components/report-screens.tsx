"use client";

import { DropdownChevron, UIIcon } from "./ui-icon";
import { StoreChainLogo } from "./store-chain-logo";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { formatRm } from "@/lib/format-rm";
import type { InboxState } from "@/lib/inbox";
import { categoryLabel, type Locale } from "@/lib/i18n";
import { formatInclusiveDateRange } from "@/lib/report-format";
import { groupPieCategories } from "@/lib/report-pie";
import { ITEM_CATEGORY_LABELS } from "@/lib/contracts";
import { getManualReportPeriods, type GeneratedReport, type LocalInboxReport, type ReportCadence, type ReportPeriod } from "@/lib/report-generation";
import { buildStatisticsView } from "@/lib/statistics-view";
import { tripTravelSavingsInsight } from "@/lib/savings-insights";
import { boughtLineQuantity, boughtLineTotalRm, boughtLineUnitPrice, listTripRecords, type TripRecord } from "@/lib/trip-history";
import { CatalogueItemImage } from "./catalogue-item-image";

const COPY = {
  en: {
    history: "Shopping history", emptyHistory: "No trips recorded yet", emptyHistoryHint: "Record a trip from your checklist to see it here.",
    bought: "Bought", total: "Total", incomplete: "Some bought items have no price. This total is partial.",
    noBought: "No bought items on this trip.", deleteTrip: "Delete trip",
    itemsTotal: "Items", travelCost: "Return travel (estimated)", tripTotal: "Trip total",
    planDetails: "Planning details", planned: "Planned basket + transport", savings: "Estimated net savings",
    travel: "Travel-cost saving vs cheapest alternative", routeEstimate: "Travel used an approximate straight-line route.",
    report: "Reports", inbox: "Inbox", statistics: "Statistics", weekly: "Weekly", monthly: "Monthly",
    weeklyReport: "Your weekly report", monthlyReport: "Your monthly report",
    inboxDescription: "Personal shopping notes for each completed period.", statisticsDescription: "A clear view of spending, trips, and savings.",
    backToInbox: "Back to inbox", selectReport: "Select a report to read", newsletter: "Shopping newsletter",
    insights: "What stood out", tip: "Worth considering next time", pieShareNote: "Shares are based on confirmed spending for bought items with prices.",
    otherCategories: "Other categories", partialCategory: "Partial", readerPeriod: "Shopping period",
    emptyReports: "No reports yet", emptyReportsHint: "Generate a report for this week or month, or its previous period if the current one has no trips. AI reports must be enabled first.",
    unread: "Unread", read: "Read", trips: (count: number) => `${count} ${count === 1 ? "trip" : "trips"}`,
    periodTotal: "Confirmed spending", spending: "Confirmed spending",
    storeChoice: "Store choice estimate", itemChanges: "Item change estimate", tripCount: "Trips",
    savingsIncomplete: "Saved savings estimates are incomplete for this period.",
    estimateNote: "Savings are estimates from saved comparisons. Travel costs are not included in confirmed spending.",
    noData: "No trips in this period.", noPriced: "No bought items have a confirmed price in this period.",
    noPrevious: "No trips were recorded in the comparison period.",
    reportPartial: "Some bought items have no confirmed price. Confirmed spending includes priced bought items only.",
    savingsUnavailable: "No saved savings estimate is available for this period.",
    compareTitle: "Period comparison", categoryTitle: "Confirmed spending by category",
    categoryEmpty: "No priced bought items to group by category.", essentialsTitle: "Spending classes",
    overviewTitle: "Overview", categoriesTitle: "Categories", savingsTitle: "Savings", essentialsSectionTitle: "Essentials",
    aiEnabled: "AI report generation is enabled.", aiDisabled: "AI report generation is disabled.",
    generateGroup: "Generate a shopping report", generateWeekly: "Generate weekly report", generateMonthly: "Generate monthly report",
    generateHint: "Uses this week's or month's activity, or the previous period if the current one has no trips.",
    settings: "Report settings", settingsTitle: "AI report privacy settings", close: "Close",
    enable: "Enable AI reports", noThanks: "No thanks", disable: "Disable AI reports",
    deleteAll: "Delete all reports", deleteConfirm: "Delete all reports stored on this device? This cannot be undone.",
    storageError: "The consent choice or report could not be saved on this device. No new report request was sent.",
    empty: "No data", value: "Amount", percentage: "Share", category: "Category", period: "Period", metric: "Metric",
    previousPeriod: "Comparison period", currentPeriod: "Selected period",
    generating: "Generating this report… You can keep using SmartCart.", failed: "This report could not be generated or saved.", retry: "Retry",
    unreadCount: "Unread reports", readCount: "Read report", reportSettingsStatus: "AI report setting",
    disableStatus: "Future report requests are disabled. Ready reports remain on this device.",
    deleteSaved: "Delete ready reports from this device. Trip history is not affected.",
    policyEn: "When you enable AI reports, SmartCart’s backend receives your bought items and their catalogue categories to prepare the report. It sends Cerebras the report and comparison date ranges, bought item names, broad shopping categories and labels, quantities, line totals or missing price markers, and saved savings snapshots. The backend does not retain the request or report. A ready report and its read state are stored on this device.",
    policyMs: "Apabila anda mengaktifkan laporan AI, bahagian belakang SmartCart menerima item yang dibeli dan kategori katalog untuk menyediakan laporan. Ia menghantar julat tarikh laporan dan perbandingan, nama item dibeli, kategori umum membeli-belah dan labelnya, kuantiti, jumlah baris atau penanda harga tiada, serta ringkasan penjimatan tersimpan kepada Cerebras. Bahagian belakang tidak menyimpan permintaan atau laporan. Laporan sedia dan status bacaan disimpan pada peranti ini.",
    dataChart: "Chart data", noConfirmedValues: "Confirmed spending is unavailable because no bought line has a confirmed price.",
    estimatesUnavailable: "Estimated savings are unavailable because no usable saved estimate exists.",
  },
  ms: {
    history: "Sejarah membeli-belah", emptyHistory: "Belum ada perjalanan direkodkan", emptyHistoryHint: "Rekodkan perjalanan daripada senarai semak untuk melihatnya di sini.",
    bought: "Dibeli", total: "Jumlah", incomplete: "Sesetengah item dibeli tiada harga. Jumlah ini separa.",
    noBought: "Tiada item dibeli dalam perjalanan ini.", deleteTrip: "Padam perjalanan",
    itemsTotal: "Item", travelCost: "Perjalanan pergi balik (anggaran)", tripTotal: "Jumlah perjalanan",
    planDetails: "Butiran perancangan", planned: "Bakul + pengangkutan yang dirancang", savings: "Anggaran penjimatan bersih",
    travel: "Penjimatan perjalanan vs alternatif termurah", routeEstimate: "Perjalanan menggunakan anggaran jarak garis lurus.",
    report: "Laporan", inbox: "Peti masuk", statistics: "Statistik", weekly: "Mingguan", monthly: "Bulanan",
    weeklyReport: "Laporan mingguan anda", monthlyReport: "Laporan bulanan anda",
    inboxDescription: "Catatan membeli-belah peribadi bagi setiap tempoh yang lengkap.", statisticsDescription: "Gambaran jelas tentang perbelanjaan, perjalanan dan penjimatan.",
    backToInbox: "Kembali ke peti masuk", selectReport: "Pilih laporan untuk dibaca", newsletter: "Surat berita membeli-belah",
    insights: "Perkara yang menonjol", tip: "Untuk dipertimbangkan lain kali", pieShareNote: "Bahagian berdasarkan perbelanjaan disahkan bagi item dibeli yang mempunyai harga.",
    otherCategories: "Kategori lain", partialCategory: "Separa", readerPeriod: "Tempoh membeli-belah",
    emptyReports: "Belum ada laporan", emptyReportsHint: "Jana laporan untuk minggu atau bulan ini, atau tempoh sebelumnya jika tempoh semasa tiada perjalanan. Laporan AI perlu diaktifkan dahulu.",
    unread: "Belum dibaca", read: "Dibaca", trips: (count: number) => `${count} perjalanan`,
    periodTotal: "Perbelanjaan disahkan", spending: "Perbelanjaan disahkan",
    storeChoice: "Anggaran pilihan kedai", itemChanges: "Anggaran perubahan item", tripCount: "Perjalanan",
    savingsIncomplete: "Anggaran penjimatan tersimpan tidak lengkap bagi tempoh ini.",
    estimateNote: "Penjimatan ialah anggaran daripada perbandingan tersimpan. Kos perjalanan tidak termasuk dalam perbelanjaan disahkan.",
    noData: "Tiada perjalanan dalam tempoh ini.", noPriced: "Tiada item dibeli dengan harga disahkan dalam tempoh ini.",
    noPrevious: "Tiada perjalanan direkodkan dalam tempoh perbandingan.",
    reportPartial: "Sesetengah item dibeli tiada harga disahkan. Perbelanjaan disahkan hanya merangkumi item dibeli yang mempunyai harga.",
    savingsUnavailable: "Tiada anggaran penjimatan tersimpan bagi tempoh ini.",
    compareTitle: "Perbandingan tempoh", categoryTitle: "Perbelanjaan disahkan mengikut kategori",
    categoryEmpty: "Tiada item dibeli berharga untuk dikelompokkan mengikut kategori.", essentialsTitle: "Kelas perbelanjaan",
    overviewTitle: "Gambaran keseluruhan", categoriesTitle: "Kategori", savingsTitle: "Penjimatan", essentialsSectionTitle: "Keperluan",
    aiEnabled: "Penjanaan laporan AI diaktifkan.", aiDisabled: "Penjanaan laporan AI dinyahaktifkan.",
    generateGroup: "Jana laporan membeli-belah", generateWeekly: "Jana laporan mingguan", generateMonthly: "Jana laporan bulanan",
    generateHint: "Gunakan aktiviti minggu atau bulan ini, atau tempoh sebelumnya jika tempoh semasa tiada perjalanan.",
    settings: "Tetapan laporan", settingsTitle: "Tetapan privasi laporan AI", close: "Tutup",
    enable: "Aktifkan laporan AI", noThanks: "Tidak, terima kasih", disable: "Nyahaktifkan laporan AI",
    deleteAll: "Padam semua laporan", deleteConfirm: "Padam semua laporan yang disimpan pada peranti ini? Tindakan ini tidak boleh dibuat asal.",
    storageError: "Pilihan persetujuan atau laporan tidak dapat disimpan pada peranti ini. Tiada permintaan laporan baharu dihantar.",
    empty: "Tiada data", value: "Jumlah", percentage: "Bahagian", category: "Kategori", period: "Tempoh", metric: "Metrik",
    previousPeriod: "Tempoh perbandingan", currentPeriod: "Tempoh dipilih",
    generating: "Laporan ini sedang dijana… Anda boleh terus menggunakan SmartCart.", failed: "Laporan ini tidak dapat dijana atau disimpan.", retry: "Cuba lagi",
    unreadCount: "Laporan belum dibaca", readCount: "Laporan dibaca", reportSettingsStatus: "Tetapan laporan AI",
    disableStatus: "Permintaan laporan akan datang dinyahaktifkan. Laporan sedia kekal pada peranti ini.",
    deleteSaved: "Padam laporan sedia daripada peranti ini. Sejarah perjalanan tidak terjejas.",
    policyEn: "When you enable AI reports, SmartCart’s backend receives your bought items and their catalogue categories to prepare the report. It sends Cerebras the report and comparison date ranges, bought item names, broad shopping categories and labels, quantities, line totals or missing price markers, and saved savings snapshots. The backend does not retain the request or report. A ready report and its read state are stored on this device.",
    policyMs: "Apabila anda mengaktifkan laporan AI, bahagian belakang SmartCart menerima item yang dibeli dan kategori katalog untuk menyediakan laporan. Ia menghantar julat tarikh laporan dan perbandingan, nama item dibeli, kategori umum membeli-belah dan labelnya, kuantiti, jumlah baris atau penanda harga tiada, serta ringkasan penjimatan tersimpan kepada Cerebras. Bahagian belakang tidak menyimpan permintaan atau laporan. Laporan sedia dan status bacaan disimpan pada peranti ini.",
    dataChart: "Data carta", noConfirmedValues: "Perbelanjaan disahkan tidak tersedia kerana tiada baris dibeli yang mempunyai harga disahkan.",
    estimatesUnavailable: "Anggaran penjimatan tidak tersedia kerana tiada anggaran tersimpan yang boleh digunakan.",
  },
} as const;

function localDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
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

export function ReceiptHistoryScreen({ history, locale, onDeleteTrip }: { history: TripRecord[]; locale: Locale; onDeleteTrip: (recordId: string) => void }) {
  const copy = COPY[locale];
  const records = listTripRecords(history);
  return (
    <div className="screen-enter history-screen">
      <h1 className="text-3xl font-extrabold text-[#10152e]">{copy.history}</h1><p className="page-description">{locale === "en" ? "Your recorded shopping trips and receipts." : "Perjalanan membeli-belah dan resit anda."}</p>
      {records.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#becdc6] bg-white p-7 text-center"><p className="font-bold">{copy.emptyHistory}</p><p className="mt-1 text-sm text-[#526078]">{copy.emptyHistoryHint}</p></div> : (
        <ol className="mt-5 space-y-3">{records.map((record, index) => {
          const bought = record.lines.filter(line => line.status === "bought");
          const incomplete = bought.some(line => boughtLineTotalRm(line) == null);
          const travel = tripTravelSavingsInsight(record);
          const receipt = receiptTotals(record);
          return (
            <li key={record.id} className="receipt-card">
              <details open={index === 0 ? true : undefined}>
                <summary className="receipt-heading cursor-pointer list-none p-4 marker:hidden sm:p-5">
                  <span className="receipt-heading-content"><span className="receipt-store-icon" aria-hidden="true"><StoreChainLogo name={record.store.name} fallback={<UIIcon name="bag" size={32}/>} /></span><span><span className="block text-lg font-extrabold text-[#10152e]">{record.store.name}</span><span className="mt-1 block text-xs text-[#526078]">{localDate(record.recordedAt, locale)} · {bought.length} {copy.bought.toLowerCase()}</span></span><span className="text-right"><span className="block text-xs text-[#526078]">{copy.tripTotal}</span><span className="block text-xl font-extrabold text-[#007d38]">{receipt.total == null ? "—" : formatRm(receipt.total)}</span></span><DropdownChevron/></span>
                </summary>
                <div className="receipt-body">
                  {bought.length === 0 ? <p className="py-3 text-sm text-[#526078]">{copy.noBought}</p> : (
                    <ul className="receipt-lines">{bought.map(line => {
                      const quantity = boughtLineQuantity(line);
                      const unitPrice = boughtLineUnitPrice(line);
                      const lineTotal = boughtLineTotalRm(line);
                      const name = (locale === "ms" ? line.itemNameMs : line.itemNameEn) || line.itemName;
                      return <li key={line.id} className="receipt-line flex justify-between gap-3 py-2 text-sm"><span className="receipt-line-image" aria-hidden="true"><CatalogueItemImage imageUrl={line.imageUrl} fallbackSize={26}/></span><div className="min-w-0 flex-1"><p className="font-bold text-[#10152e]">{name}</p><p className="text-xs text-[#526078]">{categoryLabel(locale, line.category)}</p><p className="text-xs text-[#526078]">{quantity} × {unitPrice == null ? "—" : formatRm(unitPrice)}</p></div><span className="shrink-0 font-bold tabular-nums text-[#10152e]">{lineTotal == null ? "—" : formatRm(lineTotal)}</span></li>;
                    })}</ul>
                  )}
                  <div className="receipt-totals"><h2>{locale === "en" ? "Trip summary" : "Ringkasan perjalanan"}</h2><p className="flex justify-between gap-3"><span>{copy.itemsTotal}</span><span>{receipt.items == null ? "—" : formatRm(receipt.items)}</span></p><p className="flex justify-between gap-3"><span>{copy.travelCost}</span><span>{receipt.travel == null ? "—" : formatRm(receipt.travel)}</span></p></div>
                  <div className="receipt-grand-total"><span>{copy.tripTotal}</span><span>{receipt.total == null ? "—" : formatRm(receipt.total)}</span></div>
                  {incomplete && <p className="mt-2 text-xs text-[#526078]">{copy.incomplete}</p>}
                  <details className="receipt-planning"><summary className="dropdown-summary cursor-pointer font-bold text-[#007d38]">{copy.planDetails}<DropdownChevron/></summary><div className="mt-2 space-y-1"><p>{copy.planned}: {record.plannedCombinedTotalRm == null ? "—" : formatRm(record.plannedCombinedTotalRm)}</p>{record.estimatedSavings?.netSavingRm != null && <p>{copy.savings}: {signedRm(record.estimatedSavings.netSavingRm)}</p>}{travel.available && travel.savingsRm != null && <p>{copy.travel}: {formatRm(travel.savingsRm)}</p>}{record.routeProvider === "straight_line" && <p>{copy.routeEstimate}</p>}</div></details>
                  <button type="button" className="receipt-delete-button" aria-label={locale === "en" ? `Delete trip to ${record.store.name}` : `Padam perjalanan ke ${record.store.name}`} onClick={() => onDeleteTrip(record.id)}>{copy.deleteTrip}</button>
                </div>
              </details>
            </li>
          );
        })}</ol>
      )}
    </div>
  );
}

export interface ReportGenerationUiState extends ReportPeriod {
  status: "generating" | "failed";
}

export type ConsentDialogMode = "automatic" | "settings" | null;

function moneyOrDash(value: number | null) {
  return value == null ? "—" : formatRm(value);
}

function percent(value: number | null, locale: Locale) {
  return value == null ? "—" : `${new Intl.NumberFormat(locale === "ms" ? "ms-MY" : "en-MY", { maximumFractionDigits: 1 }).format(value)}%`;
}

type PieCategoryRow = GeneratedReport["categorySpending"][number] & { percent?: number | null };

const PIE_COLORS = ["#16844c", "#426cc5", "#e6a632", "#9254de", "#d95c59", "#159b9b", "#758394"] as const;

function broadCategoryName(categoryId: string, locale: Locale) {
  if (categoryId === "uncategorised") return locale === "en" ? "Uncategorised" : "Tidak berkategori";
  return ITEM_CATEGORY_LABELS[categoryId as keyof typeof ITEM_CATEGORY_LABELS]?.[locale] ?? categoryId;
}

function CategoryPie({ rows, locale, title, empty }: { rows: PieCategoryRow[]; locale: Locale; title: string; empty: string }) {
  const copy = COPY[locale];
  const { orderedRows, totalRm: total, slices: groupedSlices } = groupPieCategories(rows);
  const byId = new Map<string, PieCategoryRow>(orderedRows.map(row => [row.categoryId, row]));
  const slices = groupedSlices.map(slice => ({
    ...slice,
    label: slice.categoryId === "other-categories" ? copy.otherCategories : broadCategoryName(byId.get(slice.categoryId)!.categoryId, locale),
  }));
  let currentAngle = 0;
  const gradientStops = slices.map((slice, index) => {
    const start = currentAngle;
    currentAngle += total > 0 ? slice.amountRm / total * 360 : 0;
    return `${PIE_COLORS[index % PIE_COLORS.length]} ${start}deg ${currentAngle}deg`;
  });
  const chartSummary = slices.map(slice => `${slice.label}, ${formatRm(slice.amountRm)}, ${percent(total > 0 ? slice.amountRm / total * 100 : null, locale)}`).join("; ");

  return <div className="chart-block category-pie-block">
    {total <= 0 ? <p className="report-notice">{empty}</p> : <div className="category-pie-layout">
      <div className="category-pie" role="img" aria-label={`${title}. ${chartSummary}`} style={{ background: `conic-gradient(from -90deg, ${gradientStops.join(", ")})` }}/>
      <ul className="category-pie-legend" aria-label={title}>{slices.map((slice, index) => <li key={slice.categoryId}>
        <span className="category-pie-swatch" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} aria-hidden="true"/>
        <span className="category-pie-label">{slice.label}</span>
        <span className="category-pie-amount">{formatRm(slice.amountRm)} · {percent(total > 0 ? slice.amountRm / total * 100 : null, locale)}</span>
      </li>)}</ul>
    </div>}
    <p className="category-pie-note">{copy.pieShareNote}</p>
    <table className="chart-data-table"><caption>{title}</caption><thead><tr><th scope="col">{copy.category}</th><th scope="col">{copy.value}</th><th scope="col">{copy.percentage}</th></tr></thead><tbody>{orderedRows.map(row => <tr key={row.categoryId}><th scope="row">{broadCategoryName(row.categoryId, locale)}{row.partial ? <span className="category-partial-label"> · {copy.partialCategory}</span> : null}</th><td>{formatRm(row.amountRm)}</td><td>{percent(total > 0 ? row.amountRm / total * 100 : null, locale)}</td></tr>)}</tbody></table>
  </div>;
}

function ReportFacts({ report, locale }: { report: GeneratedReport; locale: Locale }) {
  const copy = COPY[locale];
  const previous = report.comparison;
  const currentCents = report.actualSpendingRm == null ? null : Math.round(report.actualSpendingRm * 100);
  const previousCents = previous?.actualSpendingRm == null ? null : Math.round(previous.actualSpendingRm * 100);
  const differenceCents = currentCents != null && previousCents != null ? currentCents - previousCents : null;
  const savingsParts = [
    report.storeChoiceImpactRm == null ? null : `${copy.storeChoice}: ${signedRm(report.storeChoiceImpactRm)}`,
    report.itemChangeImpactRm == null ? null : `${copy.itemChanges}: ${signedRm(report.itemChangeImpactRm)}`,
  ].filter((part): part is string => part !== null);

  return <div className="report-facts">
    <section aria-labelledby={`report-activity-${report.id}`}>
      <h3 id={`report-activity-${report.id}`}>{locale === "en" ? "Your shopping, in numbers" : "Pembelian anda dalam angka"}</h3>
      <p>{locale === "en" ? `You recorded ${copy.trips(report.tripCount)} this period.` : `Anda merekodkan ${copy.trips(report.tripCount)} dalam tempoh ini.`} {report.actualSpendingRm == null
        ? copy.noConfirmedValues
        : locale === "en"
          ? `Confirmed spending on bought items with prices was ${formatRm(report.actualSpendingRm)}.`
          : `Perbelanjaan disahkan bagi item yang dibeli dan mempunyai harga ialah ${formatRm(report.actualSpendingRm)}.`}</p>
      {report.spendingIncomplete && <p className="report-fact-note">{copy.reportPartial}</p>}
      {previous && <p>{differenceCents == null
        ? (locale === "en" ? "There are not enough confirmed prices to compare spending with the previous period." : "Harga yang disahkan tidak mencukupi untuk membandingkan perbelanjaan dengan tempoh sebelumnya.")
        : differenceCents === 0
          ? (locale === "en" ? `That matches confirmed spending in the previous period (${formatRm(previous.actualSpendingRm!)}).` : `Jumlah itu sama dengan perbelanjaan disahkan dalam tempoh sebelumnya (${formatRm(previous.actualSpendingRm!)}).`)
          : locale === "en"
            ? `That was ${formatRm(Math.abs(differenceCents) / 100)} ${differenceCents > 0 ? "more" : "less"} than the previous period (${formatRm(previous.actualSpendingRm!)}).`
            : `Jumlah itu ${formatRm(Math.abs(differenceCents) / 100)} ${differenceCents > 0 ? "lebih tinggi" : "lebih rendah"} berbanding tempoh sebelumnya (${formatRm(previous.actualSpendingRm!)}).`}</p>}
    </section>
    <section aria-labelledby={`report-categories-${report.id}`}>
      <h3 id={`report-categories-${report.id}`}>{locale === "en" ? "Where your spending went" : "Perbelanjaan anda mengikut kategori"}</h3>
      {report.categorySpending.length > 0 ? <>
        <p>{locale === "en" ? "Here is what the priced items added up to in each broad shopping category:" : "Berikut ialah jumlah bagi item berharga dalam setiap kategori umum membeli-belah:"}</p>
        <ul className="report-category-list">{report.categorySpending.map(row => <li key={row.categoryId}>
          <span>{broadCategoryName(row.categoryId, locale)}</span><strong>{formatRm(row.amountRm)}{report.actualSpendingRm != null && report.actualSpendingRm > 0 ? ` · ${percent(row.amountRm / report.actualSpendingRm * 100, locale)}` : ""}</strong>
        </li>)}</ul>
        <p className="report-fact-note">{copy.pieShareNote}</p>
      </> : <p>{copy.categoryEmpty}</p>}
    </section>
    <section aria-labelledby={`report-savings-${report.id}`}>
      <h3 id={`report-savings-${report.id}`}>{locale === "en" ? "What your comparisons estimated" : "Anggaran daripada perbandingan anda"}</h3>
      <p>{report.estimatedNetSavingsRm == null
        ? copy.savingsUnavailable
        : locale === "en"
          ? `Your saved comparisons estimated net savings of ${signedRm(report.estimatedNetSavingsRm)} for this period.`
          : `Perbandingan tersimpan menganggarkan penjimatan bersih sebanyak ${signedRm(report.estimatedNetSavingsRm)} bagi tempoh ini.`}</p>
      {savingsParts.length > 0 && <p>{savingsParts.join(" · ")}</p>}
      {report.savingsIncomplete && <p className="report-fact-note">{copy.savingsIncomplete}</p>}
      <p className="report-fact-note">{copy.estimateNote}</p>
    </section>
  </div>;
}

function NewsletterContent({ report, locale }: { report: LocalInboxReport; locale: Locale }) {
  const copy = COPY[locale];
  const newsletter = report.newsletter;
  return <section className="report-newsletter" aria-labelledby={`newsletter-subject-${report.id}`}>
    <header className="newsletter-header">
      <p className="newsletter-kicker">{copy.newsletter}</p>
      <h2 id={`newsletter-subject-${report.id}`}>{newsletter.subject}</h2>
      <p className="newsletter-period">{copy.readerPeriod}: {formatInclusiveDateRange(report.periodStart, report.periodEnd, locale)}</p>
    </header>
    <p className="newsletter-opening">{newsletter.opening}</p>
    {newsletter.insights.length > 0 && <section className="newsletter-insights" aria-labelledby={`newsletter-insights-${report.id}`}>
      <h3 id={`newsletter-insights-${report.id}`}>{copy.insights}</h3>
      <ol>{newsletter.insights.map((insight, index) => <li key={`${report.id}-insight-${index}`}><h4>{insight.heading}</h4><p>{insight.body}</p></li>)}</ol>
    </section>}
    {newsletter.tip && <aside className="newsletter-tip"><h3>{copy.tip}</h3><p>{newsletter.tip}</p></aside>}
    <ReportFacts report={report} locale={locale}/>
  </section>;
}

function ReportDetails({ report, locale }: { report: LocalInboxReport; locale: Locale }) {
  return <div className="report-reader-content"><NewsletterContent report={report} locale={locale}/></div>;
}

function PeriodSmallMultiple({
  title, currentLabel, comparisonLabel, currentValue, comparisonValue, locale, signed = false,
}: {
  title: string; currentLabel: string; comparisonLabel: string; currentValue: number | null; comparisonValue: number | null; locale: Locale; signed?: boolean;
}) {
  const copy = COPY[locale];
  const max = Math.max(Math.abs(currentValue ?? 0), Math.abs(comparisonValue ?? 0));
  const rows = [
    { label: currentLabel, value: currentValue },
    { label: comparisonLabel, value: comparisonValue },
  ];
  return <section className="period-small-multiple"><h3>{title}</h3><ul>{rows.map((row, index) => <li key={index}>
    <div className="period-small-heading"><span>{row.label}</span><strong>{signed ? signedRm(row.value) : moneyOrDash(row.value)}</strong></div>
    <div className="period-bar-track" aria-hidden="true"><span style={{ width: max > 0 && row.value != null ? `${Math.abs(row.value) / max * 100}%` : "0%" }}/></div>
  </li>)}</ul><table className="chart-data-table"><caption>{title}</caption><thead><tr><th scope="col">{copy.period}</th><th scope="col">{copy.value}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><th scope="row">{row.label}</th><td>{signed ? signedRm(row.value) : moneyOrDash(row.value)}</td></tr>)}</tbody></table></section>;
}

export function ReportScreen({
  state, locale, history, generationStates, consentStatus, onCadence, onRead, onRetry, onGenerate, onOpenSettings,
}: {
  state: InboxState;
  locale: Locale;
  history: TripRecord[];
  generationStates: Record<string, ReportGenerationUiState>;
  consentStatus: "accepted" | "declined" | "undecided";
  onCadence: (cadence: ReportCadence) => void;
  onRead: (id: string) => void;
  onRetry: (id: string) => void;
  onGenerate: (cadence: ReportCadence) => void;
  onOpenSettings: () => void;
}) {
  const copy = COPY[locale];
  const [tab, setTab] = useState<"inbox" | "statistics">("inbox");
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const inboxHeadingRef = useRef<HTMLHeadingElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const statistics = useMemo(() => buildStatisticsView(history, state.cadence, new Date(), locale), [history, locale, state.cadence]);
  const analytics = statistics.analytics;
  const current = analytics.current;
  const comparison = analytics.previous;
  const currentLabel = statistics.currentRangeLabel;
  const comparisonLabel = statistics.comparisonRangeLabel;
  const currentSavings = current.savings.netSaving.amountRm;
  const comparisonSavings = comparison.savings.netSaving.amountRm;
  const currentCategories = statistics.categoryRows;
  const manualPeriods = useMemo(
    () => new Map(getManualReportPeriods(history, new Date()).map(period => [period.cadence, period])),
    [history],
  );
  const selectedMessage = state.messages.find(message => message.id === openReportId) ?? null;
  useEffect(() => {
    if (openReportId && window.matchMedia("(max-width: 700px)").matches) backButtonRef.current?.focus();
  }, [openReportId]);
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, selected: "inbox" | "statistics") => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = selected === "inbox" ? "statistics" : "inbox";
    setTab(next);
    document.getElementById(`report-tab-${next}`)?.focus();
  };
  const openReport = (message: LocalInboxReport) => {
    setOpenReportId(message.id);
    if (!message.read) onRead(message.id);
  };
  const countUnread = state.messages.filter(message => !message.read).length;
  const activeStates = Object.values(generationStates).sort((left, right) => Date.parse(right.periodEnd) - Date.parse(left.periodEnd));
  const readyIds = new Set(state.messages.map(message => message.id));
  const visibleStates = activeStates.filter(generation => !readyIds.has(generation.id));
  const generationInProgress = activeStates.some(generation => generation.status === "generating");

  return (
    <div className="screen-enter reports-screen">
      <header className="reports-heading"><div><h1>{copy.report}</h1><p className="page-description">{tab === "inbox" ? copy.inboxDescription : copy.statisticsDescription}</p></div><div className="reports-heading-actions"><button type="button" className="secondary-button" onClick={onOpenSettings}>{copy.settings}</button></div></header>
      <div role="tablist" aria-label={copy.report} className="report-tabs">
        {(["inbox", "statistics"] as const).map(option => <button key={option} id={`report-tab-${option}`} type="button" role="tab" aria-selected={tab === option} aria-controls={`report-panel-${option}`} tabIndex={tab === option ? 0 : -1} onClick={() => setTab(option)} onKeyDown={event => onTabKeyDown(event, option)}><span aria-hidden="true"><UIIcon name={option === "inbox" ? "document" : "reports"}/></span>{copy[option]}{option === "inbox" && countUnread > 0 ? <span className="report-unread-count" aria-label={`${countUnread} ${copy.unreadCount}`}>{countUnread}</span> : null}</button>)}
      </div>
      {tab === "inbox" ? <section id="report-panel-inbox" role="tabpanel" aria-labelledby="report-tab-inbox" className="report-inbox">
        <div className={`inbox-layout ${selectedMessage ? "has-selection" : ""}`}>
          <aside className="inbox-list-panel" aria-label={copy.inbox}>
            <div className="inbox-list-toolbar"><h2 ref={inboxHeadingRef} tabIndex={-1}>{copy.inbox}</h2><span>{state.messages.length}</span></div>
            <div className="inbox-status-line" role="status">{consentStatus === "accepted" ? copy.aiEnabled : copy.aiDisabled}</div>
            <div className="report-generate-panel">
              <div role="group" aria-label={copy.generateGroup} className="report-generate-actions">
                {(["weekly", "monthly"] as const).map(cadence => {
                  const period = manualPeriods.get(cadence);
                  return <button key={cadence} type="button" className="primary-button report-generate-button" disabled={!period || generationInProgress} onClick={() => onGenerate(cadence)}>
                    <span>{cadence === "weekly" ? copy.generateWeekly : copy.generateMonthly}</span>
                    {period && <small>{formatInclusiveDateRange(period.periodStart, period.periodEnd, locale)}</small>}
                  </button>;
                })}
              </div>
              <p>{copy.generateHint}</p>
            </div>
            {visibleStates.length === 0 && state.messages.length === 0 ? <div className="report-empty"><p>{copy.emptyReports}</p><p>{copy.emptyReportsHint}</p></div> : <ol className="inbox-message-list">
              {visibleStates.map(generation => <li key={generation.id} className="inbox-message-row report-transient-card">
                <div className="inbox-message-status"><span className="report-document-icon" aria-hidden="true"><UIIcon name="document" size={24}/></span><span className="report-card-name"><strong>{generation.cadence === "weekly" ? copy.weeklyReport : copy.monthlyReport}</strong><span>{formatInclusiveDateRange(generation.periodStart, generation.periodEnd, locale)}</span></span></div>
                {generation.status === "generating" ? <p role="status" className="report-notice">{copy.generating}</p> : <div><p role="alert" className="report-warning">{copy.failed}</p><button type="button" className="secondary-button" onClick={() => onRetry(generation.id)}>{copy.retry}</button></div>}
              </li>)}
              {state.messages.map(message => <li key={message.id} className={`inbox-message-row ${openReportId === message.id ? "is-selected" : ""} ${!message.read ? "is-unread" : ""}`}>
                <button type="button" aria-pressed={openReportId === message.id} aria-label={`${message.read ? copy.readCount : copy.unreadCount}: ${message.newsletter.subject}, ${formatInclusiveDateRange(message.periodStart, message.periodEnd, locale)}`} onClick={() => openReport(message)} className="inbox-message-button">
                  <span className="inbox-message-icon" aria-hidden="true"><UIIcon name="document" size={24}/></span>
                  <span className="inbox-message-copy"><span className="inbox-message-meta"><span>{message.cadence === "weekly" ? copy.weeklyReport : copy.monthlyReport} · {formatInclusiveDateRange(message.periodStart, message.periodEnd, locale)}</span>{!message.read && <span className="report-new">{copy.unread}</span>}</span>
                    <strong>{message.newsletter.subject}</strong><span className="inbox-message-preview">{message.newsletter.preview}</span>
                  </span>
                </button>
              </li>)}
            </ol>}
          </aside>
          <section className="inbox-reading-pane" aria-label={copy.newsletter} aria-live="polite">
            {selectedMessage ? <article className="inbox-reading-message">
              <div className="inbox-reading-topline"><button ref={backButtonRef} type="button" className="inbox-back-button secondary-button" onClick={() => { setOpenReportId(null); window.requestAnimationFrame(() => inboxHeadingRef.current?.focus()); }}>{copy.backToInbox}</button><span>{selectedMessage.read ? copy.read : copy.unread}</span></div>
              <ReportDetails report={selectedMessage} locale={locale}/>
            </article> : <div className="inbox-reader-empty"><UIIcon name="document" size={36}/><p>{copy.selectReport}</p></div>}
          </section>
        </div>
      </section> : <section id="report-panel-statistics" role="tabpanel" aria-labelledby="report-tab-statistics" className="statistics-panel">
        <div className="statistics-toolbar"><div className="statistics-period"><strong>{copy.currentPeriod}</strong><span>{currentLabel}</span></div><div className="statistics-controls"><div role="group" aria-label={copy.statistics} className="cadence-toggle">{(["weekly", "monthly"] as const).map(cadence => <button key={cadence} type="button" aria-pressed={state.cadence === cadence} onClick={() => onCadence(cadence)}>{copy[cadence]}</button>)}</div></div></div>
        <div className="statistics-metrics">
          <article className="stat-metric tone-green"><span className="metric-icon" aria-hidden="true"><UIIcon name="basket" size={34}/></span><h2>{copy.spending}</h2><strong>{moneyOrDash(current.actualSpendingRm)}</strong></article>
          <article className="stat-metric tone-blue"><span className="metric-icon" aria-hidden="true"><UIIcon name="bag" size={34}/></span><h2>{copy.tripCount}</h2><strong>{current.tripCount}</strong></article>
          <article className="stat-metric tone-purple"><span className="metric-icon" aria-hidden="true"><UIIcon name="savings" size={34}/></span><h2>{copy.savings}</h2><strong>{signedRm(currentSavings)}</strong></article>
        </div>
        {!statistics.hasCurrentActivity && <p className="report-notice">{copy.noData}</p>}
        {statistics.hasCurrentActivity && !statistics.hasConfirmedSpending && <p className="report-notice">{copy.noPriced}</p>}
        {statistics.hasPartialSpending && <p className="report-warning">{copy.incomplete}</p>}
        {statistics.hasIncompleteSavings && <p className="report-warning">{copy.savingsIncomplete}</p>}
        <div className="statistics-grid">
          <section className="statistics-card"><h2>{copy.categoryTitle}</h2><CategoryPie rows={currentCategories} locale={locale} title={copy.categoryTitle} empty={copy.categoryEmpty}/></section>
          <section className="statistics-card comparison-card"><h2>{copy.compareTitle}</h2><div className="comparison-period-labels"><p><strong>{copy.currentPeriod}</strong><span>{currentLabel}</span></p><p><strong>{copy.previousPeriod}</strong><span>{comparisonLabel}</span></p></div>
            {!statistics.hasComparisonActivity && <p className="report-notice">{copy.noPrevious}</p>}
            <PeriodSmallMultiple title={copy.spending} currentLabel={currentLabel} comparisonLabel={comparisonLabel} currentValue={current.actualSpendingRm} comparisonValue={statistics.hasComparisonActivity ? comparison.actualSpendingRm : null} locale={locale}/>
            <PeriodSmallMultiple title={copy.savings} currentLabel={currentLabel} comparisonLabel={comparisonLabel} currentValue={currentSavings} comparisonValue={statistics.hasComparisonActivity ? comparisonSavings : null} locale={locale} signed/>
          </section>
        </div>
        <details className="statistics-about"><summary className="dropdown-summary">{locale === "en" ? "About these statistics" : "Tentang statistik ini"}<DropdownChevron/></summary><p>{copy.estimateNote}</p></details>
      </section>}
    </div>
  );
}

export function ReportConsentDialog({ mode, status, locale, storageError, onAccept, onDecline, onDisable, onDeleteAll, onClose }: {
  mode: ConsentDialogMode;
  status: "accepted" | "declined" | "undecided";
  locale: Locale;
  storageError: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onDisable: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}) {
  if (!mode) return null;
  const copy = COPY[locale];
  return <div className="consent-backdrop"><section className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="report-consent-title">
    <header><h2 id="report-consent-title">{mode === "automatic" ? copy.settingsTitle : copy.settingsTitle}</h2>{mode === "settings" && <button type="button" className="dialog-close" onClick={onClose}>{copy.close}</button>}</header>
    <div className="consent-language"><strong>English</strong><p>{copy.policyEn}</p></div>
    <div className="consent-language" lang="ms"><strong>Bahasa Melayu</strong><p>{copy.policyMs}</p></div>
    {storageError && <p role="alert" className="report-warning">{copy.storageError}</p>}
    <div className="consent-actions">
      {status === "accepted" ? <button type="button" className="secondary-button" onClick={onDisable}>{copy.disable}</button> : <button type="button" className="primary-button" onClick={onAccept}>{copy.enable}</button>}
      {status !== "accepted" && <button type="button" className="secondary-button" onClick={onDecline}>{copy.noThanks}</button>}
    </div>
    {mode === "settings" && <div className="consent-delete"><p>{copy.deleteSaved}</p><button type="button" className="secondary-button danger-button" onClick={onDeleteAll}>{copy.deleteAll}</button></div>}
  </section></div>;
}
