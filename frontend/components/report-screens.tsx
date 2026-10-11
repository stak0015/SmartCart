"use client";

import { UIIcon } from "./ui-icon";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { formatRm } from "@/lib/format-rm";
import type { InboxState } from "@/lib/inbox";
import { type Locale } from "@/lib/i18n";
import { formatInclusiveDateRange } from "@/lib/report-format";
import { ITEM_CATEGORY_LABELS } from "@/lib/contracts";
import { getManualReportPeriods, type GeneratedReport, type LocalInboxReport, type ReportCadence, type ReportPeriod } from "@/lib/report-generation";
import { StatisticsPanel } from "./statistics-panel";
import type { TripRecord } from "@/lib/trip-history";

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
    emptyReports: "No reports yet", emptyReportsHint: "Use Generate to create one for this week or month.",
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
    generateGroup: "Generate a shopping report", generateWeekly: "Weekly report", generateMonthly: "Monthly report", newReport: "Generate", generatingShort: "Generating…", noTripsForPeriod: "No trips yet", aiDisabledAction: "AI reports are off. Turn them on in Report settings",
    generateHint: "Covers this week or month so far, or the last one with trips.",
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
    policyEn: "When you enable AI reports, SmartCart’s backend receives the trips from the report period and the 8 weeks (weekly) or 3 months (monthly) before it, so it can compare the period with what is usual for you. For each trip it receives bought item names, broad shopping categories and labels, quantities, unit prices, line totals or missing price markers, planned items you did not buy, the store name, estimated travel and comparison totals, and saved savings snapshots. Your location and routes are never sent. The backend computes the findings itself and sends Cerebras only those findings: the item, store and category names and amounts they mention. The backend does not retain the request or report. A ready report and its read state are stored on this device.",
    policyMs: "Apabila anda mengaktifkan laporan AI, bahagian belakang SmartCart menerima perjalanan dalam tempoh laporan serta 8 minggu (mingguan) atau 3 bulan (bulanan) sebelumnya, supaya tempoh itu dapat dibandingkan dengan kebiasaan anda. Bagi setiap perjalanan, ia menerima nama item dibeli, kategori umum membeli-belah dan labelnya, kuantiti, harga seunit, jumlah baris atau penanda harga tiada, item dirancang yang tidak dibeli, nama kedai, anggaran perjalanan dan jumlah perbandingan, serta ringkasan penjimatan tersimpan. Lokasi dan laluan anda tidak pernah dihantar. Bahagian belakang mengira dapatan sendiri dan hanya menghantar dapatan itu kepada Cerebras: nama item, kedai dan kategori serta amaun yang disebut. Bahagian belakang tidak menyimpan permintaan atau laporan. Laporan sedia dan status bacaan disimpan pada peranti ini.",
    dataChart: "Chart data", noConfirmedValues: "Confirmed spending is unavailable because no bought line has a confirmed price.",
    estimatesUnavailable: "Estimated savings are unavailable because no usable saved estimate exists.",
    reportLanguage: "Report language", 
    numbersTitle: "The numbers", sameAsPrevious: "Same as the previous period", vsPrevious: (amount: string) => `${amount} vs the previous period`, previousTrips: (count: number) => `${count} in the previous period`, vsTypicalStore: "Estimated, vs a typical recommended store", nextTime: "Next time:", aiWritten: "Written with AI from your recorded trips. Every figure comes from your own records.",
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
    emptyReports: "Belum ada laporan", emptyReportsHint: "Gunakan Jana untuk membuat laporan minggu atau bulan ini.",
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
    generateGroup: "Jana laporan membeli-belah", generateWeekly: "Laporan mingguan", generateMonthly: "Laporan bulanan", newReport: "Jana", generatingShort: "Sedang dijana…", noTripsForPeriod: "Belum ada perjalanan", aiDisabledAction: "Laporan AI dimatikan. Hidupkan dalam Tetapan laporan",
    generateHint: "Meliputi minggu atau bulan ini setakat ini, atau tempoh terakhir yang mempunyai perjalanan.",
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
    policyEn: "When you enable AI reports, SmartCart’s backend receives the trips from the report period and the 8 weeks (weekly) or 3 months (monthly) before it, so it can compare the period with what is usual for you. For each trip it receives bought item names, broad shopping categories and labels, quantities, unit prices, line totals or missing price markers, planned items you did not buy, the store name, estimated travel and comparison totals, and saved savings snapshots. Your location and routes are never sent. The backend computes the findings itself and sends Cerebras only those findings: the item, store and category names and amounts they mention. The backend does not retain the request or report. A ready report and its read state are stored on this device.",
    policyMs: "Apabila anda mengaktifkan laporan AI, bahagian belakang SmartCart menerima perjalanan dalam tempoh laporan serta 8 minggu (mingguan) atau 3 bulan (bulanan) sebelumnya, supaya tempoh itu dapat dibandingkan dengan kebiasaan anda. Bagi setiap perjalanan, ia menerima nama item dibeli, kategori umum membeli-belah dan labelnya, kuantiti, harga seunit, jumlah baris atau penanda harga tiada, item dirancang yang tidak dibeli, nama kedai, anggaran perjalanan dan jumlah perbandingan, serta ringkasan penjimatan tersimpan. Lokasi dan laluan anda tidak pernah dihantar. Bahagian belakang mengira dapatan sendiri dan hanya menghantar dapatan itu kepada Cerebras: nama item, kedai dan kategori serta amaun yang disebut. Bahagian belakang tidak menyimpan permintaan atau laporan. Laporan sedia dan status bacaan disimpan pada peranti ini.",
    dataChart: "Data carta", noConfirmedValues: "Perbelanjaan disahkan tidak tersedia kerana tiada baris dibeli yang mempunyai harga disahkan.",
    estimatesUnavailable: "Anggaran penjimatan tidak tersedia kerana tiada anggaran tersimpan yang boleh digunakan.",
    reportLanguage: "Bahasa laporan", 
    numbersTitle: "Angka utama", sameAsPrevious: "Sama seperti tempoh sebelumnya", vsPrevious: (amount: string) => `${amount} berbanding tempoh sebelumnya`, previousTrips: (count: number) => `${count} dalam tempoh sebelumnya`, vsTypicalStore: "Anggaran, berbanding kedai biasa yang disyorkan", nextTime: "Lain kali:", aiWritten: "Ditulis dengan AI daripada perjalanan yang anda rekodkan. Setiap angka datang daripada rekod anda sendiri.",
  },
} as const;

