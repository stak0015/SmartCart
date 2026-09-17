"use client";

import { formatRm } from "@/lib/format-rm";
import type { InboxState, ReportCadence, SavingsReportMessage } from "@/lib/inbox";
import type { Locale } from "@/lib/i18n";
import { periodComparison, type PeriodComparison, type PeriodSummary } from "@/lib/period-summary";
import { tripTravelSavingsInsight } from "@/lib/savings-insights";
import { checklistProgress, type ShoppingChecklist } from "@/lib/shopping-checklist";
import { listTripRecords, type TripRecord } from "@/lib/trip-history";

const TEXT = {
  en: {
    eyebrow: "Your SmartCart home",
    title: "Ready to shop?",
    description: "Plan a trip or pick up where you left off.",
    startTrip: "Start a shopping trip",
    resumeTrip: "Resume shopping trip",
    resumeAt: (step: string) => `Continue from ${step}`,
    startNew: "Start a new trip",
    travelStep: "travel preferences",
    shopStep: "basket building",
    basketStep: "basket review",
    compareStep: "store comparison",
    checklist: "Checklist",
    noChecklist: "No active checklist",
    checklistProgress: (done: number, total: number) => `${done} of ${total} items bought`,
    history: "Shopping history",
    tripsRecorded: (count: number) => `${count} ${count === 1 ? "trip" : "trips"} recorded`,
    inbox: "Report",
    unreadReports: (count: number) => count === 0 ? "No unread reports" : `${count} unread ${count === 1 ? "report" : "reports"}`,
    open: "Open",
    historyTitle: "Shopping history",
    historyDescription: "Recorded trips stay on this device and are shown newest first.",
    historyEmpty: "No shopping trips recorded yet.",
    historyEmptyHint: "Complete a checklist and record the trip to build your history.",
    spent: "Bought total",
    spendingUnavailable: "No priced bought items",
    planned: "Planned basket + transport",
    bought: (count: number, total: number) => `${count} of ${total} bought`,
    estimatedSaving: "Estimated net saving",
    estimatedAbove: "Above typical cost",
    inboxTitle: "Report",
    inboxDescription: "Your shopping totals and savings estimates.",
    weekly: "Weekly",
    monthly: "Monthly",
    cadenceLabel: "View period",
    inboxEmpty: "No reports yet",
    inboxEmptyHint: "Reports appear after a completed week or month with at least one recorded trip.",
    unread: "Unread",
    read: "Read",
    weekReport: "Weekly SmartCart report",
    monthReport: "Monthly SmartCart report",
    trips: (count: number) => `${count} recorded ${count === 1 ? "trip" : "trips"}`,
    netSavings: "Estimated net savings",
    storeChoice: "Store choice",
    itemChanges: "Item changes",
    unavailable: "Unavailable",
    incompleteSpending: "Some bought items have no price, so this total is partial.",
    incompleteSavings: "Some trips had no like-for-like savings comparison.",
    estimateNote: "Totals may include catalogue prices. Savings remain estimates.",
    markRead: "Open report and mark as read",
    // AC 8.1.1-8.1.4: summary for the period currently in progress. Separate
    // from the archived reports above, which only cover completed periods.
    thisWeek: "This week",
    thisMonth: "This month",
    confirmedSpendingSoFar: "Bought total so far",
    thisPeriodTrips: (count: number) => `${count} ${count === 1 ? "trip" : "trips"} recorded`,
    thisPeriodNoRecords: "No shopping data for this period yet.",
    thisPeriodNoRecordsHint: "Record a trip from your checklist and it will show up here.",
    thisPeriodNoConfirmed: "No priced bought items this period.",
    thisPeriodNoConfirmedHint: "Record bought items with prices to see a total.",
    thisPeriodEstimatesOnly: "Planning estimates are separate from bought items.",
    thisPeriodIncomplete: "Some bought items have no price, so this total is partial.",
    // AC 8.2.1 from a recorded trip. Wording is deliberately narrower than the
    // net-savings figure above it: this compares the RETURN TRAVEL COST ONLY
    // against the CHEAPEST reachable alternative, whereas estimated net savings
    // compares basket plus travel against the MEDIAN of comparable stores. Two
    // different baselines, so neither label may imply it includes the other.
    tripTravelSavings: "Travel-cost saving vs cheapest alternative",
    tripTravelSavingsDetail: (amount: string, cheaperStore: string) =>
      `The return trip to ${cheaperStore} was estimated to cost ${amount} less than this store.`,
    tripTravelCheapestAlready: "This store was already the cheapest reachable option for travel.",
    tripTravelNoAlternative: "No alternative store was recorded for this trip, so no travel saving can be shown.",
    tripTravelNoCost: "No travel cost was recorded for this trip.",
    travelEstimateNote: "Travel cost is estimated and may differ from your actual trip.",
    straightLineTravelNote: "Travel cost is based on a straight-line distance estimate.",
    // AC 8.3.1/8.3.2: week-over-week comparison. Spending is confirmed actual
    // money; savings stay labelled as estimates so the two are never read as
    // equally factual (AC 8.1.2).
    previousWeek: "Last week",
    previousMonth: "Last month",
    compareSpent: "Bought total",
    compareTrips: "Trips recorded",
    compareNetSavings: "Estimated net savings",
    estimateBadge: "Estimate",
    comparisonInProgress: (elapsed: number, total: number) =>
      `This period has ${elapsed} of ${total} days so far; the previous period is complete, so the two totals are not like-for-like.`,
    comparisonUnavailable: "No recorded trips in the previous period, so no comparison is shown.",
    comparisonChange: "Change",
    // The separator was hardcoded English in the US 8.3 card, which leaked into
    // the Malay UI. It is a copy key now.
    comparisonVersus: "vs",
    // AC 8.4.2/8.4.3: the summary is computed on the device at the moment it is
    // opened, and the shopper can hide the section. The privacy line states what
    // the code actually does - no background job, no upload - rather than
    // promising something unenforced.
    hideSummary: "Hide summary",
    showSummary: "Show summary",
    summaryHiddenNote: "Your summary is hidden on this device. Your recorded trips are untouched.",
    summaryPrivacyNote: "This summary is calculated on your device when you open it. Your spending data is never sent anywhere.",
  },
  ms: {
    eyebrow: "Laman utama SmartCart anda",
    title: "Apa yang ingin anda lakukan?",
    description: "Rancang perjalanan, teruskan senarai semak, atau semak perbelanjaan isi rumah.",
    startTrip: "Mulakan perjalanan membeli-belah",
    resumeTrip: "Sambung perjalanan membeli-belah",
    resumeAt: (step: string) => `Teruskan dari ${step}`,
    startNew: "Mulakan perjalanan baharu",
    travelStep: "pilihan perjalanan",
    shopStep: "membina bakul",
    basketStep: "semakan bakul",
    compareStep: "perbandingan kedai",
    checklist: "Senarai semak",
    noChecklist: "Tiada senarai semak aktif",
    checklistProgress: (done: number, total: number) => `${done} daripada ${total} item dibeli`,
    history: "Sejarah membeli-belah",
    tripsRecorded: (count: number) => `${count} perjalanan direkodkan`,
    inbox: "Laporan",
    unreadReports: (count: number) => count === 0 ? "Tiada laporan belum dibaca" : `${count} laporan belum dibaca`,
    open: "Buka",
    historyTitle: "Sejarah membeli-belah",
    historyDescription: "Perjalanan yang direkodkan kekal pada peranti ini dan dipaparkan yang terbaharu dahulu.",
    historyEmpty: "Belum ada perjalanan membeli-belah direkodkan.",
    historyEmptyHint: "Lengkapkan senarai semak dan rekodkan perjalanan untuk membina sejarah anda.",
    spent: "Jumlah dibeli",
    spendingUnavailable: "Tiada item dibeli yang berharga",
    planned: "Bakul + pengangkutan yang dirancang",
    bought: (count: number, total: number) => `${count} daripada ${total} dibeli`,
    estimatedSaving: "Anggaran penjimatan bersih",
    estimatedAbove: "Melebihi kos biasa",
    inboxTitle: "Laporan",
    inboxDescription: "Jumlah membeli-belah dan anggaran penjimatan anda.",
    weekly: "Mingguan",
    monthly: "Bulanan",
    cadenceLabel: "Lihat tempoh",
    inboxEmpty: "Belum ada laporan",
    inboxEmptyHint: "Laporan muncul selepas minggu atau bulan lengkap dengan sekurang-kurangnya satu perjalanan direkodkan.",
    unread: "Belum dibaca",
    read: "Dibaca",
    weekReport: "Laporan mingguan SmartCart",
    monthReport: "Laporan bulanan SmartCart",
    trips: (count: number) => `${count} perjalanan direkodkan`,
    netSavings: "Anggaran penjimatan bersih",
    storeChoice: "Pilihan kedai",
    itemChanges: "Perubahan item",
    unavailable: "Tidak tersedia",
    incompleteSpending: "Sesetengah item dibeli tiada harga, jadi jumlah ini separa.",
    incompleteSavings: "Sesetengah perjalanan tiada perbandingan penjimatan setara.",
    estimateNote: "Jumlah mungkin termasuk harga katalog. Penjimatan kekal anggaran.",
    markRead: "Buka laporan dan tandakan sebagai dibaca",
    // AC 8.1.1-8.1.4: summary for the period currently in progress. Separate
    // from the archived reports above, which only cover completed periods.
    thisWeek: "Minggu ini",
    thisMonth: "Bulan ini",
    confirmedSpendingSoFar: "Jumlah dibeli setakat ini",
    thisPeriodTrips: (count: number) => `${count} perjalanan direkodkan`,
    thisPeriodNoRecords: "Tiada data membeli-belah untuk tempoh ini lagi.",
    thisPeriodNoRecordsHint: "Rekodkan perjalanan daripada senarai semak anda dan ia akan muncul di sini.",
    thisPeriodNoConfirmed: "Tiada item dibeli yang berharga dalam tempoh ini.",
    thisPeriodNoConfirmedHint: "Rekodkan item dibeli bersama harga untuk melihat jumlah.",
    thisPeriodEstimatesOnly: "Anggaran perancangan berasingan daripada item dibeli.",
    thisPeriodIncomplete: "Sesetengah item dibeli tiada harga, jadi jumlah ini separa.",
    // AC 8.2.1 from a recorded trip. Wording is deliberately narrower than the
    // net-savings figure above it: this compares the RETURN TRAVEL COST ONLY
    // against the CHEAPEST reachable alternative, whereas estimated net savings
    // compares basket plus travel against the MEDIAN of comparable stores. Two
    // different baselines, so neither label may imply it includes the other.
    tripTravelSavings: "Penjimatan kos perjalanan vs alternatif termurah",
    tripTravelSavingsDetail: (amount: string, cheaperStore: string) =>
      `Perjalanan balik ke ${cheaperStore} dianggarkan kurang ${amount} daripada kedai ini.`,
    tripTravelCheapestAlready: "Kedai ini sudah pilihan paling murah yang boleh dicapai untuk perjalanan.",
    tripTravelNoAlternative: "Tiada kedai alternatif direkodkan untuk perjalanan ini, jadi tiada penjimatan perjalanan boleh dipaparkan.",
    tripTravelNoCost: "Tiada kos perjalanan direkodkan untuk perjalanan ini.",
    travelEstimateNote: "Kos perjalanan dianggarkan dan mungkin berbeza daripada perjalanan sebenar anda.",
    straightLineTravelNote: "Kos perjalanan berdasarkan anggaran jarak garis lurus.",
    // AC 8.3.1/8.3.2: week-over-week comparison. Spending is confirmed actual
    // money; savings stay labelled as estimates so the two are never read as
    // equally factual (AC 8.1.2).
    previousWeek: "Minggu lepas",
    previousMonth: "Bulan lepas",
    compareSpent: "Jumlah dibeli",
    compareTrips: "Perjalanan direkodkan",
    compareNetSavings: "Anggaran penjimatan bersih",
    estimateBadge: "Anggaran",
    comparisonInProgress: (elapsed: number, total: number) =>
      `Tempoh ini mempunyai ${elapsed} daripada ${total} hari setakat ini; tempoh sebelumnya lengkap, jadi kedua-dua jumlah bukan setara.`,
    comparisonUnavailable: "Tiada perjalanan direkodkan dalam tempoh sebelumnya, jadi tiada perbandingan dipaparkan.",
    comparisonChange: "Perubahan",
    comparisonVersus: "vs",
    hideSummary: "Sembunyikan ringkasan",
    showSummary: "Paparkan ringkasan",
    summaryHiddenNote: "Ringkasan anda disembunyikan pada peranti ini. Perjalanan yang direkodkan tidak diubah.",
    summaryPrivacyNote: "Ringkasan ini dikira pada peranti anda apabila anda membukanya. Data perbelanjaan anda tidak dihantar ke mana-mana.",
  },
} as const;

