"use client";
// Owners: Shun, Randy

import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { checklistProgress, type ShoppingChecklist } from "@/lib/shopping-checklist";
import type { TripRecord } from "@/lib/trip-history";

const TEXT = {
  en: {
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
    planned: "Planned combined total",
    bought: (count: number, total: number) => `${count} of ${total} bought`,
  },
  ms: {
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
    planned: "Jumlah gabungan yang dirancang",
    bought: (count: number, total: number) => `${count} daripada ${total} dibeli`,
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
}: {
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
    </button>
  );
}
/**
 * Home: start or resume a trip, planned items for this week, and shortcuts to Checklist and
 * Reports.
 */
export function SmartCartHomeScreen({
  plannedThisWeek,
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
  plannedThisWeek?: ReactNode;
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
      <div className={"home-hero" + (plannedThisWeek ? " has-weekly-plan" : "")}><div className="home-hero-copy"><h1>{hasTripInProgress ? (locale === "en" ? "Shopping trip in progress" : text.resumeTrip) : text.title}</h1>
      <p>{hasTripInProgress ? (locale === "en" ? "Continue where you left off, or start a new trip." : text.description) : (locale === "en" ? "Plan your household shopping, compare nearby stores and keep track of your spending." : text.description)}</p></div>{plannedThisWeek && <div className="home-hero-weekly">{plannedThisWeek}</div>}</div>
      <section className="home-trip"><span className="home-trip-icon"><Icon kind="trip"/></span><div><h2>{hasTripInProgress ? text.resumeTrip : text.startTrip}</h2><p>{hasTripInProgress ? text.resumeAt(journeyStepLabel(locale, resumeStep)) : (locale === "en" ? "Choose your location and travel preferences to begin." : text.travelStep)}</p></div>
      <div className="home-trip-actions"><button type="button" className="primary-button" onClick={onStartOrResume}>{hasTripInProgress ? text.resumeTrip : text.startTrip}</button>{hasTripInProgress && <button type="button" className="secondary-button" onClick={onStartNew}>{text.startNew}</button>}</div></section>
      <section className="home-tools" aria-label="SmartCart tools">
        <HomeCard icon="checklist" title={text.checklist} detail={progress ? text.checklistProgress(progress.bought, progress.total) : text.noChecklist} onClick={onChecklist}/>
        <HomeCard icon="history" title={text.history} detail={text.tripsRecorded(history.length)} onClick={onHistory}/>
        <HomeCard icon="inbox" title={locale === "en" ? "Reports" : text.inbox} detail={text.unreadReports(unreadReports)} badge={unreadReports} onClick={onInbox}/>
      </section>
    </div>
  );
}