function signedRm(value: number | null) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatRm(Math.abs(value))}`;
}

export { ReceiptHistoryScreen } from "./shopping-history";

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

function broadCategoryName(categoryId: string, locale: Locale) {
  if (categoryId === "uncategorised") return locale === "en" ? "Other items" : "Item lain";
  return ITEM_CATEGORY_LABELS[categoryId as keyof typeof ITEM_CATEGORY_LABELS]?.[locale] ?? categoryId;
}

function ReportNumbers({ report, locale }: { report: GeneratedReport; locale: Locale }) {
  const copy = COPY[locale];
  const previous = report.comparison;
  const currentCents = report.actualSpendingRm == null ? null : Math.round(report.actualSpendingRm * 100);
  const previousCents = previous?.actualSpendingRm == null ? null : Math.round(previous.actualSpendingRm * 100);
  const differenceCents = currentCents != null && previousCents != null ? currentCents - previousCents : null;
  const net = report.estimatedNetSavingsRm;
  const topCategories = report.categorySpending.slice(0, 4);

  return <section className="report-numbers" aria-labelledby={`report-numbers-${report.id}`}>
    <h3 id={`report-numbers-${report.id}`}>{copy.numbersTitle}</h3>
    <dl className="report-number-strip">
      <div><dt>{copy.spending}</dt><dd>{moneyOrDash(report.actualSpendingRm)}</dd>
        <small>{differenceCents == null ? (previous ? copy.noPriced : copy.noPrevious) : differenceCents === 0 ? copy.sameAsPrevious : copy.vsPrevious(signedRm(differenceCents / 100))}</small></div>
      <div><dt>{copy.tripCount}</dt><dd>{report.tripCount}</dd><small>{previous ? copy.previousTrips(previous.tripCount) : copy.noPrevious}</small></div>
      <div><dt>{copy.savings}</dt><dd>{signedRm(net)}</dd><small>{net == null ? copy.savingsUnavailable : copy.vsTypicalStore}</small></div>
    </dl>
    {topCategories.length > 0 && <ul className="report-category-list" aria-label={copy.categoryTitle}>{topCategories.map(row => <li key={row.categoryId}>
      <span>{broadCategoryName(row.categoryId, locale)}</span><strong>{formatRm(row.amountRm)}{report.actualSpendingRm != null && report.actualSpendingRm > 0 ? <small> · {percent(row.amountRm / report.actualSpendingRm * 100, locale)}</small> : null}</strong>
    </li>)}</ul>}
  </section>;
}

function NewsletterContent({ report, locale }: { report: LocalInboxReport; locale: Locale }) {
  const copy = COPY[locale];
  const newsletter = report.newsletter;
  const notes = [
    ...report.disclosures,
    copy.estimateNote,
    ...(report.generationSource === "llm" ? [copy.aiWritten] : []),
  ];
  return <article className="report-newsletter" aria-labelledby={`newsletter-headline-${report.id}`}>
    <header className="newsletter-header">
      <p className="newsletter-kicker">{report.cadence === "weekly" ? copy.weeklyReport : copy.monthlyReport} · {formatInclusiveDateRange(report.periodStart, report.periodEnd, locale)}</p>
      <h2 id={`newsletter-headline-${report.id}`}>{newsletter.headline}</h2>
    </header>
    {newsletter.insights.length > 0 && <section className="newsletter-insights" aria-label={copy.insights}>
      <ol>{newsletter.insights.map((insight, index) => <li key={`${report.id}-insight-${index}`} className={`insight-card insight-${insight.kind}`}>
        <div className="insight-card-top">
          <h3>{insight.title}</h3>
          {insight.evidence && <p className="insight-evidence"><strong>{insight.evidence.value}</strong><span>{insight.evidence.label}</span></p>}
        </div>
        <p className="insight-body">{insight.body}</p>
        {insight.action && <p className="insight-action"><span aria-hidden="true"><UIIcon name="lightbulb" size={16}/></span><span><strong>{copy.nextTime}</strong> {insight.action}</span></p>}
      </li>)}</ol>
    </section>}
    <ReportNumbers report={report} locale={locale}/>
    <footer className="report-notes"><ul>{notes.map(note => <li key={note}>{note}</li>)}</ul></footer>
  </article>;
}

function ReportDetails({ report, locale }: { report: LocalInboxReport; locale: Locale }) {
  return <div className="report-reader-content"><NewsletterContent report={report} locale={locale}/></div>;
}

function GenerateReportMenu({ locale, periods, disabled, aiEnabled, reportLanguage, onReportLanguage, onGenerate, onOpenSettings }: {
  locale: Locale;
  reportLanguage: Locale;
  onReportLanguage: (language: Locale) => void;
  periods: Map<ReportCadence, ReportPeriod>;
  disabled: boolean;
  aiEnabled: boolean;
  onGenerate: (cadence: ReportCadence) => void;
  onOpenSettings: () => void;
}) {
  const copy = COPY[locale];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    rootRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not([disabled])")?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled]), [role=menuitemradio]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };
  return <div className="report-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className="primary-button report-menu-trigger" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(value => !value)}>
      <UIIcon name="sparkle" size={16}/>{disabled ? copy.generatingShort : copy.newReport}
    </button>
    {open && <div className="report-menu-popover" role="menu" aria-label={copy.generateGroup} onKeyDown={onMenuKeyDown}>
      <div className="report-menu-language" role="group" aria-label={copy.reportLanguage}>
        <span>{copy.reportLanguage}</span>
        <div className="cadence-toggle">
          {(["en", "ms"] as const).map(option => <button key={option} type="button" role="menuitemradio" lang={option} aria-checked={reportLanguage === option} aria-pressed={reportLanguage === option} onClick={() => onReportLanguage(option)}>{option === "en" ? "English" : "Bahasa Melayu"}</button>)}
        </div>
      </div>
      {(["weekly", "monthly"] as const).map(cadence => {
        const period = periods.get(cadence);
        return <button key={cadence} type="button" role="menuitem" disabled={!period} onClick={() => { setOpen(false); onGenerate(cadence); }}>
          <strong>{cadence === "weekly" ? copy.generateWeekly : copy.generateMonthly}</strong>
          <small>{period ? formatInclusiveDateRange(period.periodStart, period.periodEnd, locale) : copy.noTripsForPeriod}</small>
        </button>;
      })}
      <p className="report-menu-note">{copy.generateHint}</p>
      {!aiEnabled && <button type="button" role="menuitem" className="report-menu-settings" onClick={() => { setOpen(false); onOpenSettings(); }}>{copy.aiDisabledAction}</button>}
    </div>}
  </div>;
}

export function ReportScreen({
  state, locale, history, generationStates, consentStatus, onCadence, onRead, onRetry, onGenerate, onOpenSettings, reportLanguage, onReportLanguage,
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
  reportLanguage: Locale;
  onReportLanguage: (language: Locale) => void;
}) {
  const copy = COPY[locale];
  const [tab, setTab] = useState<"inbox" | "statistics">("inbox");
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const inboxHeadingRef = useRef<HTMLHeadingElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
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
      <header className="reports-heading"><div><h1 className="page-title">{copy.report}</h1><p className="page-intro">{tab === "inbox" ? copy.inboxDescription : copy.statisticsDescription}</p></div><div className="reports-heading-actions"><button type="button" className="secondary-button" onClick={onOpenSettings}>{copy.settings}</button></div></header>
      <div role="tablist" aria-label={copy.report} className="report-tabs">
        {(["inbox", "statistics"] as const).map(option => <button key={option} id={`report-tab-${option}`} type="button" role="tab" aria-selected={tab === option} aria-controls={`report-panel-${option}`} tabIndex={tab === option ? 0 : -1} onClick={() => setTab(option)} onKeyDown={event => onTabKeyDown(event, option)}><span aria-hidden="true"><UIIcon name={option === "inbox" ? "document" : "reports"}/></span>{copy[option]}{option === "inbox" && countUnread > 0 ? <span className="report-unread-count" aria-label={`${countUnread} ${copy.unreadCount}`}>{countUnread}</span> : null}</button>)}
      </div>
      {tab === "inbox" ? <section id="report-panel-inbox" role="tabpanel" aria-labelledby="report-tab-inbox" className="report-inbox">
        <div className={`inbox-layout ${selectedMessage ? "has-selection" : ""}`}>
          <aside className="inbox-list-panel" aria-label={copy.inbox}>
            <div className="inbox-list-toolbar">
              <h2 ref={inboxHeadingRef} tabIndex={-1} className="section-title">{copy.inbox}<span className="inbox-count">{state.messages.length}</span></h2>
              <GenerateReportMenu locale={locale} reportLanguage={reportLanguage} onReportLanguage={onReportLanguage} periods={manualPeriods} disabled={generationInProgress} aiEnabled={consentStatus === "accepted"} onGenerate={onGenerate} onOpenSettings={onOpenSettings}/>
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
                    <strong>{message.newsletter.preview}</strong><span className="inbox-message-preview">{message.newsletter.insights.map(insight => insight.title).join(" · ")}</span>
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
      </section> : <StatisticsPanel history={history} cadence={state.cadence} locale={locale} onCadence={onCadence}/>}
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
    <div className="consent-language"><p>{locale === "ms" ? copy.policyMs : copy.policyEn}</p></div>
    {storageError && <p role="alert" className="report-warning">{copy.storageError}</p>}
    <div className="consent-actions">
      {status === "accepted" ? <button type="button" className="secondary-button" onClick={onDisable}>{copy.disable}</button> : <button type="button" className="primary-button" onClick={onAccept}>{copy.enable}</button>}
      {status !== "accepted" && <button type="button" className="secondary-button" onClick={onDecline}>{copy.noThanks}</button>}
    </div>
    {mode === "settings" && <div className="consent-delete"><p>{copy.deleteSaved}</p><button type="button" className="secondary-button danger-button" onClick={onDeleteAll}>{copy.deleteAll}</button></div>}
  </section></div>;
}