export type TripJourneyStep = "location" | "shop" | "basket" | "compare";

function Icon({ kind }: { kind: "trip" | "checklist" | "history" | "inbox" }) {
  const paths = {
    trip: <><path d="M5 5h14l-1 13H6L5 5Z" /><path d="M8 5l1-2m7 2-1-2" /></>,
    checklist: <><path d="M8 4h11v16H5V4h3" /><path d="m8 11 2 2 4-5m-6 9h7" /></>,
    history: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    inbox: <><path d="M4 5h16v14H4V5Z" /><path d="m4 14 4-4h8l4 4" /></>,
  }[kind];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6 stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

function journeyStepLabel(locale: Locale, step: TripJourneyStep): string {
  const text = TEXT[locale];
  return {
    location: text.travelStep,
    shop: text.shopStep,
    basket: text.basketStep,
    compare: text.compareStep,
  }[step];
}

function HomeCard({
  icon,
  title,
  detail,
  badge,
  onClick,
}: {
  icon: "checklist" | "history" | "inbox";
  title: string;
  detail: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[150px] flex-col items-start rounded-2xl border border-[#dce5e0] bg-white p-5 text-left shadow-[0_4px_18px_rgba(16,35,29,0.05)] transition hover:-translate-y-0.5 hover:border-[#a9cdbd] focus-visible:-translate-y-0.5"
    >
      <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf7f2] text-[#087f5b]">
        <Icon kind={icon} />
        {badge && badge > 0 ? <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#e8590c] px-1 text-[11px] font-extrabold text-white">{badge}</span> : null}
      </span>
      <span className="mt-4 text-lg font-extrabold text-[#10231d]">{title}</span>
      <span className="mt-1 text-sm leading-5 text-[#617069]">{detail}</span>
    </button>
  );
}

export function SmartCartHomeScreen({
  locale,
  checklist,
  history,
  unreadReports,
  hasTripInProgress,
  resumeStep,
  onStartOrResume,
  onStartNew,
  onChecklist,
  onHistory,
  onInbox,
}: {
  locale: Locale;
  checklist: ShoppingChecklist | null;
  history: TripRecord[];
  unreadReports: number;
  hasTripInProgress: boolean;
  resumeStep: TripJourneyStep;
  onStartOrResume: () => void;
  onStartNew: () => void;
  onChecklist: () => void;
  onHistory: () => void;
  onInbox: () => void;
}) {
  const text = TEXT[locale];
  const progress = checklist ? checklistProgress(checklist) : null;

  return (
    <div className="screen-enter px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-[34px] font-extrabold leading-[40px] tracking-[-0.9px] text-[#10231d] sm:text-[42px] sm:leading-[48px]">{text.title}</h1>
        <p className="mt-2 max-w-[620px] text-sm leading-5 text-[#53635c]">{text.description}</p>

        <section className="mt-7 rounded-3xl bg-[#087f5b] p-5 text-white shadow-[0_12px_32px_rgba(8,127,91,0.22)] sm:p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Icon kind="trip" /></span>
          <h2 className="mt-5 text-2xl font-extrabold">{hasTripInProgress ? text.resumeTrip : text.startTrip}</h2>
          <p className="mt-1 text-sm text-[#d3f0e4]">{hasTripInProgress
            ? text.resumeAt(journeyStepLabel(locale, resumeStep))
            : journeyStepLabel(locale, "location")}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onStartOrResume} className="min-h-12 rounded-xl bg-white px-5 text-sm font-extrabold text-[#087f5b]">
              {hasTripInProgress ? text.resumeTrip : text.startTrip}
            </button>
            {hasTripInProgress ? (
              <button type="button" onClick={onStartNew} className="min-h-12 rounded-xl border border-white/45 px-5 text-sm font-extrabold text-white">
                {text.startNew}
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="SmartCart tools">
          <HomeCard
            icon="checklist"
            title={text.checklist}
            detail={progress ? text.checklistProgress(progress.bought, progress.total) : text.noChecklist}
            onClick={onChecklist}
          />
          <HomeCard icon="history" title={text.history} detail={text.tripsRecorded(history.length)} onClick={onHistory} />
          <HomeCard icon="inbox" title={text.inbox} detail={text.unreadReports(unreadReports)} badge={unreadReports} onClick={onInbox} />
        </section>
      </div>
    </div>
  );
}

function localDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function TripHistoryScreen({ history, locale }: { history: TripRecord[]; locale: Locale }) {
  const text = TEXT[locale];
  const records = listTripRecords(history);

  return (
    <div className="screen-enter px-4 pb-12 pt-8 sm:px-6">
      <h1 className="text-[30px] font-extrabold tracking-[-0.7px] text-[#10231d]">{text.historyTitle}</h1>
      <p className="mt-2 text-sm leading-5 text-[#617069]">{text.historyDescription}</p>
      {records.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#becdc6] bg-white p-7 text-center">
          <p className="font-extrabold text-[#17362c]">{text.historyEmpty}</p>
          <p className="mt-1 text-sm text-[#617069]">{text.historyEmptyHint}</p>
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {records.map(record => {
            const bought = record.lines.filter(line => line.status === "bought").length;
            const saving = record.estimatedSavings?.netSavingRm ?? null;
            // AC 8.2.1 from the frozen record. The route provenance comes from
            // the record itself, so a trip recorded through the straight-line
            // fallback keeps its caveat long after the recommendation response
            // is gone.
            const travel = tripTravelSavingsInsight(record);
            return (
              <li key={record.id} className="rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold text-[#10231d]">{record.store.name}</p>
                    <p className="mt-1 text-xs text-[#617069]">{localDate(record.recordedAt, locale)} · {text.bought(bought, record.lines.length)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#617069]">{text.spent}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-[#17362c]">{record.actualTotalRm == null ? "—" : formatRm(record.actualTotalRm)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 border-t border-[#edf1ef] pt-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] text-[#617069]">{text.planned}</dt>
                    <dd className="mt-0.5 text-sm font-bold text-[#17362c]">{record.plannedCombinedTotalRm == null ? "—" : formatRm(record.plannedCombinedTotalRm)}</dd>
                  </div>
                  {saving != null ? (
                    <div>
                      <dt className="text-[11px] text-[#617069]">{saving >= 0 ? text.estimatedSaving : text.estimatedAbove}</dt>
                      <dd className={`mt-0.5 text-sm font-extrabold ${saving >= 0 ? "text-[#087f5b]" : "text-[#9b3d00]"}`}>{formatRm(Math.abs(saving))}</dd>
                    </div>
                  ) : null}
                </dl>

                {/* AC 8.2.1: travel-cost saving derived from the frozen trip
                    record. Labelled as travel-only against the cheapest
                    alternative, because the net-savings figure above uses a
                    different baseline (median of comparable stores, basket plus
                    travel); showing both without distinct labels would read as
                    double-counting. When unavailable the reason is stated
                    rather than leaving the absence unexplained. */}
                <div className="mt-3 border-t border-[#edf1ef] pt-3">
                  {travel.available && travel.savingsRm != null && travel.cheaperStoreName ? (
                    <>
                      <p className="text-[11px] font-bold text-[#617069]">{text.tripTravelSavings}</p>
                      <p className="mt-0.5 text-sm font-extrabold text-[#087f5b]">{formatRm(travel.savingsRm)}</p>
                      <p className="mt-1 text-[11px] leading-4 text-[#53635c]">
                        {text.tripTravelSavingsDetail(formatRm(travel.savingsRm), travel.cheaperStoreName)}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-[#617069]">
                        {travel.routeEstimated ? text.straightLineTravelNote : text.travelEstimateNote}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] leading-4 text-[#617069]">
                      {travel.reason === "my-store-is-cheapest"
                        ? text.tripTravelCheapestAlready
                        : travel.reason === "no-recorded-travel-cost"
                          ? text.tripTravelNoCost
                          : text.tripTravelNoAlternative}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function reportPeriod(message: SavingsReportMessage, locale: Locale): string {
  const inclusiveEnd = new Date(Date.parse(message.periodEnd) - 1);
  return `${localDate(message.periodStart, locale)} – ${localDate(inclusiveEnd.toISOString(), locale)}`;
}

function signedReportAmount(value: number | null): string {
  if (value == null) return "—";
  if (value === 0) return formatRm(0);
  return `${value > 0 ? "+" : "−"}${formatRm(Math.abs(value))}`;
}

/**
 * AC 8.1.1-8.1.4: the spending summary for the period in progress.
 *
 * Three mutually exclusive branches, and the amount is rendered in the first
 * one only. The branch condition tests confirmedSpendingRm for null (rather
 * than the equivalent hasConfirmedSpending flag) so TypeScript narrows the
 * value to number and no cast is needed:
 *  - confirmed total present -> this week's confirmed spending (AC 8.1.1)
 *  - records but no confirmed total -> "not enough spending data", no amount
 *    (AC 8.1.4); when those records carry estimates, say plainly that
 *    estimates are not confirmed spending (AC 8.1.2)
 *  - no records at all -> "no shopping data", no amount (AC 8.1.3)
 *
 * PeriodSummary deliberately carries no estimate amount, so this component
 * cannot render one even by mistake.
 */
function WeeklySpendingSummary({ summary, locale }: { summary: PeriodSummary; locale: Locale }) {
  const text = TEXT[locale];
  const title = summary.cadence === "weekly" ? text.thisWeek : text.thisMonth;

  return (
    <section
      aria-labelledby="current-period-spending"
      className="rounded-2xl border border-[#8fc7ae] bg-[#f0faf5] p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5"
    >
      <h2 id="current-period-spending" className="text-lg font-extrabold text-[#10231d]">{title}</h2>

      {summary.confirmedSpendingRm != null ? (
        <>
          <p className="mt-1 text-[11px] text-[#617069]">{text.confirmedSpendingSoFar}</p>
          <p className="mt-1 text-[28px] font-extrabold leading-9 text-[#087f5b]">
            {formatRm(summary.confirmedSpendingRm)}
          </p>
          <p className="mt-1 text-xs text-[#617069]">{text.thisPeriodTrips(summary.tripCount)}</p>
          {summary.spendingIncomplete ? (
            <p className="mt-2 text-[11px] leading-4 text-[#617069]">{text.thisPeriodIncomplete}</p>
          ) : null}
        </>
      ) : summary.hasRecords ? (
        <div className="mt-2">
          <p className="font-extrabold text-[#17362c]">{text.thisPeriodNoConfirmed}</p>
          <p className="mt-1 text-sm leading-5 text-[#617069]">{text.thisPeriodNoConfirmedHint}</p>
          <p className="mt-1 text-xs text-[#617069]">{text.thisPeriodTrips(summary.tripCount)}</p>
          {summary.hasEstimatedOnly ? (
            <p className="mt-2 text-[11px] leading-4 text-[#9b3d00]">{text.thisPeriodEstimatesOnly}</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2">
          <p className="font-extrabold text-[#17362c]">{text.thisPeriodNoRecords}</p>
          <p className="mt-1 text-sm leading-5 text-[#617069]">{text.thisPeriodNoRecordsHint}</p>
        </div>
      )}
    </section>
  );
}

/**
 * AC 8.3.1/8.3.2: the current period against the previous one of the same
 * cadence.
 *
 * Direction semantics differ per row on purpose: spending LESS is good while
 * saving MORE is good, so a single "green means up" rule would show a good
 * week as bad (or vice versa). Each row picks its own good/bad direction.
 *
 * Savings rows carry an ESTIMATE badge because they are modelled figures,
 * never to be read with the same weight as confirmed spending (AC 8.1.2).
 */
function PeriodComparisonCard({
  comparison,
  locale,
}: {
  comparison: PeriodComparison;
  locale: Locale;
}) {
  const text = TEXT[locale];
  const { current, previous } = comparison;
  const currentLabel = comparison.cadence === "weekly" ? text.thisWeek : text.thisMonth;
  const previousLabel = comparison.cadence === "weekly" ? text.previousWeek : text.previousMonth;

  // Nothing on either side: the AC 8.1.3 empty state above already explains it.
  if (!current.hasRecords && previous == null) return null;

  const delta = (a: number | null, b: number | null): number | null =>
    a == null || b == null ? null : a - b;

  const deltaCell = (value: number | null, lowerIsGood: boolean) => {
    if (value == null) return <span className="text-[11px] text-[#617069]">—</span>;
    const good = lowerIsGood ? value <= 0 : value >= 0;
    const tone = value === 0 ? "text-[#617069]" : good ? "text-[#087f5b]" : "text-[#9b3d00]";
    return (
      <span className={`text-sm font-extrabold ${tone}`}>
        {value > 0 ? "+" : value < 0 ? "−" : ""}{value === 0 ? formatRm(0) : formatRm(Math.abs(value))}
      </span>
    );
  };

  const moneyCell = (value: number | null) =>
    value == null
      ? <span className="text-[11px] text-[#617069]">{text.unavailable}</span>
      : <span className="text-sm font-extrabold text-[#17362c]">{formatRm(value)}</span>;

  return (
    <section
      aria-label={currentLabel}
      className="mt-5 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5"
    >
      <h2 className="text-lg font-extrabold leading-6 text-[#10231d]">
        {currentLabel} {text.comparisonVersus} {previousLabel}
      </h2>

      {previous == null ? (
        <p className="mt-2 text-sm leading-5 text-[#53635c]">{text.comparisonUnavailable}</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#edf1ef]">
              <th className="py-2 pr-2 text-[11px] font-bold text-[#617069]"></th>
              <th className="py-2 pr-2 text-[11px] font-bold text-[#617069]">{currentLabel}</th>
              <th className="py-2 pr-2 text-[11px] font-bold text-[#617069]">{previousLabel}</th>
              <th className="py-2 text-[11px] font-bold text-[#617069]">{text.comparisonChange}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#f1f4f2]">
              <td className="py-2 pr-2 text-[13px] font-bold text-[#17362c]">{text.compareSpent}</td>
              <td className="py-2 pr-2">{moneyCell(current.confirmedSpendingRm)}</td>
              <td className="py-2 pr-2">{moneyCell(previous.confirmedSpendingRm)}</td>
              <td className="py-2">{deltaCell(delta(current.confirmedSpendingRm, previous.confirmedSpendingRm), true)}</td>
            </tr>
            <tr className="border-b border-[#f1f4f2]">
              <td className="py-2 pr-2 text-[13px] font-bold text-[#17362c]">{text.compareTrips}</td>
              <td className="py-2 pr-2 text-sm font-extrabold text-[#17362c]">{current.tripCount}</td>
              <td className="py-2 pr-2 text-sm font-extrabold text-[#17362c]">{previous.tripCount}</td>
              <td className="py-2">{deltaCell(current.tripCount - previous.tripCount, false)}</td>
            </tr>
            <tr>
              <td className="py-2 pr-2 text-[13px] font-bold text-[#17362c]">
                <span className="inline-flex items-center gap-1">
                  {text.compareNetSavings}
                  <span className="rounded-sm bg-[#dceef2] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#00535b]">
                    {text.estimateBadge}
                  </span>
                </span>
              </td>
              <td className="py-2 pr-2">
                {current.savingsAvailable
                  ? <span className="text-sm font-extrabold text-[#17362c]">{current.estimatedNetSavingsRm == null ? "—" : formatRm(current.estimatedNetSavingsRm)}</span>
                  : <span className="text-[11px] text-[#617069]">{text.unavailable}</span>}
              </td>
              <td className="py-2 pr-2">
                {previous.savingsAvailable
                  ? <span className="text-sm font-extrabold text-[#17362c]">{previous.estimatedNetSavingsRm == null ? "—" : formatRm(previous.estimatedNetSavingsRm)}</span>
                  : <span className="text-[11px] text-[#617069]">{text.unavailable}</span>}
              </td>
              <td className="py-2">
                {current.savingsAvailable && previous.savingsAvailable
                  ? deltaCell(delta(current.estimatedNetSavingsRm, previous.estimatedNetSavingsRm), false)
                  : <span className="text-[11px] text-[#617069]">—</span>}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {comparison.inProgress ? (
        <p className="mt-3 text-[11px] leading-4 text-[#617069]">
          {text.comparisonInProgress(comparison.daysElapsed, comparison.daysInPeriod)}
        </p>
      ) : null}
    </section>
  );
}

export function InboxScreen({
  state,
  locale,
  onCadence,
  onRead,
  onToggleSummary,
  history,
}: {
  state: InboxState;
  locale: Locale;
  onCadence: (cadence: ReportCadence) => void;
  onRead: (id: string) => void;
  onToggleSummary: () => void;
  history: TripRecord[];
}) {
  const text = TEXT[locale];
  // AC 8.1.1 / AC 8.3.1: the in-progress period summary and the period-over-
  // period comparison both follow the same cadence switch as the archived
  // reports below, so "this week" and the weekly reports never disagree about
  // where a period starts.
  //
  // AC 8.4.2: this runs in the render body, so the maths happens at the moment
  // the screen is opened - nothing is precomputed and no background job exists.
  // AC 8.4.3: when the shopper hides the section it is not called at all, so a
  // hidden summary is not even computed.
  const comparison = state.summaryHidden ? null : periodComparison(history, state.cadence);
  const currentPeriod = comparison?.current ?? null;
  return (
    <div className="screen-enter px-4 pb-12 pt-8 sm:px-6">
      <h1 className="text-[30px] font-extrabold tracking-[-0.7px] text-[#10231d]">{text.inboxTitle}</h1>
      <p className="mt-2 text-sm leading-5 text-[#617069]">{text.inboxDescription}</p>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold text-[#53635c]">{text.cadenceLabel}</legend>
        <div className="mt-2 inline-flex rounded-xl border border-[#cbd8d1] bg-white p-1">
          {(["weekly", "monthly"] as const).map(cadence => (
            <button
              key={cadence}
              type="button"
              aria-pressed={state.cadence === cadence}
              onClick={() => onCadence(cadence)}
              className={`min-h-10 rounded-lg px-4 text-sm font-extrabold ${state.cadence === cadence ? "bg-[#087f5b] text-white" : "text-[#087f5b]"}`}
            >
              {cadence === "weekly" ? text.weekly : text.monthly}
            </button>
          ))}
        </div>
      </fieldset>

      {/* AC 8.4.3: a local, reversible control over the whole summary section */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-pressed={state.summaryHidden}
          aria-expanded={!state.summaryHidden}
          onClick={onToggleSummary}
          className="min-h-11 rounded-xl border border-[#cbd8d1] bg-white px-4 text-sm font-bold text-[#087f5b]"
        >
          {state.summaryHidden ? text.showSummary : text.hideSummary}
        </button>
        <p className="text-xs leading-5 text-[#617069]">{text.summaryPrivacyNote}</p>
      </div>

      {comparison && currentPeriod ? (
        <>
          <div className="mt-5">
            <WeeklySpendingSummary summary={currentPeriod} locale={locale} />
          </div>

          <PeriodComparisonCard comparison={comparison} locale={locale} />
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[#becdc6] bg-white p-5 text-center">
          <p className="text-sm font-bold text-[#17362c]">{text.summaryHiddenNote}</p>
        </div>
      )}

      {state.messages.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#becdc6] bg-white p-7 text-center">
          <p className="font-extrabold text-[#17362c]">{text.inboxEmpty}</p>
          <p className="mt-1 text-sm text-[#617069]">{text.inboxEmptyHint}</p>
        </div>
      ) : (
        <ol className="mt-6 space-y-3">
          {state.messages.map(message => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => onRead(message.id)}
                aria-label={text.markRead}
                className={`w-full rounded-2xl border p-4 text-left shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5 ${message.read ? "border-[#dce5e0] bg-white" : "border-[#8fc7ae] bg-[#f0faf5]"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${message.read ? "bg-[#edf1ef] text-[#617069]" : "bg-[#087f5b] text-white"}`}>{message.read ? text.read : text.unread}</span>
                    <h2 className="mt-2 text-lg font-extrabold text-[#10231d]">{message.cadence === "weekly" ? text.weekReport : text.monthReport}</h2>
                    <p className="mt-1 text-xs text-[#617069]">{reportPeriod(message, locale)} · {text.trips(message.tripCount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#617069]">{text.spent}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-[#17362c]">{message.actualSpendingRm == null ? text.unavailable : formatRm(message.actualSpendingRm)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[#dce8e1] pt-3">
                  <div><dt className="text-[10px] text-[#617069]">{text.netSavings}</dt><dd className={`mt-1 text-sm font-extrabold ${(message.estimatedNetSavingsRm ?? 0) >= 0 ? "text-[#087f5b]" : "text-[#9b3d00]"}`}>{signedReportAmount(message.estimatedNetSavingsRm)}</dd></div>
                  <div><dt className="text-[10px] text-[#617069]">{text.storeChoice}</dt><dd className={`mt-1 text-sm font-bold ${(message.storeChoiceImpactRm ?? 0) >= 0 ? "text-[#17362c]" : "text-[#9b3d00]"}`}>{signedReportAmount(message.storeChoiceImpactRm)}</dd></div>
                  <div><dt className="text-[10px] text-[#617069]">{text.itemChanges}</dt><dd className={`mt-1 text-sm font-bold ${(message.itemChangeImpactRm ?? 0) >= 0 ? "text-[#17362c]" : "text-[#9b3d00]"}`}>{signedReportAmount(message.itemChangeImpactRm)}</dd></div>
                </dl>
                <div className="mt-3 space-y-1 text-[11px] leading-4 text-[#617069]">
                  {message.spendingIncomplete ? <p>{text.incompleteSpending}</p> : null}
                  {message.savingsIncomplete ? <p>{text.incompleteSavings}</p> : null}
                  <p>{text.estimateNote}</p>
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
