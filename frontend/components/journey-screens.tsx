"use client";

import { formatRm } from "@/lib/format-rm";
import type { Locale } from "@/lib/i18n";
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
  },
} as const;

export type TripJourneyStep = "location" | "shop" | "basket" | "compare";

export function HomeToolIcon({ kind }: { kind: "checklist" | "inbox" }) {
  const paths = {
    checklist: <><path d="M8 4h11v16H5V4h3" /><path d="m8 11 2 2 4-5m-6 9h7" /></>,
    inbox: <><path d="M5 20v-6m7 6V9m7 11V3" strokeWidth="4" /></>,
  }[kind];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6 stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
}

function Icon({ kind }: { kind: "trip" | "checklist" | "history" | "inbox" }) {
  if (kind === "checklist" || kind === "inbox") return <HomeToolIcon kind={kind}/>;
  const paths = {
    trip: <><path d="m3 9 6-3 6 3 6-3v14l-6 3-6-3-6 3V9Z"/><path d="M9 6v14m6-11v14"/><path d="M16 6c0 3-4 7-4 7S8 9 8 6a4 4 0 1 1 8 0Z" fill="currentColor" stroke="white"/><circle cx="12" cy="6" r="1" fill="white" stroke="white"/></>,
    history: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
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
  actionLabel,
}: {
  actionLabel: string;
  icon: "checklist" | "history" | "inbox";
  title: string;
  detail: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={"home-card home-card-" + icon}>
      <span className="home-card-icon"><Icon kind={icon}/></span>
      {badge && badge > 0 ? <span className="unread-badge">{badge}</span> : null}
      <strong>{title}</strong><span className="home-card-detail">{detail}</span>
      <span className="home-card-action">{actionLabel} <span aria-hidden="true">→</span></span>
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
    <div className="screen-enter home-screen">
      <div className="home-hero"><h1>{hasTripInProgress ? (locale === "en" ? "Shopping trip in progress" : text.resumeTrip) : text.title}</h1>
      <p>{hasTripInProgress ? (locale === "en" ? "Continue where you left off, or start a new trip." : text.description) : (locale === "en" ? "Plan your household shopping, compare nearby stores and keep track of your spending." : text.description)}</p></div>
      <section className="home-trip"><span className="home-trip-icon"><Icon kind="trip"/></span><div><h2>{hasTripInProgress ? text.resumeTrip : text.startTrip}</h2><p>{hasTripInProgress ? text.resumeAt(journeyStepLabel(locale, resumeStep)) : (locale === "en" ? "Choose your location and travel preferences to begin." : text.travelStep)}</p></div>
      <div className="home-trip-actions"><button type="button" className="primary-button" onClick={onStartOrResume}>{hasTripInProgress ? text.resumeTrip : text.startTrip} <span aria-hidden="true">→</span></button>{hasTripInProgress && <button type="button" className="secondary-button" onClick={onStartNew}>{text.startNew}</button>}</div></section>
      <section className="home-tools" aria-label="SmartCart tools">
        <HomeCard actionLabel={locale === "en" ? "View checklist" : "Lihat senarai"} icon="checklist" title={text.checklist} detail={progress ? text.checklistProgress(progress.bought, progress.total) : text.noChecklist} onClick={onChecklist}/>
        <HomeCard actionLabel={locale === "en" ? "View history" : "Lihat sejarah"} icon="history" title={text.history} detail={text.tripsRecorded(history.length)} onClick={onHistory}/>
        <HomeCard actionLabel={locale === "en" ? "View reports" : "Lihat laporan"} icon="inbox" title={locale === "en" ? "Reports" : text.inbox} detail={text.unreadReports(unreadReports)} badge={unreadReports} onClick={onInbox}/>
      </section>
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
    <div className="screen-enter px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
      <h1 className="text-[30px] font-extrabold tracking-[-0.7px] text-[#10152e]">{text.historyTitle}</h1>
      <p className="mt-2 text-sm leading-5 text-[#526078]">{text.historyDescription}</p>
      {records.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#becdc6] bg-white p-7 text-center">
          <p className="font-extrabold text-[#10152e]">{text.historyEmpty}</p>
          <p className="mt-1 text-sm text-[#526078]">{text.historyEmptyHint}</p>
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
                    <p className="text-lg font-extrabold text-[#10152e]">{record.store.name}</p>
                    <p className="mt-1 text-xs text-[#526078]">{localDate(record.recordedAt, locale)} · {text.bought(bought, record.lines.length)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#526078]">{text.spent}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-[#10152e]">{record.actualTotalRm == null ? "—" : formatRm(record.actualTotalRm)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 border-t border-[#edf1ef] pt-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] text-[#526078]">{text.planned}</dt>
                    <dd className="mt-0.5 text-sm font-bold text-[#10152e]">{record.plannedCombinedTotalRm == null ? "—" : formatRm(record.plannedCombinedTotalRm)}</dd>
                  </div>
                  {saving != null ? (
                    <div>
                      <dt className="text-[11px] text-[#526078]">{saving >= 0 ? text.estimatedSaving : text.estimatedAbove}</dt>
                      <dd className={`mt-0.5 text-sm font-extrabold ${saving >= 0 ? "text-[#007d38]" : "text-[#9b3d00]"}`}>{formatRm(Math.abs(saving))}</dd>
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
                      <p className="text-[11px] font-bold text-[#526078]">{text.tripTravelSavings}</p>
                      <p className="mt-0.5 text-sm font-extrabold text-[#007d38]">{formatRm(travel.savingsRm)}</p>
                      <p className="mt-1 text-[11px] leading-4 text-[#526078]">
                        {text.tripTravelSavingsDetail(formatRm(travel.savingsRm), travel.cheaperStoreName)}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-[#526078]">
                        {travel.routeEstimated ? text.straightLineTravelNote : text.travelEstimateNote}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] leading-4 text-[#526078]">
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
