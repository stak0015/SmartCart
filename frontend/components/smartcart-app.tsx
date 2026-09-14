"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { listCategories, searchItems, type Item } from "@/lib/api";
import { DEFAULT_QTY, MAX_QTY, basketDetails, basketSummary, parseQty, resultRowFields, stepQty, upsertBasketLine } from "@/lib/result-row";
import { COPY, categoryLabel, type AppCopy, type Locale } from "@/lib/i18n";
import {
  SmartCartApiError,
  getRecommendations,
  prepareRecommendationCandidates,
  deleteRecommendationCandidates,
  getBasketAlternatives,
  resolveLocation,
  reverseLocation,
  searchLocations,
} from "@/lib/api-client";
import type {
  BasketItemPrice,
  LocationSuggestion,
  RecommendationResponse,
  SaraFilter,
  SelectedLocation,
  StoreRecommendation,
  BasketAlternativeLine,
  CandidatePreparationResponse,
  TravelPreferencesRequest,
  TransportMode,
  TravelLimitType,
} from "@/lib/contracts";
import { toAlternativeLineRequests, toBasketLineRequests } from "@/lib/basket-lines";
import {
  applyBasketReplacement,
  currentReplacementImpactRm,
  lowerCostReplacementChoice,
  packReplacementChoice,
  undoBasketReplacement,
  type BasketItem,
} from "@/lib/basket-state";
import { basketSavingsSummary } from "@/lib/savings-summary";
import {
  buildRecommendationDetailRows,
  recommendationDetailTotals,
  targetAlreadyInBasket,
  type RecommendationDetailRow,
} from "@/lib/recommendation-detail";
import { SuccessToast } from "@/components/success-toast";
import { ConfirmationDialog, ShoppingChecklistScreen } from "@/components/shopping-checklist";
import { mapsRouteUrl } from "@/lib/travel";
import { formatRm } from "@/lib/format-rm";
import { calculateEstimatedSavingsSnapshot } from "@/lib/estimated-savings";
import { uppercaseItemName } from "@/lib/item-name";
import { localizedPackageSize } from "@/lib/package-size";
import { VISIBLE_STEP, hasMoreStores, nextVisibleCount } from "@/lib/visible-stores";
import {
  SHOPPING_CHECKLIST_STORAGE_KEY,
  addManualChecklistItem,
  createShoppingChecklist,
  deleteChecklistItem,
  editChecklistItem as editChecklistItemModel,
  parseShoppingChecklist,
  serializeShoppingChecklist,
  setChecklistItemActualPrice,
  setChecklistItemActualQuantity,
  toggleChecklistItemStatus,
  type ChecklistStatus,
  type ManualChecklistItemInput,
  type ShoppingChecklist,
} from "@/lib/shopping-checklist";
import {
  TRIP_HISTORY_STORAGE_KEY,
  addTripRecord,
  buildTripRecord,
  parseTripHistory,
  serializeTripHistory,
  listTripRecords,
  type TripRecord,
} from "@/lib/trip-history";
import { checklistProgress } from "@/lib/shopping-checklist";
import { INBOX_STORAGE_KEY, parseInbox, serializeInbox, setInboxMessageRead, unreadInboxCount, type InboxMessage } from "@/lib/inbox";
import type { EstimatedSavingsSnapshot } from "@/lib/estimated-savings";
import svgPathsBasket from "@/components/icons/basket";
import svgPathsLocation from "@/components/icons/location";
import svgPathsCompare from "@/components/icons/compare";
import svgPathsSaved from "@/components/icons/saved";

// ── Types ───────────────────────────────────────────────────────────────────
type Screen = "home" | "shop" | "basket" | "location" | "compare" | "checklist" | "history" | "inbox";
const DEFAULT_PREFERENCES: TravelPreferences = {
  origin: null,
  transportMode: "motorcycle",
  limitType: "distance",
  limitValue: 5,
  distanceKm: 5,
  timeMinutes: 20,
  saraFilter: "any",
};

function routeScreen(pathname: string): Screen {
  if (pathname === "/trip/travel") return "location";
  if (pathname === "/trip/shop") return "shop";
  if (pathname === "/trip/review") return "basket";
  if (pathname === "/trip/results" || pathname.startsWith("/trip/results/")) return "compare";
  if (pathname === "/checklist") return "checklist";
  if (pathname === "/history") return "history";
  if (pathname === "/inbox") return "inbox";
  return "home";
}

interface TravelPreferences {
  origin: SelectedLocation | null;
  transportMode: TransportMode;
  limitType: TravelLimitType;
  limitValue: number;
  distanceKm: number;
  timeMinutes: number;
  saraFilter: SaraFilter;
}

function localizedName(copy: AppCopy, name: string | null | undefined, translations?: { itemNameEn?: string | null; itemNameMs?: string | null }): string {
  const locale = copy === COPY.ms ? "ms" : "en";
  const localized = (locale === "ms" ? translations?.itemNameMs : translations?.itemNameEn) || name || "Catalogue item";
  return uppercaseItemName(localized);
}

function packageSizeForCopy(copy: AppCopy, value: string | null | undefined): string | null {
  return localizedPackageSize(value, copy === COPY.ms ? "ms" : "en");
}

function getLocalizedCostAssumption(copy: AppCopy, mode: TransportMode, serverAssumption?: string): string {
  const rate = serverAssumption?.match(/RM\d+(?:\.\d+)?\/km/)?.[0];
  if ((mode === "motorcycle" || mode === "car") && rate) return copy.planningEstimate(rate);
  return copy.costAssumptions[mode];
}

const INIT_BASKET: BasketItem[] = [];

// ── Shared SVG icons (from imports) ─────────────────────────────────────────
function IcoBasket({ color = "#3E494A", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 19 / 21.976} viewBox="0 0 21.9758 19" fill="none">
      <path d={svgPathsSaved.p345cae00} fill={color} />
    </svg>
  );
}
function IcoSearch({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <path d={svgPathsBasket.p8a35e00} fill={color} />
    </svg>
  );
}
function IcoLocation({ color = "#00535B" }: { color?: string }) {
  return (
    <svg width={16} height={20} viewBox="0 0 16 20" fill="none">
      <path d={svgPathsLocation.p1869180} fill={color} />
    </svg>
  );
}
function IcoTrash({ color = "#BA1A1A" }: { color?: string }) {
  return (
    <svg width={13.333} height={15} viewBox="0 0 13.3333 15" fill="none">
      <path d={svgPathsBasket.pd83d200} fill={color} />
    </svg>
  );
}
function IcoArrowRight({ color = "white" }: { color?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d={svgPathsBasket.p1a406200} fill={color} />
    </svg>
  );
}
function IcoArrowBack({ color = "#00535B" }: { color?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d={svgPathsLocation.p300a1100} fill={color} />
    </svg>
  );
}
function IcoStore({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={18} height={16} viewBox="0 0 18 16" fill="none">
      <path d={svgPathsCompare.p2a93db80} fill={color} />
    </svg>
  );
}
function IcoWarn({ color = "#93000A" }: { color?: string }) {
  return (
    <svg width={12.833} height={11.083} viewBox="0 0 12.8333 11.0833" fill="none">
      <path d={svgPathsCompare.p2e0ed180} fill={color} />
    </svg>
  );
}
function IcoWalkFigma({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={17.333} height={28.667} viewBox="0 0 17.3333 28.6667" fill="none">
      <path d={svgPathsLocation.p15f7f100} fill={color} />
    </svg>
  );
}
function IcoBusFigma({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={21.333} height={25.333} viewBox="0 0 21.3333 25.3333" fill="none">
      <path d={svgPathsLocation.p11d2e580} fill={color} />
    </svg>
  );
}
function IcoMotoFigma({ color = "white" }: { color?: string }) {
  return (
    <svg width={32} height={18.667} viewBox="0 0 32 18.6667" fill="none">
      <path d={svgPathsLocation.p2da71d00} fill={color} />
    </svg>
  );
}
function IcoCarFigma({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={24} height={21.333} viewBox="0 0 24 21.3333" fill="none">
      <path d={svgPathsLocation.p282dfe00} fill={color} />
    </svg>
  );
}
function IcoCheckbox({ color = "white" }: { color?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <path d={svgPathsLocation.pc296280} fill={color} />
    </svg>
  );
}
function IcoChecklist({ color = "#087f5b" }: { color?: string }) {
  return (
    <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke={color} strokeWidth="1.8" />
      <path d="m8 9 1.4 1.4L12 7.8M8 15l1.4 1.4L12 13.8M14.5 9h2M14.5 15h2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
// ── Transport mode icon (iteration1 feedback: transit includes walking) ────
function TransportModeIcon({ mode, color = "#3E494A" }: { mode: TransportMode; color?: string }) {
  if (mode === "public_transport") {
    return (
      <span className="flex h-5 items-center gap-1 [&_svg]:h-5 [&_svg]:w-auto">
        <IcoWalkFigma color={color} />
        <IcoBusFigma color={color} />
      </span>
    );
  }
  return (
    <span className="flex h-5 items-center [&_svg]:h-5 [&_svg]:w-auto">
      {mode === "walk" ? (
        <IcoWalkFigma color={color} />
      ) : mode === "motorcycle" ? (
        <IcoMotoFigma color={color} />
      ) : (
        <IcoCarFigma color={color} />
      )}
    </span>
  );
}
// ── Header ─────────────────────────────────────────────────────────────────
function SaraEligibilityFlag({
  status,
  categoryCandidate,
  copy,
}: {
  status: boolean | null;
  categoryCandidate: boolean;
  copy: AppCopy;
}) {
  const styles = status === true
    ? "bg-[#e5f5ed] text-[#166534]"
    : status === false
      ? "bg-[#f3f4f5] text-[#4b5563]"
      : categoryCandidate
        ? "bg-[#e7f3ef] text-[#17634f]"
        : "bg-[#fff4ce] text-[#755b00]";
  const label = status === true
    ? copy.saraEligible
    : status === false
      ? copy.saraNotEligible
      : categoryCandidate
        ? copy.saraCategoryCandidate
        : copy.saraEligibilityUnknown;

  return <span className={`inline-flex max-w-full self-start whitespace-normal break-words rounded-md px-2 py-1 text-xs font-semibold leading-5 ${styles}`}>{label}</span>;
}

function SaraStoreTag({ status, copy }: { status: StoreRecommendation["saraStatus"]; copy: AppCopy }) {
  if (status === "verified") {
    return <span className="inline-flex self-start rounded-md bg-[#e5f5ed] px-2 py-1 text-xs font-semibold text-[#166534]">{copy.verifiedSara}</span>;
  }
  if (status === "candidate") {
    return <span className="inline-flex self-start rounded-md bg-[#fff4ce] px-2 py-1 text-xs font-semibold text-[#755b00]">{copy.candidateSara}</span>;
  }
  return <span className="inline-flex self-start rounded-md bg-[#f3f4f5] px-2 py-1 text-xs font-medium text-[#5f6368]">{copy.unverifiedSara}</span>;
}

function medianPriceCount(prices: BasketItemPrice[], reportedCount?: number): number {
  return reportedCount ?? prices.filter(price => price.priceSource === "median" && price.lineTotalRm != null).length;
}

function TripDetails({
  store,
  copy,
  basketSubtotal,
  basketLineCount,
  medianPriceCount: reportedMedianPriceCount = 0,
  incomplete = false,
  showBasketSubtotal = true,
  transportMode,
  routeUrl,
}: {
  store: StoreRecommendation;
  copy: AppCopy;
  basketSubtotal?: number | null;
  basketLineCount?: number | null;
  medianPriceCount?: number;
  incomplete?: boolean;
  showBasketSubtotal?: boolean;
  transportMode?: TransportMode;
  routeUrl?: string;
}) {
  const hasBasket = showBasketSubtotal && (basketLineCount ?? 0) > 0;
  const hasMedianPrices = reportedMedianPriceCount > 0;
  const reportedStorePriceCount = store.storePriceCount ?? Math.max(0, (store.pricedCount ?? 0) - reportedMedianPriceCount);

  return (
    <>
      {(transportMode || routeUrl) && (
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-[#617069]">
          {transportMode && (
            <div className="flex items-center gap-1.5">
              <span>{copy.transportMode}:</span>
              <TransportModeIcon mode={transportMode} />
            </div>
          )}
          {routeUrl && <a href={routeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 font-bold text-[#087f5b] underline underline-offset-2">{copy.viewRoute}</a>}
        </div>
      )}
      <div className={"grid grid-cols-2 gap-2 " + (hasBasket ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      <div className="rounded-xl bg-[#f7f8f6] p-3">
        <p className="text-xs text-[#617069]">{copy.oneWay}</p>
        <p className="mt-1 text-lg font-extrabold text-[#17362c]">{store.estimatedTravelMinutes} {copy.minutes}</p>
      </div>
      <div className="rounded-xl bg-[#f7f8f6] p-3">
        <p className="text-xs text-[#617069]">{copy.route}</p>
        <p className="mt-1 text-lg font-extrabold text-[#17362c]">{store.routeDistanceKm.toFixed(1)} km</p>
      </div>
      <div className="rounded-xl bg-[#f3faf7] p-3">
        <p className="text-xs text-[#617069]">{copy.returnTravel}</p>
        <p className="mt-1 text-lg font-extrabold text-[#087f5b]">{formatRm(store.estimatedRoundTripCostRm)}</p>
      </div>
      {hasBasket && (
        <div className={"rounded-xl p-3 " + (incomplete ? "bg-[#f3f4f5]" : "bg-[#e7f7f0]")}>
          <p className={"text-xs " + (incomplete ? "text-[#5f6368]" : "text-[#286d67]")}>
            {incomplete
              ? (hasMedianPrices ? copy.estimatedPartialTotal : copy.partialTotal)
              : (hasMedianPrices ? copy.estimatedSubtotal : copy.basketSubtotal)}
          </p>
          <p className={"mt-1 text-lg font-extrabold " + (incomplete ? "text-[#3f4944]" : "text-[#175f4b]")}>
            {basketSubtotal == null ? "—" : formatRm(basketSubtotal)}
          </p>
          {(store.pricedCount != null || store.storePriceCount != null) && basketLineCount != null && (
            <p className={"mt-1 text-[11px] font-medium " + (incomplete ? "text-[#5f6368]" : "text-[#286d67]")}>
              {copy.priceCoverage(reportedStorePriceCount, basketLineCount)}
            </p>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function CompactBasketPriceList({ prices, copy }: { prices: BasketItemPrice[]; copy: AppCopy }) {
  return (
    <ul className="flex flex-col gap-2 rounded-xl bg-[#f7f8f6] p-3">
      {prices.map(price => (
        <li key={price.itemId} className="flex items-start justify-between gap-3 border-b border-[#e2e9e5] pb-2 last:border-b-0 last:pb-0">
          <div className="min-w-0">
            <p className="break-words text-[13px] font-semibold text-[#17362c]">{localizedName(copy, price.itemName, price)}</p>
            {price.packageSize && <p className="mt-0.5 text-xs text-[#718078]">{packageSizeForCopy(copy, price.packageSize)}</p>}
            {price.priceSource === "median" && (
              <p className="mt-1 text-[11px] font-semibold text-[#7a5b00]">{copy.medianPriceEstimate}</p>
            )}
            <div className="mt-1">
              <SaraEligibilityFlag status={price.saraEligible ?? null} categoryCandidate={price.saraCategoryCandidate ?? false} copy={copy} />
            </div>
          </div>
          {price.unitPriceRm != null && price.lineTotalRm != null ? (
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-extrabold text-[#17362c]">{formatRm(price.lineTotalRm)}</p>
              <p className="text-[11px] text-[#718078]">{price.quantity} × {formatRm(price.unitPriceRm)}</p>
            </div>
          ) : (
            <p className="shrink-0 text-[13px] font-medium text-[#5f6368]">{copy.noStorePrice}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function CompactSavingsFooter({
  copy,
  hasReplacements,
  comparable,
  originalRm,
  newRm,
  netSavingRm,
  totalsLabel,
}: {
  copy: AppCopy;
  hasReplacements: boolean;
  comparable: boolean;
  originalRm: number | null;
  newRm: number | null;
  netSavingRm: number | null;
  totalsLabel: string;
}) {
  if (!hasReplacements || !comparable || netSavingRm == null || netSavingRm === 0) return null;
  const isSaving = netSavingRm > 0;
  const isIncrease = netSavingRm < 0;
  const theme = isSaving
    ? "border-[#b9e0d1] bg-[#e7f7f0] text-[#175f4b]"
    : isIncrease
      ? "border-[#efd3a6] bg-[#fff7e8] text-[#7a4d00]"
      : "border-[#d9e1dd] bg-[#f3f5f4] text-[#405149]";
  const message = isSaving
    ? copy.youSave(formatRm(netSavingRm))
    : copy.costsMoreNow(formatRm(Math.abs(netSavingRm)));

  return (
    <footer className={`border-t px-4 py-3 ${theme}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-xs font-bold">{isSaving ? copy.savingsTitle : copy.basketCostChange}</p>
          <p className="text-[15px] font-extrabold">{message}</p>
        </div>
        {comparable && originalRm != null && newRm != null && (
          <p className="text-right text-xs font-semibold">
            <span className="block opacity-75">{totalsLabel}</span>
            <span>{formatRm(originalRm)} → {formatRm(newRm)}</span>
          </p>
        )}
      </div>
    </footer>
  );
}

function replacementImpactText(copy: AppCopy, impactRm: number | null): string {
  if (impactRm == null) return copy.savingsUnavailable;
  if (impactRm > 0) return copy.saveAmount(formatRm(impactRm));
  if (impactRm < 0) return copy.moreNow(formatRm(Math.abs(impactRm)));
  return copy.sameCostNow;
}

type PaginationEntry = number | `ellipsis-${number}`;

function paginationEntries(currentPage: number, totalPages: number): PaginationEntry[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter(page => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const entries: PaginationEntry[] = [];

  visiblePages.forEach((page, index) => {
    const previous = visiblePages[index - 1];
    if (index > 0 && page - previous === 2) entries.push(previous + 1);
    if (index > 0 && page - previous > 2) entries.push(`ellipsis-${previous}`);
    entries.push(page);
  });
  return entries;
}

function LanguageToggle({ locale, onToggle }: { locale: Locale; onToggle: () => void }) {
  const copy = COPY[locale];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={copy.switchLanguage}
      title={copy.switchLanguage}
      className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-[#dce5e0] bg-white px-2 text-xs font-extrabold text-[#087f5b]"
    >
      {locale === "en" ? "BM" : "EN"}
    </button>
  );
}

function Header({
  basketCount,
  onBasket,
  basketActive,
  onBack,
  locale,
  onToggleLanguage,
  copy,
}: {
  basketCount: number;
  onBasket?: () => void;
  basketActive: boolean;
  onBack?: () => void;
  locale: Locale;
  onToggleLanguage: () => void;
  copy: AppCopy;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e7ece9] bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-10">
        {onBack ? (
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 justify-self-start text-sm font-bold text-[#087f5b]">
            <IcoArrowBack /> {copy.back}
          </button>
        ) : <span aria-hidden="true" />}

        <Link href="/" aria-label="SmartCart home" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-lg font-extrabold tracking-[-0.4px] text-[#10231d] transition-colors hover:bg-[#e5f5ed] focus-visible:bg-[#e5f5ed]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#087f5b] text-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M4.5 9.5h15l-1.15 9.2a2 2 0 0 1-1.98 1.75H7.63a2 2 0 0 1-1.98-1.75L4.5 9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M8 9.5 10 5m6 4.5L14 5M3.5 9.5h17M9 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className="hidden sm:inline">SmartCart</span>
        </Link>

        <div className="flex items-center gap-2 justify-self-end">
          <LanguageToggle locale={locale} onToggle={onToggleLanguage} />
          {onBasket && <button
            type="button"
            onClick={onBasket}
            aria-label={copy.viewBasketAria(basketCount)}
            aria-current={basketActive ? "page" : undefined}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${basketActive ? "border-[#087f5b] bg-[#edf7f2]" : "border-[#dce5e0] bg-white"}`}
          >
            <IcoBasket color="#087f5b" size={22} />
            {basketCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e8590c] px-1 text-[11px] font-bold text-white">
                {basketCount}
              </span>
            )}
          </button>}
        </div>
      </div>
    </header>
  );
}

// ── Progress indicator ────────────────────────────────────────────────────────
function ProgressIndicator({ step, copy }: { step: 1 | 2 | 3 | 4; copy: AppCopy }) {
  const steps = [
    { n: 1, label: copy.travel },
    { n: 2, label: copy.shop },
    { n: 3, label: copy.basket },
    { n: 4, label: copy.compare },
  ] as const;

  return (
    <div
      role="progressbar"
      aria-label={copy.step(step)}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuenow={step}
      aria-valuetext={copy.step(step)}
      className="-mx-2 w-[calc(100%+1rem)] px-3 py-3 sm:px-5"
    >
      <div className="relative">
        <div aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-4 h-1 -translate-y-1/2 rounded-full bg-[#dce5e0]">
          <div
            className="h-full rounded-full bg-[#087f5b]"
            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
        <ol className="relative grid grid-cols-4">
          {steps.map(current => (
            <li key={current.n} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-extrabold ${
                  current.n < step
                    ? "border-[#087f5b] bg-[#087f5b] text-white"
                    : current.n === step
                      ? "border-[#087f5b] bg-[#edf7f2] text-[#087f5b]"
                      : "border-[#b8c9c1] bg-white text-[#617069]"
                }`}
              >
                {current.n < step ? "✓" : current.n}
              </span>
              <span className={`min-w-0 break-words text-[11px] font-bold leading-4 sm:text-sm ${current.n <= step ? "text-[#087f5b]" : "text-[#617069]"}`}>
                {current.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function QuantitySelector({
  value,
  onChange,
  onStep,
  decreaseLabel,
  increaseLabel,
  quantityLabel,
  errorId,
  errorText,
  action,
}: {
  value: string;
  onChange: (value: string) => void;
  onStep: (delta: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  quantityLabel: string;
  errorId?: string;
  errorText?: string;
  action?: ReactNode;
}) {
  const qty = parseQty(value);

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:items-start">
      <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
        <button type="button" aria-label={decreaseLabel} disabled={qty === DEFAULT_QTY} onClick={() => onStep(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd8d1] text-lg text-[#087f5b] disabled:opacity-40">−</button>
        <input
          type="text"
          inputMode="numeric"
          aria-label={quantityLabel}
          aria-invalid={qty === null}
          aria-describedby={qty === null && errorId ? errorId : undefined}
          value={value}
          onChange={event => onChange(event.target.value)}
          className={`h-11 w-12 rounded-xl border text-center text-sm font-bold focus:outline-none ${qty === null ? "border-[#c92a2a] bg-[#fff5f5] text-[#93000a] focus:border-[#c92a2a]" : "border-[#cbd8d1] text-[#10231d] focus:border-[#087f5b]"}`}
        />
        <button type="button" aria-label={increaseLabel} disabled={qty === MAX_QTY} onClick={() => onStep(1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087f5b] text-lg text-white disabled:opacity-40">+</button>
        {action}
      </div>
      {qty === null && errorId && errorText && (
        <p id={errorId} role="alert" className="max-w-full break-words text-right text-[13px] font-semibold leading-5 text-[#c92a2a]">{errorText}</p>
      )}
    </div>
  );
}

// ── Screen 1: Build Your Basket ───────────────────────────────────────────────
function BasketScreen({
  view,
  basket,
  setBasket,
  onViewBasket,
  onBackToShop,
  onContinue,
  preferences,
  candidateCount,
  copy,
  locale,
}: {
  view: "shop" | "basket";
  basket: BasketItem[];
  setBasket: Dispatch<SetStateAction<BasketItem[]>>;
  onViewBasket: () => void;
  onBackToShop: () => void;
  onContinue: () => void;
  preferences?: TravelPreferences;
  candidateCount?: number;
  copy: AppCopy;
  locale: Locale;
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState({ id: 0, message: "" });
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [emptyError, setEmptyError] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);

  // ── Real database search (Step 6) ─────────────────────────────────────────
  const [apiResults, setApiResults] = useState<Item[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSearched, setApiSearched] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [qtyById, setQtyById] = useState<Record<number, string>>({}); // result-row quantity raw input (default "1")
  const [basketQtyById, setBasketQtyById] = useState<Record<string, string>>({});

  // AC-1.4.1: single source of truth is the raw string; the steppers also
  // read/write through parseQty so typed and stepped values never drift.
  const stepResultQty = (itemId: number, delta: number) => {
    setQtyById(current => {
      const base = parseQty(current[itemId] ?? String(DEFAULT_QTY)) ?? DEFAULT_QTY;
      return { ...current, [itemId]: String(stepQty(base, delta)) };
    });
  };

  const typeResultQty = (itemId: number, raw: string) => {
    setQtyById(current => ({ ...current, [itemId]: raw }));
  };

  useEffect(() => {
    const controller = new AbortController();
    setCategoriesLoading(true);
    setCategoriesError(false);
    listCategories(controller.signal)
      .then(data => setCategories(data.categories))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCategories([]);
        setCategoriesError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (view !== "shop") return;
    const query = search.trim();
    if (query.length === 1) {
      setApiResults([]);
      setApiTotal(0);
      setApiTotalPages(0);
      setApiSearched(false);
      setApiLoading(false);
      setApiError(false);
      return;
    }

    const controller = new AbortController();
    setApiLoading(true);
    setApiSearched(true);
    setApiError(false);
    const timer = window.setTimeout(() => {
      searchItems(query, page, activeCategories, controller.signal)
        .then(data => {
          setApiResults(data.items);
          setApiTotal(data.total);
          setApiTotalPages(data.total_pages);
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setApiResults([]);
          setApiTotal(0);
          setApiTotalPages(0);
          setApiError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setApiLoading(false);
        });
    }, query.length >= 2 ? 250 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeCategories, page, search, view]);

  const toggleCategory = (category: string) => {
    setPage(1);
    setActiveCategories(current => current.includes(category)
      ? current.filter(selected => selected !== category)
      : [...current, category]);
  };

  const stepBasketQty = (id: string, delta: number) => {
    const item = basket.find(current => current.id === id);
    if (!item) return;
    const base = parseQty(basketQtyById[id] ?? String(item.qty)) ?? item.qty;
    const next = stepQty(base, delta);
    setBasketQtyById(current => ({ ...current, [id]: String(next) }));
    setBasket(current => current.map(line => line.id === id ? { ...line, qty: next } : line));
  };

  const typeBasketQty = (id: string, raw: string) => {
    setBasketQtyById(current => ({ ...current, [id]: raw }));
    const next = parseQty(raw);
    if (next === null) return;
    setBasket(current => current.map(line => line.id === id ? { ...line, qty: next } : line));
  };

  const removeItem = (id: string) => {
    setBasket(current => current.filter(item => item.id !== id));
    setBasketQtyById(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  // Convert a real database Item into a BasketItem and add it to the basket.
  // id is prefixed with "db-" to avoid colliding with the demo STORES ids ("1".."5").
  // Package size comes from the same mapping as the result row, so both views
  // always show identical details; unparsed values show "—".
  const addRealItem = (item: Item, qty: number) => {
    // AC-1.4.2: same item added again increases quantity, never duplicates.
    setBasket(current => upsertBasketLine(current, {
      id: `db-${item.item_id}`,
      ...basketDetails(item),
      itemNameEn: item.item_name_en,
      itemNameMs: item.item_name_ms,
      qty,
      saraEligible: item.sara_eligible,
      saraCategoryCandidate: item.sara_category_candidate,
    }));
    setNotification(current => ({ id: current.id + 1, message: copy.itemAdded(qty, localizedName(copy, item.item_name, { itemNameEn: item.item_name_en, itemNameMs: item.item_name_ms })) }));
  };

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > apiTotalPages || nextPage === page) return;
    setPage(nextPage);
    document.getElementById("catalogue-results")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleContinue = () => {
    if (basket.length === 0) { setEmptyError(true); return; }
    setEmptyError(false);
    onContinue();
  };

  const { itemCount } = basketSummary(basket);
  const basketCostSummary = basketSavingsSummary(basket);
  const isDesktopBasketRail = view === "shop";

  const basketPanel = (
      <div className={isDesktopBasketRail ? "h-full" : "px-4 pb-8 sm:px-6"}>
        <div className={isDesktopBasketRail
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-white"
          : "overflow-hidden rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_4px_18px_rgba(16,35,29,0.05)]"}>
          {/* Heading */}
          <div className={"flex items-center justify-between border-b border-[#edf1ef] " + (isDesktopBasketRail ? "px-5 py-4" : "px-4 py-4")}>
            <div className="flex items-center gap-2">
              <IcoBasket color="#087f5b" size={22} />
              <div>
                <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.basketItems}</h2>
              </div>
            </div>
          </div>

          <div className={isDesktopBasketRail ? "min-h-0 flex-1 overflow-y-auto px-5" : "p-4"}>

          {basket.length === 0 ? (
            <p className="text-[16px] text-[#3e494a] text-center py-4">{copy.basketEmpty}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {basket.map((item, idx) => (
                <div key={item.id}>
                  <div className={"flex min-w-0 py-3 " + (isDesktopBasketRail ? "flex-col gap-3" : "flex-col gap-3 sm:flex-row sm:items-center sm:justify-between")}>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-[15px] font-bold leading-5 text-[#10231d]">{localizedName(copy, item.name, item)}</p>
                        {item.replacement && <span className="rounded-md bg-[#e7f7f0] px-2 py-1 text-[11px] font-extrabold text-[#17634f]">{item.replacement.kind === "pack" ? copy.packChanged : copy.swapped}</span>}
                      </div>
                      <p className="break-words text-[13px] leading-5 text-[#617069]">{packageSizeForCopy(copy, item.size)}</p>
                      <SaraEligibilityFlag status={item.saraEligible} categoryCandidate={item.saraCategoryCandidate} copy={copy} />
                      {item.replacement && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#286d67]">
                          <span>{copy.originally(localizedName(copy, item.replacement.original.name, item.replacement.original))} · {replacementImpactText(copy, currentReplacementImpactRm(item))}</span>
                          <button type="button" onClick={() => setBasket(current => undoBasketReplacement(current, item.id))} className="min-h-9 font-extrabold text-[#087f5b] underline underline-offset-2">{copy.undoSwap}</button>
                        </div>
                      )}
                    </div>
                    <div className={"flex shrink-0 items-center gap-1 " + (isDesktopBasketRail ? "self-start" : "self-start sm:self-auto")}>
                      <QuantitySelector
                        value={basketQtyById[item.id] ?? String(item.qty)}
                        onChange={raw => typeBasketQty(item.id, raw)}
                        onStep={delta => stepBasketQty(item.id, delta)}
                        decreaseLabel={copy.decreaseQuantity(localizedName(copy, item.name, item))}
                        increaseLabel={copy.increaseQuantity(localizedName(copy, item.name, item))}
                        quantityLabel={copy.quantityFor(localizedName(copy, item.name, item))}
                        errorId={`basket-quantity-error-${item.id}`}
                        errorText={copy.quantityError}
                      />
                      <button type="button" aria-label={copy.removeItem(localizedName(copy, item.name, item))} onClick={() => removeItem(item.id)} className="flex h-11 w-9 items-center justify-center">
                        <IcoTrash />
                      </button>
                    </div>
                  </div>
                  {idx < basket.length - 1 && <div className="border-b border-[#e1e3e4]" />}
                </div>
              ))}
            </div>
          )}

          </div>
          <CompactSavingsFooter
            copy={copy}
            hasReplacements={basketCostSummary.hasReplacements}
            comparable={basketCostSummary.comparable}
            originalRm={basketCostSummary.originalRm}
            newRm={basketCostSummary.newRm}
            netSavingRm={basketCostSummary.netSavingRm}
            totalsLabel={copy.affectedItemsTotal}
          />
          {isDesktopBasketRail && (
            <div className="border-t border-[#dce5e0] bg-[#fbfcfb] px-5 py-4">
              <button type="button" onClick={onViewBasket} disabled={basket.length === 0} className="min-h-12 w-full rounded-xl bg-[#087f5b] px-4 text-[15px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)] disabled:cursor-not-allowed disabled:bg-[#8aa69d] disabled:shadow-none">
                {copy.viewBasket}
              </button>
            </div>
          )}
        </div>
      </div>
  );

  return (
    <div className={"screen-enter pb-32 " + (view === "shop" ? "lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6 lg:px-8 xl:px-12" : "")}>
      {view === "shop" && (
        <div className="min-w-0">
      {/* Progress */}
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <ProgressIndicator step={2} copy={copy} />
      </div>

      {/* Page header */}
      <div className="px-4 pb-5 pt-1 sm:px-6 sm:pt-0">
        <p className="mb-1 text-sm font-bold text-[#087f5b]">{copy.shopEyebrow}</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">{copy.shopTitle}</h1>
        <p className="mt-2 max-w-[580px] text-[16px] leading-6 text-[#53635c]">
          {copy.shopDescription}
        </p>
      </div>

      {/* Search —— now calls the real backend API (Step 6) */}
      <div className="sticky top-16 z-30 bg-[#f7f8f6]/95 px-4 pb-3 pt-2 backdrop-blur sm:px-6">
        <div className="relative h-14">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <IcoSearch />
          </div>
          <input
            ref={searchRef}
            type="text"
            aria-label={copy.searchAria}
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-14 w-full rounded-2xl border border-[#dce5e0] bg-white pl-12 pr-14 text-[16px] text-[#10231d] shadow-[0_3px_14px_rgba(16,35,29,0.07)] placeholder:text-[#718078] focus:border-[#087f5b] focus:outline-none"
          />
          {search && <button type="button" aria-label={copy.clearSearch} onClick={() => { setSearch(""); setPage(1); searchRef.current?.focus(); }} className="absolute right-1 top-1 h-12 w-12 rounded-xl text-xl text-[#53635c]">×</button>}
        </div>
      </div>

      {/* Multi-select category filter */}
      <div className="sticky top-[8.75rem] z-[60] bg-[#f7f8f6]/95 px-4 pb-6 pt-1 backdrop-blur sm:px-6">
        <button
          type="button"
          aria-expanded={categoryOpen}
          aria-controls="category-options"
          onClick={() => setCategoryOpen(open => !open)}
          className="flex min-h-12 w-full items-center justify-between rounded-xl border border-[#d7e1dc] bg-white px-4 text-left shadow-sm"
        >
          <span>
            <span className="block text-xs font-semibold text-[#718078]">{copy.categories}</span>
            <span className="block text-[15px] font-bold text-[#17362c]">
              {activeCategories.length === 0 ? copy.allCategories : activeCategories.map(category => categoryLabel(locale, category)).join(", ")}
            </span>
          </span>
          <span aria-hidden="true" className={`text-lg text-[#087f5b] transition-transform ${categoryOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>

        {categoryOpen && (
          <div id="category-options" className="absolute left-4 right-4 top-[60px] rounded-2xl border border-[#d7e1dc] bg-white p-3 shadow-[0_14px_34px_rgba(16,35,29,0.16)] sm:left-6 sm:right-6">
            <div className="mb-2 flex items-center justify-between border-b border-[#edf1ef] px-1 pb-2">
              <p className="text-sm font-extrabold text-[#10231d]">{copy.filterByCategory}</p>
              {activeCategories.length > 0 && (
                <button type="button" onClick={() => { setActiveCategories([]); setPage(1); }} className="min-h-11 px-2 text-sm font-bold text-[#087f5b]">{copy.clearAll}</button>
              )}
            </div>
            <div className="grid max-h-[210px] grid-cols-1 gap-1 overflow-y-auto sm:max-h-[300px] sm:grid-cols-2">
              {categoriesLoading && <p className="col-span-full px-2 py-3 text-sm text-[#617069]">{copy.loadingCategories}</p>}
              {!categoriesLoading && categoriesError && <p className="col-span-full px-2 py-3 text-sm text-[#ba1a1a]">{copy.categoriesUnavailable}</p>}
              {categories.map(category => (
                <label key={category} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-[#f2f6f3]">
                  <input
                    type="checkbox"
                    checked={activeCategories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="h-5 w-5 accent-[#087f5b]"
                  />
                  <span className="min-w-0 break-words text-sm font-medium text-[#263b33]">{categoryLabel(locale, category)}</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setCategoryOpen(false)} className="mt-3 h-11 w-full rounded-xl bg-[#087f5b] text-sm font-extrabold text-white">{copy.showItems(apiTotal)}</button>
          </div>
        )}
      </div>

      {/* Matching items —— now shows real backend data with prices (Step 7) */}
      <div id="catalogue-results" className="scroll-mt-36 px-4 pb-7 sm:px-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">
            {search.trim().length >= 2 || activeCategories.length > 0 ? copy.searchResults : copy.allEssentials}
          </h2>
          <span className="text-sm font-medium text-[#718078]">
            {apiLoading ? copy.searching : copy.itemCount(apiTotal)}
          </span>
        </div>

        {/* Not searched yet */}
        {!apiSearched && (
          <p className="text-[16px] text-[#3e494a] text-center py-6">
            {copy.enterTwoCharacters}
          </p>
        )}

        {/* Loading */}
        {apiLoading && (
          <p className="text-[16px] text-[#718078] text-center py-6">{copy.searchingDatabase}</p>
        )}

        {/* Searched but no results — AC-1.1.1 exact wording */}
        {!apiLoading && apiSearched && !apiError && apiResults.length === 0 && (
          <p className="text-[16px] text-[#3e494a] text-center py-6">
            {copy.noItems}
          </p>
        )}

        {!apiLoading && apiError && (
          <p role="alert" className="text-[16px] text-[#ba1a1a] text-center py-6">{copy.catalogueUnavailable}</p>
        )}

        {/* Real results list */}
        {!apiLoading && apiResults.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5">
            {apiResults.map(item => {
              const fields = { ...resultRowFields(item), name: localizedName(copy, item.item_name, { itemNameEn: item.item_name_en, itemNameMs: item.item_name_ms }) };
              const rawQty = qtyById[item.item_id] ?? String(DEFAULT_QTY);
              const qty = parseQty(rawQty); // null while the typed value is invalid (AC-1.4.1)
              return (
              <article key={item.item_id} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-[#e2e9e5] bg-white p-3 shadow-[0_3px_12px_rgba(16,35,29,0.045)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="break-words text-[15px] font-extrabold leading-5 text-[#10231d]">{fields.name}</h3>
                  <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-0.5 text-[12px] leading-5">
                    <span className="break-words text-[#617069]">{packageSizeForCopy(copy, fields.packageSize)}</span>
                    <span className="break-words text-[#718078]">{categoryLabel(locale, item.item_category)}</span>
                  </div>
                  <SaraEligibilityFlag status={item.sara_eligible} categoryCandidate={item.sara_category_candidate} copy={copy} />
                </div>

                <QuantitySelector
                  value={rawQty}
                  onChange={raw => typeResultQty(item.item_id, raw)}
                  onStep={delta => stepResultQty(item.item_id, delta)}
                  decreaseLabel={copy.decreaseQuantity(fields.name)}
                  increaseLabel={copy.increaseQuantity(fields.name)}
                  quantityLabel={copy.quantityFor(fields.name)}
                  errorId={`quantity-error-${item.item_id}`}
                  errorText={copy.quantityError}
                  action={<button
                      type="button"
                      disabled={qty === null}
                      onClick={() => { if (qty === null) return; addRealItem(item, qty); }}
                      aria-label={`${copy.addToBasket}: ${fields.name}`}
                      className="min-h-11 min-w-[76px] whitespace-normal break-words rounded-xl border border-[#087f5b] bg-white px-3 py-2 text-[14px] font-extrabold leading-5 text-[#087f5b] hover:bg-[#edf7f2] disabled:border-[#cbd8d1] disabled:text-[#718078] disabled:hover:bg-white"
                    >
                      {copy.addShort}
                    </button>}
                />
              </article>
              );
            })}
          </div>
        )}

        {!apiLoading && !apiError && apiTotalPages > 1 && (
          <nav aria-label={copy.pagination} className="mt-6 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-[#617069]">{copy.pageOf(page, apiTotalPages)}</p>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page === 1}
                aria-label={copy.previousPage}
                className="flex min-h-11 items-center gap-1 rounded-xl border border-[#cbd8d1] bg-white px-3 text-sm font-bold text-[#087f5b] disabled:opacity-40"
              >
                <span aria-hidden="true">‹</span>
                <span className="hidden sm:inline">{copy.previousPage}</span>
              </button>
              {paginationEntries(page, apiTotalPages).map(entry => typeof entry === "number" ? (
                <button
                  key={entry}
                  type="button"
                  onClick={() => changePage(entry)}
                  aria-label={copy.goToPage(entry)}
                  aria-current={entry === page ? "page" : undefined}
                  className={`h-11 min-w-11 rounded-xl px-2 text-sm font-extrabold ${entry === page ? "bg-[#087f5b] text-white" : "border border-[#cbd8d1] bg-white text-[#087f5b]"}`}
                >
                  {entry}
                </button>
              ) : (
                <span key={entry} aria-hidden="true" className="flex h-11 min-w-6 items-center justify-center text-[#718078]">…</span>
              ))}
              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page === apiTotalPages}
                aria-label={copy.nextPage}
                className="flex min-h-11 items-center gap-1 rounded-xl border border-[#cbd8d1] bg-white px-3 text-sm font-bold text-[#087f5b] disabled:opacity-40"
              >
                <span className="hidden sm:inline">{copy.nextPage}</span>
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </nav>
        )}
      </div>

        </div>
      )}

      {/* Your basket */}
      {view === "shop" && (
        <aside aria-label={copy.basketTitle} className="sticky top-20 hidden h-[calc(100dvh-6rem)] min-h-0 overflow-hidden rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_8px_24px_rgba(16,35,29,0.07)] lg:col-start-2 lg:block">
          {basketPanel}
        </aside>
      )}
      {notification.message && <SuccessToast notificationId={notification.id} message={notification.message} dismissLabel={copy.dismiss} onDismiss={() => setNotification(current => ({ ...current, message: "" }))} />}
      {view === "basket" && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-7 lg:px-12">
          <div className="min-w-0">
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <ProgressIndicator step={3} copy={copy} />
        <p className="mb-1 mt-6 text-sm font-bold text-[#087f5b]">{copy.basketEyebrow}</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">{copy.basketTitle}</h1>
        <p className="mt-2 text-[16px] leading-6 text-[#53635c]">{copy.basketDescription}</p>
      </div>

      {basketPanel}
          </div>
          <aside className="mx-4 mb-28 rounded-2xl border border-[#dce5e0] bg-white p-5 shadow-[0_8px_24px_rgba(16,35,29,0.06)] sm:mx-6 lg:sticky lg:top-20 lg:mx-0 lg:mt-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#087f5b]">{locale === "ms" ? "Ringkasan perjalanan" : "Trip summary"}</p>
            <h2 className="mt-2 text-xl font-extrabold text-[#17362c]">{preferences?.origin?.label ?? (locale === "ms" ? "Lokasi belum dipilih" : "No location selected")}</h2>
            {preferences && <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-[#617069]">{locale === "ms" ? "Pengangkutan" : "Transport"}</dt><dd className="font-bold text-[#17362c]">{transportLabel(copy, preferences.transportMode)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#617069]">{locale === "ms" ? "Had" : "Limit"}</dt><dd className="font-bold text-[#17362c]">{preferences.limitType === "both" ? `${preferences.distanceKm} km · ${preferences.timeMinutes} min` : `${preferences.limitValue} ${preferences.limitType === "distance" ? "km" : "min"}`}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#617069]">{locale === "ms" ? "Kedai disediakan" : "Prepared stores"}</dt><dd className="font-bold text-[#17362c]">{candidateCount ?? 0}</dd></div>
            </dl>}
            <p className="mt-5 text-sm leading-6 text-[#617069]">{locale === "ms" ? "Harga akan dimuatkan semula untuk bakul semasa apabila anda memilih Cari kedai." : "Prices will be refreshed for this basket when you choose Search stores."}</p>
          </aside>
        </div>
      )}

      {(view === "basket" || itemCount > 0) && !(view === "shop" && categoryOpen) && <div className={(view === "shop" ? "lg:hidden " : "") + "fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur"}>
        {view === "basket" ? (
          <div className="mx-auto flex w-full max-w-[712px] gap-3">
            <button type="button" onClick={onBackToShop} className="h-14 flex-[0.8] rounded-2xl border border-[#cbd8d1] bg-white text-[14px] font-bold text-[#087f5b]">
              {copy.backToShop}
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="h-14 flex-1 rounded-2xl bg-[#087f5b] text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)]"
            >
              {locale === "ms" ? "Cari kedai" : "Search stores"}
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[712px] flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={onViewBasket}
              className="flex min-h-14 w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-2xl bg-[#087f5b] px-5 py-2 text-center text-[15px] font-extrabold leading-5 text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)] sm:w-auto sm:min-w-[190px]"
            >
              {copy.viewBasket}
              <IcoArrowRight />
            </button>
          </div>
        )}
        {emptyError && (
          <p role="alert" className="mx-auto mt-2 max-w-[712px] text-right text-sm font-medium text-[#ba1a1a]">{copy.addOneItem}</p>
        )}
      </div>}
    </div>
  );
}

// ── Screen 2: Set Your Location ───────────────────────────────────────────────
const TRANSPORT_OPTS: Array<{
  id: TransportMode;
  Icon: ({ active }: { active: boolean }) => React.ReactNode;
}> = [
  { id: "walk", Icon: ({ active }: { active: boolean }) => <IcoWalkFigma color={active ? "white" : "#3E494A"} /> },
  { id: "public_transport", Icon: ({ active }: { active: boolean }) => (
    <div className="flex items-center gap-1">
      <IcoWalkFigma color={active ? "white" : "#3E494A"} />
      <IcoBusFigma color={active ? "white" : "#3E494A"} />
    </div>
  ) },
  { id: "motorcycle", Icon: ({ active }: { active: boolean }) => <IcoMotoFigma color={active ? "white" : "#3E494A"} /> },
  { id: "car", Icon: ({ active }: { active: boolean }) => <IcoCarFigma color={active ? "white" : "#3E494A"} /> },
];

function transportLabel(copy: AppCopy, mode: TransportMode): string {
  return {
    walk: copy.walking,
    public_transport: copy.publicTransport,
    motorcycle: copy.motorcycle,
    car: copy.car,
  }[mode];
}

function createLocationSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "smartcart-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function travelRequestFromPreferences(preferences: TravelPreferences): TravelPreferencesRequest {
  if (!preferences.origin) {
    throw new Error("A selected origin is required before preparing stores.");
  }
  return {
    origin: preferences.origin,
    transportMode: preferences.transportMode,
    limit: preferences.limitType === "both"
      ? { type: "both", distanceKm: preferences.distanceKm, timeMinutes: preferences.timeMinutes }
      : { type: preferences.limitType, value: preferences.limitValue },
    saraFilter: preferences.saraFilter,
  };
}

const DISTANCE_LIMITS = [2, 5, 10, 15] as const;
const TIME_LIMITS = [10, 20, 30, 45] as const;

function LocationScreen({
  preferences,
  onBack,
  onCompare,
  onPreparationChange,
  locale,
  copy,
}: {
  preferences: TravelPreferences;
  onBack: () => void;
  onCompare: (preferences: TravelPreferences) => void;
  onPreparationChange: (preparation: CandidatePreparationResponse | null) => void;
  locale: Locale;
  copy: AppCopy;
}) {
  const [locationInput, setLocationInput] = useState(preferences.origin?.label ?? "");
  const [selectedOrigin, setSelectedOrigin] = useState<SelectedLocation | null>(preferences.origin);
  const [transportMode, setTransportMode] = useState<TransportMode>(preferences.transportMode);
  const [limitType, setLimitType] = useState<TravelLimitType>(preferences.limitType);
  const [distanceKm, setDistanceKm] = useState(preferences.distanceKm);
  const [timeMinutes, setTimeMinutes] = useState(preferences.timeMinutes);
  const limitValue = limitType === "time" ? timeMinutes : distanceKm;
  const locationSearchRef = useRef<HTMLInputElement>(null);
  const [saraFilter, setSaraFilter] = useState<SaraFilter>(preferences.saraFilter);
  const [remember, setRemember] = useState(true);
  const [sessionToken, setSessionToken] = useState(createLocationSessionToken);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "resolving" | "locating">("idle");
  const [locationError, setLocationError] = useState("");
  const [preparationStatus, setPreparationStatus] = useState<"idle" | "preparing" | "ready" | "no_reachable_stores" | "unverified" | "expired" | "error">("idle");
  const [preparationResponse, setPreparationResponse] = useState<CandidatePreparationResponse | null>(null);
  const [preparationError, setPreparationError] = useState("");
  const preparationFingerprint = useRef("");

  const locationGeneration = useRef(0);
  const reverseController = useRef<AbortController | null>(null);
  const [notification, setNotification] = useState({ id: 0, message: "" });
  useEffect(() => () => { locationGeneration.current += 1; reverseController.current?.abort(); }, []);

  useEffect(() => {
    if (!selectedOrigin) {
      preparationFingerprint.current = "";
      setPreparationResponse(null);
      setPreparationStatus("idle");
      setPreparationError("");
      onPreparationChange(null);
      return;
    }

    const travel = travelRequestFromPreferences({ origin: selectedOrigin, transportMode, limitType, limitValue, distanceKm, timeMinutes, saraFilter });
    const fingerprint = JSON.stringify(travel);
    if (fingerprint === preparationFingerprint.current) return;
    preparationFingerprint.current = fingerprint;
    setPreparationResponse(null);
    onPreparationChange(null);
    setPreparationStatus("preparing");
    setPreparationError("");
    const controller = new AbortController();
    let expiryTimer: number | undefined;
    let completed = false;
    const debounceTimer = window.setTimeout(() => {
      prepareRecommendationCandidates(travel, controller.signal)
        .then(preparation => {
          if (controller.signal.aborted) return;
          completed = true;
          setPreparationResponse(preparation);
          setPreparationStatus(preparation.status);
          onPreparationChange(preparation);
          const remaining = Date.parse(preparation.expiresAt) - Date.now();
          if (remaining > 0) {
            expiryTimer = window.setTimeout(() => {
              setPreparationResponse(null);
              setPreparationStatus("expired");
              onPreparationChange(null);
            }, remaining);
          } else {
            setPreparationResponse(null);
            setPreparationStatus("expired");
            onPreparationChange(null);
          }
        })
        .catch(error => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          completed = true;
          setPreparationStatus("error");
          setPreparationError(error instanceof Error ? error.message : "Candidate search is temporarily unavailable.");
        });
    }, 300);
    return () => {
      window.clearTimeout(debounceTimer);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      controller.abort();
      if (!completed && preparationFingerprint.current === fingerprint) preparationFingerprint.current = "";
    };
  }, [distanceKm, limitType, limitValue, onPreparationChange, saraFilter, selectedOrigin, timeMinutes, transportMode]);

  useEffect(() => {
    const query = locationInput.trim();
    if (query.length < 3 || selectedOrigin?.label === locationInput) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchState("searching");
      setLocationError("");
      searchLocations(query, sessionToken, controller.signal)
        .then(result => {
          setSuggestions(result.suggestions);
          setActiveSuggestion(-1);
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSuggestions([]);
          setLocationError(copy.locationSearchUnavailable);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchState("idle");
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [copy.locationSearchUnavailable, locationInput, selectedOrigin, sessionToken]);

  const chooseSuggestion = async (suggestion: LocationSuggestion) => {
    const generation = ++locationGeneration.current;
    reverseController.current?.abort();
    setSearchState("resolving");
    setLocationError("");
    try {
      const resolved = await resolveLocation(suggestion.placeId, sessionToken);
      if (generation !== locationGeneration.current) return;
      const origin: SelectedLocation = { ...resolved, source: "search" };
      setSelectedOrigin(origin);
      setLocationInput(origin.label);
      setSuggestions([]);
      setActiveSuggestion(-1);
      setSessionToken(createLocationSessionToken());
    } catch {
      if (generation === locationGeneration.current) setLocationError(copy.locationSelectionFailed);
    } finally {
      if (generation === locationGeneration.current) setSearchState("idle");
    }
  };

  const clearLocationSearch = () => {
    locationGeneration.current += 1;
    reverseController.current?.abort();
    setLocationInput("");
    setSelectedOrigin(null);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSearchState("idle");
    setLocationError("");
    locationSearchRef.current?.focus();
  };

  const usePreciseLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(copy.geolocationUnsupported);
      return;
    }

    const generation = ++locationGeneration.current;
    reverseController.current?.abort();
    setSearchState("locating");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      async position => {
        if (generation !== locationGeneration.current) return;
        const origin: SelectedLocation = {
          label: copy.currentLocation,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "device",
        };
        setSelectedOrigin(origin);
        setLocationInput(origin.label);
        setSuggestions([]);
        const controller = new AbortController();
        reverseController.current = controller;
        let label: string | null = null;
        try {
          label = (await reverseLocation(origin.latitude, origin.longitude, controller.signal)).label;
        } catch { /* Coordinates remain usable if address lookup is unavailable. */ }
        if (generation !== locationGeneration.current) return;
        const resolvedOrigin = { ...origin, label: label || copy.currentLocation };
        setSelectedOrigin(resolvedOrigin);
        setLocationInput(resolvedOrigin.label);
        setSearchState("idle");
        setNotification(current => ({ id: current.id + 1, message: label ? copy.locationDetected : copy.addressUnavailable }));
      },
      error => {
        if (generation !== locationGeneration.current) return;
        const message = error.code === error.PERMISSION_DENIED
          ? copy.locationDenied
          : copy.locationFailed;
        setLocationError(message);
        setSearchState("idle");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const handleLocationKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(current => Math.min(suggestions.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(current => Math.max(0, current - 1));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      void chooseSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      setSuggestions([]);
      setActiveSuggestion(-1);
    }
  };

  const handleCompare = () => {
    if (!selectedOrigin) {
      setLocationError(copy.locationRequired);
      return;
    }

    const nextPreferences: TravelPreferences = {
      origin: selectedOrigin,
      transportMode,
      limitType,
      limitValue,
      distanceKm,
      timeMinutes,
      saraFilter,
    };

    if (remember) {
      window.localStorage.setItem("smartcart-travel-preferences", JSON.stringify({
        transportMode,
        limitType,
        limitValue,
        distanceKm,
        timeMinutes,
        saraFilter,
      }));
    } else {
      window.localStorage.removeItem("smartcart-travel-preferences");
    }
    onCompare(nextPreferences);
  };


  return (
    <div className="screen-enter">
      {notification.message && <SuccessToast notificationId={notification.id} message={notification.message} dismissLabel={copy.dismiss} onDismiss={() => setNotification(current => ({ ...current, message: "" }))} />}
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <ProgressIndicator step={1} copy={copy} />
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <p className="mb-1 text-sm font-bold text-[#087f5b]">{copy.locationEyebrow}</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">{copy.locationTitle}</h1>
        <p className="mt-2 text-[16px] leading-6 text-[#53635c]">
          {copy.locationDescription}
        </p>
      </div>

      <div className="grid gap-6 px-4 pb-36 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:px-12">
        <section className="flex flex-col gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5 lg:col-start-1">
          <div className="flex items-center gap-2">
            <IcoLocation />
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.startingPoint}</h2>
          </div>

          <button
            type="button"
            onClick={usePreciseLocation}
            disabled={searchState === "locating"}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-[#087f5b] bg-[#edf7f2] px-4 text-[15px] font-extrabold text-[#087f5b] disabled:cursor-wait disabled:opacity-60"
          >
            <IcoLocation color="#087f5b" />
            {searchState === "locating" ? copy.findingLocation : copy.usePreciseLocation}
          </button>

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-[#718078]">
            <span className="h-px flex-1 bg-[#dce5e0]" />
            {copy.orSearch}
            <span className="h-px flex-1 bg-[#dce5e0]" />
          </div>

          <div className="relative">
            <div className="absolute left-3 top-7 -translate-y-1/2"><IcoSearch color="#3E494A" /></div>
            <input
              ref={locationSearchRef}
              type="text"
              value={locationInput}
              onChange={event => {
                const value = event.target.value;
                locationGeneration.current += 1;
                reverseController.current?.abort();
                setSearchState("idle");
                setLocationInput(value);
                if (value !== selectedOrigin?.label) setSelectedOrigin(null);
              }}
              onKeyDown={handleLocationKeyDown}
              role="combobox"
              aria-label={copy.searchLocationAria}
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="location-suggestions"
              aria-activedescendant={activeSuggestion >= 0 ? "location-suggestion-" + activeSuggestion : undefined}
              placeholder={copy.searchLocationPlaceholder}
              autoComplete="off"
              className="h-14 w-full rounded-xl border border-[#dce5e0] bg-[#f7f9f8] pl-10 pr-14 text-[16px] text-[#10231d] focus:border-[#087f5b] focus:outline-none"
            />
            {locationInput && (
              <button
                type="button"
                aria-label={copy.clearSearch}
                onClick={clearLocationSearch}
                className="absolute right-1 top-1 h-12 w-12 rounded-xl text-xl text-[#53635c]"
              >
                ×
              </button>
            )}
            {suggestions.length > 0 && (
              <div id="location-suggestions" role="listbox" className="absolute inset-x-0 top-[60px] z-30 overflow-hidden rounded-xl border border-[#d7e1dc] bg-white shadow-[0_14px_34px_rgba(16,35,29,0.16)]">
                {suggestions.map((suggestion, index) => (
                  <button
                    id={"location-suggestion-" + index}
                    role="option"
                    aria-selected={activeSuggestion === index}
                    type="button"
                    key={suggestion.placeId}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => void chooseSuggestion(suggestion)}
                    className={"block min-h-14 w-full border-b border-[#edf1ef] px-4 py-3 text-left last:border-b-0 " + (activeSuggestion === index ? "bg-[#edf7f2]" : "bg-white hover:bg-[#f7f9f8]")}
                  >
                    <span className="block text-[15px] font-bold text-[#17362c]">{suggestion.mainText}</span>
                    {suggestion.secondaryText && <span className="mt-0.5 block text-xs text-[#617069]">{suggestion.secondaryText}</span>}
                  </button>
                ))}
                <p className="bg-[#fafbf9] px-4 py-2 text-right text-[11px] font-semibold text-[#718078]">{copy.poweredByGoogle}</p>
              </div>
            )}
          </div>

          {(searchState === "searching" || searchState === "resolving" || locationError) && (
            <div aria-live="polite" className="text-sm">
              {searchState === "searching" && <span className="text-[#53635c]">{copy.searchingLocations}</span>}
              {searchState === "resolving" && <span className="text-[#53635c]">{copy.selectingLocation}</span>}
              {locationError && <span role="alert" className="font-medium text-[#ba1a1a]">{locationError}</span>}
            </div>
          )}

          <div className="flex items-start gap-2 text-[14px] leading-5 text-[#3e494a]">
            <span aria-hidden="true" className="flex h-5 w-4 shrink-0 items-center justify-center">
              <svg width={14} height={14} viewBox="0 0 13.3333 13.3333" fill="none">
                <path d={svgPathsLocation.p33549300} fill="#3E494A" />
              </svg>
            </span>
            <span>{copy.locationPrivacy}</span>
          </div>
        </section>

        <section className="flex flex-col gap-4 lg:col-start-1">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.transportMode}</h2>
          <div className="grid grid-cols-2 gap-3">
            {TRANSPORT_OPTS.map(option => {
              const active = transportMode === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setTransportMode(option.id)}
                  aria-pressed={active}
                  className={"flex min-h-[92px] flex-col items-center justify-center rounded-2xl border py-4 shadow-sm " + (active ? "border-[#087f5b] bg-[#087f5b]" : "border-[#dce5e0] bg-white")}
                >
                  <div className="mb-2"><option.Icon active={active} /></div>
                  <span className={"text-[14px] font-medium leading-5 " + (active ? "text-white" : "text-[#191c1d]")}>{transportLabel(copy, option.id)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {transportMode === "public_transport" && <p className="text-sm text-[#53635c]">{copy.transitWalking}</p>}

        <section className="flex flex-col gap-3 lg:col-start-1">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.travelLimit}</h2>
            <p className="mt-1 text-[16px] text-[#3e494a]">{copy.travelLimitDescription}</p>
          </div>
          <div className="grid grid-cols-3 rounded-xl bg-[#e8efeb] p-1" aria-label={copy.travelLimitType}>
            {(["distance", "time", "both"] as const).map(type => (
              <button
                type="button"
                key={type}
                onClick={() => {
                  setLimitType(type);
                }}
                aria-pressed={limitType === type}
                className={"min-h-11 rounded-lg px-3 text-sm font-bold " + (limitType === type ? "bg-white text-[#087f5b] shadow-sm" : "text-[#53635c]")}
              >
                {type === "both" ? copy.both : type === "distance" ? copy.distance : copy.travelTime}
              </button>
            ))}
          </div>
          {(["distance", "time"] as const).filter(type => limitType === "both" || limitType === type).map(type => (
            <fieldset key={type}>
              <legend className="mb-2 text-sm font-semibold">{type === "distance" ? copy.distance : copy.travelTime}</legend>
              <div className="grid grid-cols-4 gap-2">
                {(type === "distance" ? DISTANCE_LIMITS : TIME_LIMITS).map(value => (
                  <button type="button" key={value} onClick={() => type === "distance" ? setDistanceKm(value) : setTimeMinutes(value)} aria-pressed={(type === "distance" ? distanceKm : timeMinutes) === value} className={"h-12 rounded-xl border px-2 text-sm font-bold " + ((type === "distance" ? distanceKm : timeMinutes) === value ? "border-[#087f5b] bg-[#087f5b] text-white" : "border-[#dce5e0] bg-white text-[#405149]")}>
                    {value}{type === "distance" ? " km" : " min"}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] lg:col-start-1">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.saraPlanning} <span className="text-sm font-normal text-[#53635c]">({copy.optional})</span></h2>
          </div>
          <label className="flex items-start gap-3 text-[16px] text-[#191c1d]">
            <input
              type="checkbox"
              checked={saraFilter === "candidate"}
              onChange={event => setSaraFilter(event.target.checked ? "candidate" : "any")}
              className="mt-1 h-5 w-5 accent-[#00535b]"
            />
            <span>
              {copy.saraCandidatesOnly}
              <span className="mt-1 block text-xs text-[#6f797a]">{copy.saraCandidateNote}</span>
            </span>
          </label>
        </section>

        <button
          type="button"
          onClick={() => setRemember(!remember)}
          aria-pressed={remember}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#dce5e0] bg-white px-4 py-3 text-left lg:col-start-1"
        >
          <span className={"flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[2px] border " + (remember ? "border-[#00535b] bg-[#00535b]" : "border-[#bec8ca] bg-white")}>
            {remember && <IcoCheckbox />}
          </span>
          <span className="text-[16px] leading-6 text-[#191c1d]">{copy.rememberPreferences}</span>
        </button>
        {preparationStatus !== "idle" && <div aria-live="polite" role={preparationStatus === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm leading-5 lg:col-start-1 ${preparationStatus === "error" ? "border-[#f0b8b8] bg-[#fff5f5] text-[#93000a]" : "border-[#dce5e0] bg-white text-[#53635c]"}`}>
          {preparationStatus === "preparing" && (locale === "ms" ? "Menyediakan kedai berdekatan…" : "Preparing nearby stores…")}
          {preparationStatus === "ready" && (locale === "ms" ? `${preparationResponse?.candidateCount ?? 0} kedai sedia untuk dibandingkan.` : `${preparationResponse?.candidateCount ?? 0} stores are ready to compare.`)}
          {preparationStatus === "no_reachable_stores" && (locale === "ms" ? "Tiada kedai disahkan dalam had perjalanan ini." : "No verified stores were found within these travel limits.")}
          {preparationStatus === "unverified" && (preparationResponse?.routeWarning || (locale === "ms" ? "Anggaran garis lurus digunakan. Kebolehcapaian dan had perjalanan belum disahkan." : "Straight-line estimates are in use. Reachability and travel limits are unverified."))}
          {preparationStatus === "expired" && (locale === "ms" ? "Persediaan perjalanan telah tamat tempoh. Tetapan akan disediakan semula." : "This travel preparation expired. Update a setting to prepare it again.")}
          {preparationStatus === "error" && (preparationError || (locale === "ms" ? "Kedai tidak dapat disediakan sekarang." : "Stores could not be prepared right now."))}
        </div>}
        <aside className="rounded-2xl border border-[#cfe1d8] bg-[#eff8f3] p-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1 lg:row-span-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#087f5b]">{locale === "ms" ? "Perjalanan anda" : "Your trip"}</p>
          <h2 className="mt-2 break-words text-xl font-extrabold text-[#17362c]">{selectedOrigin?.label ?? (locale === "ms" ? "Pilih lokasi permulaan" : "Choose a starting point")}</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-[#617069]">{locale === "ms" ? "Pengangkutan" : "Transport"}</dt><dd className="font-bold text-[#17362c]">{transportLabel(copy, transportMode)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#617069]">{locale === "ms" ? "Had" : "Limit"}</dt><dd className="font-bold text-[#17362c]">{limitType === "both" ? `${distanceKm} km · ${timeMinutes} min` : `${limitValue} ${limitType === "distance" ? "km" : "min"}`}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#617069]">{locale === "ms" ? "Status" : "Status"}</dt><dd className="text-right font-bold text-[#17362c]">{preparationStatus === "ready" ? (locale === "ms" ? "Sedia" : "Ready") : preparationStatus === "unverified" ? (locale === "ms" ? "Tidak disahkan" : "Unverified") : preparationStatus === "preparing" ? (locale === "ms" ? "Menyediakan" : "Preparing") : "—"}</dd></div>
          </dl>
          <p className="mt-5 text-sm leading-6 text-[#53635c]">{locale === "ms" ? "Lokasi anda dan senarai kedai sementara kekal dalam sesi ini sahaja." : "Your location and temporary store preparation stay in this session only."}</p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[712px] gap-3">
          <button type="button" onClick={onBack} className="h-14 flex-[0.8] rounded-2xl border border-[#cbd8d1] bg-white text-[14px] font-bold text-[#087f5b]">
            {copy.back}
          </button>
          <button
            type="button"
            onClick={handleCompare}
            disabled={!selectedOrigin
              || searchState === "resolving"
              || searchState === "locating"
              || (preparationStatus !== "ready" && preparationStatus !== "unverified")
              || (preparationResponse?.candidateCount ?? 0) === 0}
            className="h-14 flex-1 rounded-2xl bg-[#087f5b] text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)] disabled:cursor-not-allowed disabled:bg-[#8aa69d] disabled:shadow-none"
          >
            {copy.shop}
          </button>
        </div>
      </div>
    </div>
  );
}

// AC 2.3.3/2.3.5/2.3.9: one reachable-store card — priced-basket amounts,
// travel estimates, SARA status and the expandable per-line price detail.
function StoreCard({
  store,
  isRecommended,
  pricesExpanded,
  onTogglePrices,
  onSelectStore,
  routeUrl,
  copy,
  transportMode,
}: {
  store: StoreRecommendation;
  isRecommended: boolean;
  pricesExpanded: boolean;
  onTogglePrices: () => void;
  onSelectStore: () => void;
  routeUrl?: string;
  copy: AppCopy;
  transportMode: TransportMode;
}) {
  const storeMedianPriceCount = medianPriceCount(store.basketPrices, store.medianPriceCount);
  const storeOfficialPriceCount = store.storePriceCount ?? Math.max(0, (store.pricedCount ?? 0) - storeMedianPriceCount);
  const hasMedianPrices = storeMedianPriceCount > 0;
  const totalLabel = store.missingItems.length > 0
    ? (hasMedianPrices ? copy.estimatedPartialTotal : copy.partialEstimatedTotal)
    : (storeOfficialPriceCount > 0 && hasMedianPrices ? copy.estimatedCombinedTotal : copy.combinedTotal);

  return (
    <article className={"relative overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(16,35,29,0.06)] " + (isRecommended ? "border-2 border-[#087f5b]" : "border-[#e2e9e5]")}>
      {isRecommended && (
        <div className="bg-[#087f5b] px-3 py-2 text-center">
          <span className="text-[13px] font-extrabold leading-5 text-white">{copy.recommendedStore}</span>
        </div>
      )}
      <div className="flex flex-col gap-4 px-4 pb-5 pt-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf3ef]"><IcoStore /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-extrabold leading-6 text-[#10231d] sm:text-[20px] sm:leading-7">{store.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SaraStoreTag status={store.saraStatus} copy={copy} />
              {store.exceedsLimit && (
                <span className="inline-flex self-start rounded-md bg-[#fff4ce] px-2 py-1 text-xs font-semibold text-[#7a4d00]">{copy.beyondTravelLimit}</span>
              )}
            </div>
            {(store.address || store.district || store.state) && (
              <p className="mt-2 text-[13px] leading-5 text-[#617069]">{[store.address, store.district, store.state].filter(Boolean).join(", ")}</p>
            )}
          </div>
        </div>

        {/* Keep travel details and basket subtotal together, then place the
            optional item-price disclosure directly below that row. */}
        <TripDetails
          store={store}
          copy={copy}
          basketSubtotal={store.basketSubtotalRm}
          basketLineCount={store.basketLineCount}
          medianPriceCount={storeMedianPriceCount}
          incomplete={store.missingItems.length > 0}
          transportMode={transportMode}
          routeUrl={routeUrl}
        />

        {(store.basketLineCount ?? 0) > 0 && store.basketPrices.length > 0 && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onTogglePrices}
                aria-expanded={pricesExpanded}
                className="min-h-8 w-full rounded-lg border border-[#cbd8d1] bg-white px-2 text-[9px] font-bold text-[#087f5b]"
              >
                {pricesExpanded ? copy.hidePriceList : copy.viewPriceList}
              </button>
            </div>
            {pricesExpanded && (
              <div className="-mt-2">
                {store.missingItems.length > 0 && (
                  <p className="mb-3 text-[13px] leading-5 text-[#5f6368]">{copy.missingItemPrices(store.missingItems.map(name => localizedName(copy, name, store.basketPrices.find(price => price.itemName === name))).join(", "))}</p>
                )}
                <CompactBasketPriceList prices={store.basketPrices} copy={copy} />
              </div>
            )}
          </>
        )}

        {store.combinedTotalRm != null && (
          <div className="rounded-2xl bg-[#087f5b] p-4 text-white shadow-[0_6px_18px_rgba(8,127,91,0.22)]">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#d3f0e4]">{totalLabel}</p>
                <p className="mt-1 text-xs leading-5 text-[#d3f0e4]">
                  ({copy.basketSubtotal}: {formatRm(store.basketSubtotalRm!)} + {copy.returnTravel}: {formatRm(store.estimatedRoundTripCostRm)})
                </p>
              </div>
              <p className="text-2xl font-extrabold leading-8 sm:text-right">{formatRm(store.combinedTotalRm!)}</p>
            </div>
          </div>
        )}

        {/* AC 2.4.1: primary "Select store" action — native button keeps
            keyboard and screen-reader access; always visible on every card */}
        <button
          type="button"
          onClick={onSelectStore}
          aria-label={copy.selectStore + " " + store.name}
          className="min-h-11 w-full rounded-xl bg-[#087f5b] px-5 text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)]"
        >
          {copy.selectStore}
        </button>
      </div>
    </article>
  );
}

function RecommendationBasketRow({
  row,
  basket,
  copy,
  onApplyAlternative,
  onApplyPack,
  onUndo,
}: {
  row: RecommendationDetailRow;
  basket: BasketItem[];
  copy: AppCopy;
  onApplyAlternative: (line: BasketAlternativeLine) => void;
  onApplyPack: (row: RecommendationDetailRow, packItemId: string) => void;
  onUndo: (row: RecommendationDetailRow) => void;
}) {
  const suggestion = row.alternatives;
  const alternative = suggestion.alternative;
  // A median baseline is useful for an estimate, but it is not a store price
  // against which savings or pack-value recommendations can be claimed.
  const hasMedianBaseline = row.source.priceSource === "median" || row.current.priceSource === "median";
  const lowerCostAvailable = Boolean(
    !hasMedianBaseline
    &&
    alternative
    && suggestion.savingsRm != null
    && suggestion.savingsRm > 0
    && alternative.itemId !== row.current.itemId,
  );
  const lowerCostDuplicate = alternative
    ? targetAlreadyInBasket(basket, row.source.itemId, alternative.itemId)
    : false;
  const eligibilityChanges = alternative ? (
    alternative.saraEligible !== row.current.saraEligible
    || alternative.saraCategoryCandidate !== row.current.saraCategoryCandidate
  ) : false;
  const packOptions = hasMedianBaseline ? [] : suggestion.packOptions ?? [];
  const bestPack = packOptions.find(pack => pack.isBestValue) ?? packOptions[0];
  const impactRm = row.basketItem ? currentReplacementImpactRm(row.basketItem) : null;

  return (
    <li className="border-b border-[#e2e9e5] py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-[14px] font-bold text-[#17362c]">{localizedName(copy, row.current.itemName, row.current)}</p>
            {row.replacement && (
              <span className="rounded-md bg-[#e7f7f0] px-2 py-0.5 text-[10px] font-extrabold text-[#17634f]">
                {row.replacement.kind === "pack" ? copy.packChanged : copy.swapped}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[#718078]">
            {packageSizeForCopy(copy, row.current.packageSize) ?? "—"}
            {row.replacement ? ` · ${copy.originally(localizedName(copy, row.replacement.original.name, row.replacement.original))}` : ""}
          </p>
          {row.current.priceSource === "median" && (
            <p className="mt-1 text-[11px] font-semibold text-[#7a5b00]">{copy.medianPriceEstimate}</p>
          )}
          <div className="mt-1">
            <SaraEligibilityFlag status={row.current.saraEligible} categoryCandidate={row.current.saraCategoryCandidate} copy={copy} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          {row.current.lineTotalRm != null && row.current.unitPriceRm != null ? (
            <>
              <p className="text-[16px] font-extrabold text-[#17362c]">{formatRm(row.current.lineTotalRm)}</p>
              <p className="text-[11px] text-[#718078]">{row.current.quantity} × {formatRm(row.current.unitPriceRm)}</p>
            </>
          ) : (
            <p className="max-w-28 text-xs font-semibold text-[#5f6368]">{copy.noStorePrice}</p>
          )}
        </div>
      </div>

      {row.replacement && row.basketItem && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f3faf7] px-3 py-2 text-xs text-[#286d67]">
          <span className="font-semibold">{replacementImpactText(copy, impactRm)}</span>
          <button type="button" onClick={() => onUndo(row)} className="min-h-9 font-extrabold text-[#087f5b] underline underline-offset-2">{copy.undoSwap}</button>
        </div>
      )}

      {lowerCostAvailable && alternative && suggestion.savingsRm != null && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl bg-[#f3faf7] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#286d67]">{copy.lowerPriceNow}</p>
            <p className="mt-0.5 break-words text-xs font-semibold text-[#17362c]">{localizedName(copy, alternative.itemName, alternative)}</p>
            <p className="text-[11px] text-[#718078]">{packageSizeForCopy(copy, alternative.packageSize ?? alternative.unit) ?? "—"}</p>
            <p className="mt-0.5 text-[11px] font-bold text-[#175f4b]">{copy.saveAmount(formatRm(suggestion.savingsRm))}</p>
            {eligibilityChanges && (
              <div className="mt-1"><SaraEligibilityFlag status={alternative.saraEligible} categoryCandidate={alternative.saraCategoryCandidate} copy={copy} /></div>
            )}
          </div>
          <button
            type="button"
            disabled={lowerCostDuplicate}
            onClick={() => onApplyAlternative(suggestion)}
            aria-label={`${copy.swapAndSave}: ${localizedName(copy, alternative.itemName, alternative)}`}
            className="min-h-11 shrink-0 rounded-lg bg-[#087f5b] px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#9db5ac]"
          >
            {lowerCostDuplicate ? copy.alreadyInBasket : copy.swapAndSave}
          </button>
        </div>
      )}

      {packOptions.length > 0 && bestPack && (
        <details className="mt-2 rounded-xl border border-[#dce5e0] bg-white">
          <summary className="cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#17362c]">{copy.comparePackSizes(packOptions.length)}</p>
                <p className="mt-0.5 break-words text-[11px] text-[#617069]">
                  {bestPack.itemId === row.current.itemId
                    ? copy.currentPackBestValue
                    : `${copy.bestUnitValue}: ${packageSizeForCopy(copy, bestPack.packageSize) ?? "—"} · ${bestPack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(bestPack.pricePerUnitRm), bestPack.unitKind) : "—"}`}
                </p>
              </div>
              <span aria-hidden="true" className="shrink-0 text-lg font-bold text-[#087f5b]">⌄</span>
            </div>
          </summary>
          <div className="grid gap-2 border-t border-[#e2e9e5] p-2 sm:grid-cols-2">
            {packOptions.map(pack => {
              const isCurrent = pack.itemId === row.current.itemId;
              const duplicate = targetAlreadyInBasket(basket, row.source.itemId, pack.itemId);
              const unitDifference = pack.totalPriceRm != null && row.current.unitPriceRm != null
                ? Number(((pack.totalPriceRm - row.current.unitPriceRm) * row.current.quantity).toFixed(2))
                : null;
              const upfrontText = unitDifference == null
                ? null
                : unitDifference > 0
                  ? copy.moreNow(formatRm(unitDifference))
                  : unitDifference < 0
                    ? copy.lessNow(formatRm(Math.abs(unitDifference)))
                    : copy.sameCostNow;
              return (
                <div key={pack.itemId} className={`flex min-w-0 flex-col rounded-lg p-3 ${isCurrent ? "bg-[#e7f7f0] ring-1 ring-[#087f5b]" : "bg-[#f7f8f6]"}`}>
                  <div className="flex flex-wrap gap-1">
                    {pack.isBestValue && <span className="rounded-md bg-[#087f5b] px-1.5 py-0.5 text-[9px] font-extrabold text-white">{copy.bestUnitValue}</span>}
                    {isCurrent && <span className="rounded-md bg-[#e2e9e5] px-1.5 py-0.5 text-[9px] font-extrabold text-[#53635c]">{copy.currentPack}</span>}
                  </div>
                  <p className="mt-1 break-words text-xs font-bold leading-4 text-[#17362c]">{localizedName(copy, pack.itemName, pack)}</p>
                  <p className="text-[11px] text-[#718078]">{packageSizeForCopy(copy, pack.packageSize) ?? "—"}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-[#17362c]">{pack.totalPriceRm != null ? formatRm(pack.totalPriceRm) : "—"}</p>
                      <p className="text-[10px] text-[#53635c]">{pack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(pack.pricePerUnitRm), pack.unitKind) : "—"}</p>
                      {upfrontText && !isCurrent && <p className="mt-0.5 text-[10px] font-semibold text-[#617069]">{upfrontText}</p>}
                    </div>
                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={duplicate}
                        onClick={() => onApplyPack(row, pack.itemId)}
                        aria-label={`${copy.choosePack}: ${localizedName(copy, pack.itemName, pack)}`}
                        className="min-h-11 shrink-0 rounded-lg border border-[#087f5b] bg-[#087f5b] px-2.5 text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:border-[#b8d3c6] disabled:bg-[#e8f4ee] disabled:text-[#245d4b]"
                      >
                        {duplicate ? copy.alreadyInBasket : copy.choosePack}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </li>
  );
}

// AC 2.4.1: Recommendation overview for the selected premise. The detail
// view keeps store identity, totals, item prices and savings actions together
// so the shopper can compare and swap without jumping between sections.
function RecommendationOverview({
  store,
  alternativeStores,
  recommendations,
  basket,
  activeChecklist,
  preferences,
  copy,
  costAssumptions,
  routeProvider,
  routeWarning,
  resultIsStale,
  onReviewAgain,
  onSetBasket,
  onCreateChecklist,
}: {
  store: StoreRecommendation;
  alternativeStores: StoreRecommendation[];
  recommendations: StoreRecommendation[];
  basket: BasketItem[];
  activeChecklist: ShoppingChecklist | null;
  preferences: TravelPreferences;
  copy: AppCopy;
  costAssumptions: Record<TransportMode, string> | undefined;
  routeProvider: "google" | "straight_line";
  routeWarning: string | null;
  resultIsStale: boolean;
  onReviewAgain: () => void;
  onSetBasket: Dispatch<SetStateAction<BasketItem[]>>;
  onCreateChecklist: (checklist: ShoppingChecklist) => void;
}) {
  const routeEstimateNote = routeProvider === "straight_line"
    ? copy.straightLineFallbackNote
    : copy.routeEstimateNote;
  const localizedRankingMethod = routeProvider === "straight_line" && basket.length > 0
    ? copy.fallbackRankingMethod
    : copy.rankingMethod;
  const localizedCostAssumption = getLocalizedCostAssumption(copy, preferences.transportMode, costAssumptions?.[preferences.transportMode]);
  const [alternativeLines, setAlternativeLines] = useState<BasketAlternativeLine[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(true);
  const [alternativesError, setAlternativesError] = useState(false);
  const [replaceChecklistOpen, setReplaceChecklistOpen] = useState(false);
  const alternativeRequestKey = JSON.stringify(toAlternativeLineRequests(basket));

  useEffect(() => {
    const requestedBasket = JSON.parse(alternativeRequestKey) as Array<{ itemId: string; quantity: number }>;
    if (requestedBasket.length === 0) {
      setAlternativeLines([]);
      setAlternativesLoading(false);
      return;
    }
    const controller = new AbortController();
    setAlternativesLoading(true);
    setAlternativesError(false);
    getBasketAlternatives(store.premiseId, requestedBasket, controller.signal)
      .then(response => setAlternativeLines(response.lines))
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAlternativeLines([]);
        setAlternativesError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setAlternativesLoading(false);
      });
    return () => controller.abort();
  }, [alternativeRequestKey, store.premiseId]);

  const detailRows = useMemo(
    () => buildRecommendationDetailRows(basket, store, alternativeLines),
    [alternativeLines, basket, store],
  );
  const detailTotals = useMemo(() => recommendationDetailTotals(detailRows), [detailRows]);
  const displayedSubtotal = detailRows.length > 0 ? detailTotals.currentSubtotalRm : store.basketSubtotalRm;
  const displayedCredit = detailRows.length > 0 ? detailTotals.saraCreditRm : store.saraCreditRm;
  const displayedCash = detailRows.length > 0 ? detailTotals.cashNeededRm : store.cashNeededRm;
  const displayedPricedCount = detailRows.length > 0 ? detailTotals.pricedCount : store.pricedCount ?? 0;
  const displayedMedianPriceCount = detailRows.length > 0
    ? detailTotals.medianPriceCount
    : store.medianPriceCount ?? store.basketPrices.filter(price => price.priceSource === "median" && price.lineTotalRm != null).length;
  const displayedStorePriceCount = detailRows.length > 0
    ? detailTotals.storePriceCount
    : store.storePriceCount ?? Math.max(0, displayedPricedCount - displayedMedianPriceCount);
  const displayedLineCount = detailRows.length > 0 ? detailTotals.lineCount : store.basketLineCount ?? 0;
  const hasIncompleteBasket = displayedLineCount > 0 && displayedPricedCount < displayedLineCount;
  const hasEstimatedPrices = displayedMedianPriceCount > 0;
  const totalLabel = hasIncompleteBasket
    ? (hasEstimatedPrices ? copy.estimatedPartialTotal : copy.partialEstimatedTotal)
    : (displayedStorePriceCount > 0 && hasEstimatedPrices ? copy.estimatedCombinedTotal : copy.combinedTotal);
  const adjustedCombinedTotal = displayedSubtotal == null
    ? null
    : Number((displayedSubtotal + store.estimatedRoundTripCostRm).toFixed(2));
  const savingsSnapshot = useMemo(
    () => calculateEstimatedSavingsSnapshot(store, recommendations, basket, {
      routeProvider,
      routeWarning,
    }),
    [basket, recommendations, routeProvider, routeWarning, store],
  );

  const applyAlternative = (line: BasketAlternativeLine) => {
    if (line.source.priceSource === "median") return;
    const choice = lowerCostReplacementChoice(line);
    if (!choice) return;
    onSetBasket(current => applyBasketReplacement(current, choice, { id: store.premiseId, name: store.name }));
  };

  const applyPack = (row: RecommendationDetailRow, packItemId: string) => {
    if (row.source.priceSource === "median" || row.current.priceSource === "median") return;
    const pack = row.alternatives.packOptions?.find(option => option.itemId === packItemId);
    const choice = pack ? packReplacementChoice(row.alternatives, pack) : null;
    if (!choice) return;
    onSetBasket(current => applyBasketReplacement(current, choice, { id: store.premiseId, name: store.name }));
  };

  const undoReplacement = (row: RecommendationDetailRow) => {
    if (!row.basketItem?.replacement) return;
    onSetBasket(current => undoBasketReplacement(current, row.basketItem!.id));
  };

  const createChecklist = () => {
    if (resultIsStale) return;
    onCreateChecklist(createShoppingChecklist(store, detailRows, {
      alternativeStores,
      savingsSnapshot,
    }));
    setReplaceChecklistOpen(false);
  };

  const beginChecklistCreation = () => {
    if (activeChecklist) {
      setReplaceChecklistOpen(true);
      return;
    }
    createChecklist();
  };

  return (
    <div className="screen-enter pb-8">
      <div className="flex flex-col gap-6 px-4 pb-6 pt-5 sm:gap-8 sm:px-6 sm:pt-8">
        {resultIsStale && (
          <div role="alert" className="rounded-2xl border border-[#efd3a6] bg-[#fff7e8] p-4 text-sm leading-6 text-[#7a4d00]">
            <p className="font-extrabold">{copy === COPY.ms ? "Bakul anda telah berubah" : "Your basket has changed"}</p>
            <p className="mt-1">{copy === COPY.ms
              ? "Semak bakul dan cari semula sebelum memilih kedai atau memulakan senarai semak."
              : "Review your basket and search again before selecting a store or starting a checklist."}</p>
            <button type="button" onClick={onReviewAgain} className="mt-3 min-h-11 rounded-xl border border-[#9b6a12] bg-white px-4 font-bold text-[#7a4d00]">
              {copy === COPY.ms ? "Semak dan cari semula" : "Review and search again"}
            </button>
          </div>
        )}
        <section className="rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5">
          <header className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3ef]"><IcoStore /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="break-words text-[23px] font-extrabold leading-7 tracking-[-0.4px] text-[#10231d] sm:text-[27px]">{store.name}</h1>
                  <div className="mt-2"><SaraStoreTag status={store.saraStatus} copy={copy} /></div>
                </div>
              </div>
              {(store.address || store.district || store.state) && (
                <p className="mt-1 truncate text-xs text-[#617069]">{[store.address, store.district, store.state].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </header>

          <div className="mt-4">
            <TripDetails
              store={store}
              copy={copy}
              basketSubtotal={displayedSubtotal}
              basketLineCount={displayedLineCount}
              incomplete={hasIncompleteBasket}
              showBasketSubtotal={false}
              transportMode={preferences.transportMode}
              routeUrl={preferences.origin ? mapsRouteUrl(preferences.origin, store, preferences.transportMode) : undefined}
            />
          </div>

          {displayedLineCount > 0 && (
            <section className="mt-4 overflow-hidden rounded-xl border border-[#dce5e0] bg-white">
              <div className={`px-4 py-3 ${hasIncompleteBasket ? "bg-[#f3f4f5]" : "bg-[#e7f7f0]"}`}>
                <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.basketItems}</h2>
              </div>

              <div className="px-4">
                {alternativesLoading && <p role="status" className="py-4 text-xs text-[#617069]">{copy.alternativesLoading}</p>}
                {alternativesError && <p role="alert" className="pt-4 text-xs text-[#93000a]">{copy.alternativesUnavailable}</p>}
                {detailRows.length > 0 ? (
                  <ul>
                    {detailRows.map(row => (
                      <RecommendationBasketRow
                        key={row.source.itemId}
                        row={row}
                        basket={basket}
                        copy={copy}
                        onApplyAlternative={applyAlternative}
                        onApplyPack={applyPack}
                        onUndo={undoReplacement}
                      />
                    ))}
                  </ul>
                ) : !alternativesLoading && store.basketPrices.length > 0 ? (
                  <div className="py-3"><CompactBasketPriceList prices={store.basketPrices} copy={copy} /></div>
                ) : null}
              </div>

              <div className="border-t border-[#dce5e0] bg-white px-4 py-3">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <p className="text-xs text-[#617069]">
                      {hasIncompleteBasket
                        ? (hasEstimatedPrices ? copy.estimatedPartialTotal : copy.partialTotal)
                        : (hasEstimatedPrices ? copy.estimatedSubtotal : copy.basketSubtotal)}
                    </p>
                    <p className="mt-0.5 text-xl font-extrabold text-[#175f4b]">{displayedSubtotal == null ? "—" : formatRm(displayedSubtotal)}</p>
                  </div>
                  {displayedCredit != null && displayedCash != null && (
                    <div className="grid grid-cols-2 sm:min-w-[250px]">
                      <div className="pr-4">
                        <p className="text-[11px] leading-4 text-[#617069]">{copy.saraCreditLabel}</p>
                        <p className="mt-0.5 text-base font-extrabold text-[#286d67]">{formatRm(displayedCredit)}</p>
                      </div>
                      <div className="border-l border-[#dce5e0] pl-4">
                        <p className="text-[11px] leading-4 text-[#617069]">{copy.cashNeededLabel}</p>
                        <p className="mt-0.5 text-base font-extrabold text-[#17362c]">{formatRm(displayedCash)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <CompactSavingsFooter
                copy={copy}
                hasReplacements={detailTotals.hasReplacements}
                comparable={detailTotals.savingsComparable}
                originalRm={detailTotals.originalSubtotalRm}
                newRm={detailTotals.currentSubtotalRm}
                netSavingRm={detailTotals.netSavingRm}
                totalsLabel={hasIncompleteBasket
                  ? (hasEstimatedPrices ? copy.estimatedPartialTotal : copy.partialTotal)
                  : (hasEstimatedPrices ? copy.estimatedSubtotal : copy.basketSubtotal)}
              />
            </section>
          )}

          {displayedLineCount > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={beginChecklistCreation}
                disabled={alternativesLoading || resultIsStale}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087f5b] px-4 text-sm font-extrabold text-white shadow-[0_4px_12px_rgba(8,127,91,0.2)] disabled:cursor-not-allowed disabled:bg-[#9eb0a7] disabled:shadow-none"
              >
                <IcoChecklist color="white" />
                {alternativesLoading
                  ? copy.checklistPreparing
                  : activeChecklist
                    ? copy.replaceChecklist
                    : copy.createChecklist}
              </button>
            </div>
          )}

          {adjustedCombinedTotal != null && (
            <div className="mt-4 rounded-2xl bg-[#087f5b] p-4 text-white shadow-[0_6px_18px_rgba(8,127,91,0.22)]">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#d3f0e4]">{totalLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-[#d3f0e4]">
                    ({copy.basketSubtotal}: {formatRm(displayedSubtotal!)} + {copy.returnTravel}: {formatRm(store.estimatedRoundTripCostRm)})
                  </p>
                </div>
                <p className="text-2xl font-extrabold leading-8 sm:text-right">{formatRm(adjustedCombinedTotal!)}</p>
              </div>
            </div>
          )}

          <details className="mt-4 border-t border-[#e2e9e5] pt-3 text-xs">
            <summary className="cursor-pointer font-bold text-[#17362c]">{copy.calculationTitle}</summary>
            <p className="mt-2 leading-5 text-[#53635c]">{localizedRankingMethod}</p>
            <p className="mt-2 leading-5 text-[#53635c]">{localizedCostAssumption}</p>
            <p className="mt-2 leading-5 text-[#53635c]">{routeEstimateNote} {copy.stockNotVerified}</p>
          </details>
        </section>
        {!resultIsStale && <SavingsEstimatePanel snapshot={savingsSnapshot} locale={copy === COPY.ms ? "ms" : "en"} />}
      </div>
      <ConfirmationDialog
        open={replaceChecklistOpen}
        title={copy.replaceChecklist}
        body={copy.replaceChecklistConfirm}
        confirmLabel={copy.replaceChecklist}
        cancelLabel={copy.cancel}
        destructive
        onCancel={() => setReplaceChecklistOpen(false)}
        onConfirm={createChecklist}
      />
    </div>
  );
}

function CompareScreen({
  basket,
  setBasket,
  activeChecklist,
  onCreateChecklist,
  selectedStore,
  setSelectedStore,
  selectedPremiseId,
  onOpenStore,
  candidatePreparation,
  onPreparationChange,
  preferences,
  onReviewAgain,
  onChangeTravel,
  copy,
}: {
  basket: BasketItem[];
  setBasket: Dispatch<SetStateAction<BasketItem[]>>;
  activeChecklist: ShoppingChecklist | null;
  onCreateChecklist: (checklist: ShoppingChecklist) => void;
  selectedStore: StoreRecommendation | null;
  setSelectedStore: Dispatch<SetStateAction<StoreRecommendation | null>>;
  selectedPremiseId: string | null;
  onOpenStore: (store: StoreRecommendation) => void;
  candidatePreparation: CandidatePreparationResponse | null;
  onPreparationChange: (preparation: CandidatePreparationResponse | null) => void;
  preferences: TravelPreferences;
  onReviewAgain: () => void;
  onChangeTravel: () => void;
  copy: AppCopy;
}) {
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  // One price disclosure is expanded at a time.
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  // AC 2.3.1: only real catalogue items ("db-" ids) are priced; mock rows are
  // filtered out. Empty after filtering -> request without a basket, keeping
  // transport-first ranking.
  const basketLines = useMemo(() => toBasketLineRequests(basket), [basket]);
  const [requestBasketLines] = useState(() => basketLines);
  const hasBasket = requestBasketLines.length > 0;
  const candidatePreparationRef = useRef(candidatePreparation);
  candidatePreparationRef.current = candidatePreparation;
  const requestCopyRef = useRef(copy);
  requestCopyRef.current = copy;
  const basketIsStale = JSON.stringify(basketLines) !== JSON.stringify(requestBasketLines);

  useEffect(() => {
    const requestCopy = requestCopyRef.current;
    if (!preferences.origin) {
      setError(requestCopy.chooseStartingLocation);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    // AC 2.3.2: a fresh recommendation list starts again at the first five.
    setVisibleCount(VISIBLE_STEP);
    setExpandedStoreId(null);

    const loadRecommendations = async () => {
      try {
        const preparation = candidatePreparationRef.current;
        if (!preparation || Date.parse(preparation.expiresAt) <= Date.now()) {
          onPreparationChange(null);
          setError(requestCopy === COPY.ms
            ? "Persediaan perjalanan telah tamat tempoh. Sila sediakan semula tetapan perjalanan."
            : "Your travel preparation expired. Please prepare your travel settings again.");
          return;
        }
        const payload = {
          ...(requestBasketLines.length > 0 ? { basket: requestBasketLines } : {}),
          candidatePreparationId: preparation.preparationId,
        };
        const response = await getRecommendations(payload, controller.signal);
        if (controller.signal.aborted) return;
        setResult(response);
        setVisibleCount(VISIBLE_STEP);
        setExpandedStoreId(null);
      } catch (requestError) {
        if (controller.signal.aborted || (requestError instanceof DOMException && requestError.name === "AbortError")) return;
        if (requestError instanceof SmartCartApiError && requestError.code === "CANDIDATE_PREPARATION_EXPIRED") {
          onPreparationChange(null);
          setError(requestCopy === COPY.ms
            ? "Persediaan perjalanan telah tamat tempoh. Sila sediakan semula tetapan perjalanan."
            : "Your travel preparation expired. Please prepare your travel settings again.");
        } else {
          setError(requestCopy.recommendationsUnavailable);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadRecommendations();

    return () => controller.abort();
  }, [requestBasketLines, onPreparationChange, preferences]);

  const recommendations = useMemo(() => result?.recommendations ?? [], [result]);
  useEffect(() => {
    if (!selectedPremiseId || loading || !result) return;
    setSelectedStore(recommendations.find(store => store.premiseId === selectedPremiseId) ?? null);
  }, [loading, recommendations, result, selectedPremiseId, setSelectedStore]);
  const recommendedStore = recommendations.find(store => (store.pricedCount ?? 0) > 0);
  const visibleStores = recommendations.slice(0, visibleCount);
  const modeLabel = transportLabel(copy, preferences.transportMode) || copy.selectedTransport;
  const originLabel = preferences.origin?.label ?? "";
  const limitLabel = preferences.limitType === "both"
    ? `${preferences.distanceKm} km · ${preferences.timeMinutes} ${copy.minutes}`
    : preferences.limitType === "distance"
    ? preferences.limitValue + " km"
    : preferences.limitValue + " " + copy.minutes;
  const localizedRankingMethod = result?.routeProvider === "straight_line" && hasBasket
    ? copy.fallbackRankingMethod
    : copy.rankingMethod;
  const localizedCostAssumption = getLocalizedCostAssumption(copy, preferences.transportMode, result?.costAssumptions?.[preferences.transportMode]);

  // AC 2.4.1: once a store is selected the overview replaces the list. It
  // renders the saved snapshot, so a background refresh of the list can
  // never swap the premise, basket or travel preferences underneath it;
  // going back simply clears the snapshot and the list reappears as-is.
  if (selectedStore) {
    return (
      <RecommendationOverview
        store={selectedStore}
        alternativeStores={recommendations.filter(store => store.premiseId !== selectedStore.premiseId)}
        recommendations={recommendations}
        basket={basket}
        activeChecklist={activeChecklist}
        onSetBasket={setBasket}
        onCreateChecklist={onCreateChecklist}
        preferences={preferences}
        copy={copy}
        costAssumptions={result?.costAssumptions}
        routeProvider={result?.routeProvider ?? "google"}
        routeWarning={result?.routeWarning ?? null}
        resultIsStale={basketIsStale}
        onReviewAgain={onReviewAgain}
      />
    );
  }

  return (
    <div className="screen-enter pb-8">
      <div className="flex flex-col gap-6 px-4 pb-6 pt-5 sm:gap-8 sm:px-6 sm:pt-8">
        <div>
          <ProgressIndicator step={4} copy={copy} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-[#087f5b]">{copy.recommendationEyebrow}</p>
          <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">
            {copy.recommendationTitle}
          </h1>
          <p className="text-[15px] leading-6 text-[#53635c]">
            {result?.routeProvider === "straight_line" ? copy.straightLineFallbackNote : copy.storesWithinLimit(limitLabel, originLabel, modeLabel)}
          </p>
          {preferences.saraFilter === "candidate" && (
            <p className="text-sm font-medium text-[#7a5b00]">{copy.saraFilterApplied}</p>
          )}
        </div>

        {loading && (
          <div role="status" className="rounded-2xl border border-[#dce5e0] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#cce3d9] border-t-[#087f5b]" />
            <p className="font-bold text-[#17362c]">{copy.checkingStores}</p>
            <p className="mt-1 text-sm text-[#617069]">{copy.routeTimesNote}</p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-[#f0b8b8] bg-[#fff5f5] p-5 text-center">
            <div className="mx-auto mb-2 flex w-fit items-center gap-2 font-bold text-[#93000a]"><IcoWarn /> {copy.recommendationUnavailable}</div>
            <p className="text-sm leading-5 text-[#6f3030]">{error}</p>
            <button type="button" onClick={onChangeTravel} className="mt-4 min-h-11 rounded-xl border border-[#ba1a1a] bg-white px-4 text-sm font-bold text-[#93000a]">{copy.changeTravel}</button>
          </div>
        )}

        {!loading && !error && result && (
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{result.routeProvider === "straight_line" ? copy.nearbyStores : copy.reachablePremises}</h2>
                <p className="mt-1 text-sm text-[#617069]">{result.routeProvider === "straight_line" ? `${recommendations.length} / ${result.totalCandidatesEvaluated}` : copy.reachableSummary(recommendations.length, result.totalCandidatesEvaluated)}</p>
              </div>
              <span className="text-right text-xs font-medium text-[#718078]">{hasBasket ? copy.lowerTravelFirst : "Lower travel cost first"}</span>
            </div>

            <div className="flex flex-col gap-3">
              {visibleStores.map(store => (
                <StoreCard
                  key={store.premiseId}
                  store={store}
                  isRecommended={recommendedStore?.premiseId === store.premiseId}
                  routeUrl={preferences.origin ? mapsRouteUrl(preferences.origin, store, preferences.transportMode) : undefined}
                  pricesExpanded={expandedStoreId === store.premiseId}
                  onTogglePrices={() => setExpandedStoreId(current => (current === store.premiseId ? null : store.premiseId))}
                  onSelectStore={() => onOpenStore(store)}
                  copy={copy}
                  transportMode={preferences.transportMode}
                />
              ))}

              {/* Page the unified ranking five stores at a time. */}
              {hasMoreStores(visibleCount, recommendations.length) && (
                <button type="button" onClick={() => setVisibleCount(count => nextVisibleCount(count, recommendations.length))} className="h-12 w-full rounded-xl border border-[#087f5b] bg-white text-sm font-bold text-[#087f5b]">
                  {copy.moreStores}
                </button>
              )}

              {recommendations.length === 0 && (
                <div className="rounded-2xl border border-[#bec8ca] bg-white p-5 text-center">
                  <p className="font-semibold text-[#191c1d]">{copy.noStores}</p>
                  <p className="mt-1 text-sm text-[#617069]">{copy.noStoresHint}</p>
                  <button type="button" onClick={onChangeTravel} className="mt-3 min-h-11 px-3 font-bold text-[#00535b]">{copy.changeTravel}</button>
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && !error && result && (
          <details className="rounded-2xl border border-[#dce5e0] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-bold text-[#17362c]">{copy.calculationTitle}</summary>
            <p className="mt-3 leading-5 text-[#53635c]">{localizedRankingMethod}</p>
            <p className="mt-2 leading-5 text-[#53635c]">{localizedCostAssumption}</p>
            <p className="mt-2 leading-5 text-[#53635c]">{result.routeProvider === "straight_line" ? copy.straightLineFallbackNote : copy.routeEstimateNote}</p>
          </details>
        )}
      </div>
    </div>
  );
}

function AppCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-3xl border border-[#e0e9e4] bg-white p-5 shadow-[0_8px_28px_rgba(16,35,29,0.045)] sm:p-7 ${className}`}>{children}</section>;
}

function SavingsEstimatePanel({ snapshot, locale }: { snapshot: EstimatedSavingsSnapshot | null; locale: Locale }) {
  const isMs = locale === "ms";
  return <section aria-label={isMs ? "Anggaran penjimatan" : "Estimated savings"} className="rounded-2xl border border-[#b8ddcc] bg-[#eff8f3] p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold text-[#286d67]">{isMs ? "Anggaran penjimatan" : "Estimated savings"}</p><p className="mt-1 text-3xl font-extrabold tracking-tight text-[#175f4b]">{snapshot?.totalEstimatedSavingsRm == null ? "—" : formatRm(snapshot.totalEstimatedSavingsRm)}</p></div><p className="text-xs font-semibold text-[#53635c]">{snapshot && snapshot.comparableStoreCount >= 2 ? (isMs ? `Median ${snapshot.comparableStoreCount} kedai setara` : `Median across ${snapshot.comparableStoreCount} comparable stores`) : (isMs ? "Data kedai setara terhad" : "Limited comparable store data")}</p></div>
    <div className="mt-4 grid gap-2 border-t border-[#d3e9dd] pt-3 text-sm sm:grid-cols-2"><p className="flex justify-between gap-3"><span className="text-[#53635c]">{isMs ? "Pilihan kedai" : "Store choice"}</span><strong className="text-[#17362c]">{snapshot?.storeChoiceSavingsRm == null ? "—" : formatRm(snapshot.storeChoiceSavingsRm)}</strong></p><p className="flex justify-between gap-3"><span className="text-[#53635c]">{isMs ? "Penggantian item" : "Swaps"}</span><strong className="text-[#17362c]">{snapshot && snapshot.comparableSwapCount > 0 ? formatRm(snapshot.swapSavingsRm) : "—"}</strong></p></div>
    {snapshot && <details className="mt-3 border-t border-[#d3e9dd] pt-3 text-xs leading-5 text-[#617069]"><summary className="cursor-pointer font-bold">{isMs ? "Bagaimana anggaran ini dikira" : "How this estimate is calculated"}</summary><p className="mt-2">{snapshot.disclosures.estimatedTravelIncluded ? (isMs ? "Jumlah termasuk anggaran kos perjalanan pergi balik." : "Combined totals include estimated return travel.") : (isMs ? "Kos perjalanan tidak tersedia dalam anggaran ini." : "Travel cost was not available in this estimate.")} {snapshot.disclosures.medianPriceCount > 0 ? (isMs ? `${snapshot.disclosures.medianPriceCount} harga item menggunakan median dan merupakan anggaran.` : `${snapshot.disclosures.medianPriceCount} item prices use market medians and are estimates.`) : ""}</p>{snapshot.disclosures.routeWarning && <p className="mt-2">{snapshot.disclosures.routeWarning}</p>}</details>}
  </section>;
}

function HomeDashboard({
  checklist,
  history,
  unreadCount,
  locale,
  hasDraft,
  onStartTrip,
  onContinueTrip,
  onStartNewTrip,
}: {
  checklist: ShoppingChecklist | null;
  history: TripRecord[];
  unreadCount: number;
  locale: Locale;
  hasDraft: boolean;
  onStartTrip: () => void;
  onContinueTrip: () => void;
  onStartNewTrip: () => void;
}) {
  const isMs = locale === "ms";
  const progress = checklist ? checklistProgress(checklist) : null;
  const recent = listTripRecords(history).slice(0, 3);
  const tripLabel = hasDraft ? (isMs ? "Teruskan perjalanan membeli-belah" : "Continue your shopping trip") : (isMs ? "Mulakan perjalanan membeli-belah" : "Start a shopping trip");
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-8 sm:px-7 lg:px-12 lg:pt-12">
      <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#087f5b]">SmartCart</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.06em] text-[#10231d] sm:text-5xl">{isMs ? "Selamat datang kembali" : "Welcome back"}</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#53635c]">{isMs ? "Rancang barangan rumah, semak senarai anda dan lihat sejarah perbelanjaan." : "Plan household essentials, pick up your checklist, and keep an eye on past spending."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/checklist" className="inline-flex min-h-11 items-center rounded-xl border border-[#cbd8d1] bg-white px-4 text-sm font-bold text-[#087f5b] hover:bg-[#edf7f2]">{isMs ? "Senarai semak" : "Checklist"}</Link>
          <Link href="/history" className="inline-flex min-h-11 items-center rounded-xl border border-[#cbd8d1] bg-white px-4 text-sm font-bold text-[#087f5b] hover:bg-[#edf7f2]">{isMs ? "Sejarah" : "History"}</Link>
          <Link href="/inbox" className="inline-flex min-h-11 items-center rounded-xl border border-[#cbd8d1] bg-white px-4 text-sm font-bold text-[#087f5b] hover:bg-[#edf7f2]">{isMs ? "Peti masuk" : "Inbox"}{unreadCount > 0 && <span className="ml-2 rounded-full bg-[#e8590c] px-2 py-0.5 text-xs text-white">{unreadCount}</span>}</Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <AppCard className="relative overflow-hidden !bg-[#087f5b] text-white lg:col-span-7 lg:min-h-[330px] lg:p-9">
          <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[36px] border-white/10" />
          <p className="relative text-sm font-extrabold uppercase tracking-[0.14em] text-[#bce9d7]">{isMs ? "Perancangan membeli-belah" : "Shopping planner"}</p>
          <h2 className="relative mt-3 max-w-xl text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{tripLabel}</h2>
          <p className="relative mt-3 max-w-xl leading-6 text-[#d7efe5]">{hasDraft ? (isMs ? "Perjalanan anda masih tersedia pada peranti ini. Sambung dari langkah terakhir." : "Your trip draft is still available in this session. Continue from where you left off.") : (isMs ? "Pilih cara perjalanan dahulu, kemudian bina bakul dan bandingkan kedai yang boleh dicapai." : "Set your travel preferences, build a basket, then compare stores you can reach.")}</p>
          <div className="relative mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={hasDraft ? onContinueTrip : onStartTrip} className="min-h-12 rounded-xl bg-white px-5 text-sm font-extrabold text-[#087f5b] shadow-sm hover:bg-[#eff8f4]">{hasDraft ? (isMs ? "Teruskan" : "Continue trip") : (isMs ? "Mulakan perjalanan" : "Start a trip")}</button>
            {hasDraft && <button type="button" onClick={onStartNewTrip} className="min-h-12 rounded-xl border border-white/50 bg-white/10 px-5 text-sm font-bold text-white hover:bg-white/20">{isMs ? "Perjalanan baharu" : "Start new trip"}</button>}
          </div>
        </AppCard>

        <Link href="/checklist" className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b] lg:col-span-5">
          <AppCard className="h-full transition-colors group-hover:border-[#9fcdb9]">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-bold text-[#687970]">{isMs ? "Perjalanan semasa" : "Current trip"}</p><h2 className="mt-2 text-2xl font-extrabold text-[#17362c]">{isMs ? "Senarai semak" : "Shopping checklist"}</h2></div>
              <span className="rounded-xl bg-[#e7f7f0] px-3 py-2 text-sm font-extrabold text-[#087f5b]">{checklist?.items.length ?? 0}</span>
            </div>
            {checklist && progress ? <><p className="mt-5 font-bold text-[#17362c]">{checklist.store.name}</p><p className="mt-1 text-sm text-[#617069]">{isMs ? `${progress.bought}/${progress.total} selesai` : `${progress.bought} of ${progress.total} complete`}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e7efeb]"><div className="h-full rounded-full bg-[#087f5b]" style={{ width: `${progress.total ? (progress.bought / progress.total) * 100 : 0}%` }} /></div></> : <p className="mt-5 text-sm leading-6 text-[#617069]">{isMs ? "Senarai yang anda mulakan akan muncul di sini." : "Your active checklist will appear here when you start one."}</p>}
            <p className="mt-5 text-sm font-extrabold text-[#087f5b]">{isMs ? "Buka senarai →" : "Open checklist →"}</p>
          </AppCard>
        </Link>

        <Link href="/history" className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b] lg:col-span-7">
          <AppCard className="h-full transition-colors group-hover:border-[#9fcdb9]">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#687970]">{isMs ? "Perbelanjaan lalu" : "Past spending"}</p><h2 className="mt-2 text-2xl font-extrabold text-[#17362c]">{isMs ? "Sejarah membeli-belah" : "Shopping history"}</h2></div><span className="text-sm font-bold text-[#087f5b]">{history.length} {isMs ? "rekod" : history.length === 1 ? "trip" : "trips"}</span></div>
            {recent.length ? <ul className="mt-5 divide-y divide-[#e6ede9]">{recent.map(record => <li key={record.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate font-bold text-[#17362c]">{record.store.name}</p><p className="mt-1 text-xs text-[#718078]">{new Intl.DateTimeFormat(isMs ? "ms-MY" : "en-MY", { dateStyle: "medium" }).format(new Date(record.recordedAt))}</p></div><span className="shrink-0 font-extrabold text-[#17362c]">{record.actualTotalRm == null ? "—" : formatRm(record.actualTotalRm)}</span></li>)}</ul> : <p className="mt-5 text-sm leading-6 text-[#617069]">{isMs ? "Rekod perjalanan yang disimpan akan muncul di sini." : "Recorded trips and known spending will appear here."}</p>}
          </AppCard>
        </Link>

        <Link href="/inbox" className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f5b] lg:col-span-5">
          <AppCard className="h-full bg-[#f2f8f4] transition-colors group-hover:border-[#9fcdb9]">
            <p className="text-sm font-bold text-[#687970]">{isMs ? "Kemas kini akaun" : "Account updates"}</p><div className="mt-2 flex items-center justify-between gap-3"><h2 className="text-2xl font-extrabold text-[#17362c]">{isMs ? "Peti masuk" : "Inbox"}</h2><span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[#087f5b]">{unreadCount} {isMs ? "belum dibaca" : "unread"}</span></div><p className="mt-4 text-sm leading-6 text-[#617069]">{isMs ? "Laporan simpanan dan perbelanjaan mingguan atau bulanan akan tersedia di sini." : "Weekly and monthly savings and spending reports will be collected here."}</p><p className="mt-5 text-sm font-extrabold text-[#087f5b]">{isMs ? "Buka peti masuk →" : "Open inbox →"}</p>
          </AppCard>
        </Link>
      </div>
    </div>
  );
}

function TripHistoryScreen({ records, locale }: { records: TripRecord[]; locale: Locale }) {
  const isMs = locale === "ms";
  const ordered = listTripRecords(records);
  return <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-8 sm:px-7 lg:px-12 lg:pt-12"><div className="mb-7"><p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#087f5b]">{isMs ? "Perjalanan lalu" : "Past trips"}</p><h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] text-[#10231d]">{isMs ? "Sejarah membeli-belah" : "Shopping history"}</h1><p className="mt-3 text-[#617069]">{isMs ? "Jumlah perbelanjaan menggunakan harga sebenar yang anda rekodkan sahaja." : "Spending totals include only actual prices you recorded."}</p></div>
    {ordered.length === 0 ? <AppCard><p className="font-bold text-[#17362c]">{isMs ? "Belum ada perjalanan direkodkan." : "No trips recorded yet."}</p><p className="mt-2 text-sm text-[#617069]">{isMs ? "Rekodkan perjalanan daripada senarai semak untuk melihatnya di sini." : "Record a trip from your checklist to see it here."}</p><Link href="/trip/travel" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#087f5b] px-4 text-sm font-bold text-white">{isMs ? "Mulakan perjalanan" : "Start a trip"}</Link></AppCard> : <div className="grid gap-4 lg:grid-cols-2">{ordered.map(record => <AppCard key={record.id} className="!p-0"><details className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-7"><div className="min-w-0"><p className="truncate text-xl font-extrabold text-[#17362c]">{record.store.name}</p><p className="mt-1 text-sm text-[#718078]">{new Intl.DateTimeFormat(isMs ? "ms-MY" : "en-MY", { dateStyle: "long", timeStyle: "short" }).format(new Date(record.recordedAt))}</p><p className="mt-2 text-xs text-[#617069]">{record.lines.filter(line => line.status === "bought").length}/{record.lines.length} {isMs ? "dibeli" : "items bought"}</p></div><div className="shrink-0 text-right"><p className="text-xs font-bold uppercase tracking-wide text-[#718078]">{isMs ? "Perbelanjaan sebenar" : "Actual spending"}</p><p className="mt-1 text-xl font-extrabold text-[#087f5b]">{record.actualTotalRm == null ? "—" : formatRm(record.actualTotalRm)}</p>{record.savingsSnapshot?.totalEstimatedSavingsRm != null && <p className="mt-1 text-xs font-bold text-[#087f5b]">{isMs ? "Anggaran simpanan" : "Estimated savings"} {formatRm(record.savingsSnapshot.totalEstimatedSavingsRm)}</p>}<span className="mt-2 block text-xs font-bold text-[#087f5b] group-open:hidden">{isMs ? "Butiran ↓" : "Details ↓"}</span></div></summary><div className="border-t border-[#e6ede9] px-5 py-4 sm:px-7">{record.savingsSnapshot && <SavingsEstimatePanel snapshot={record.savingsSnapshot} locale={locale} />}<p className="mb-2 mt-4 text-xs text-[#718078]">{isMs ? "Jumlah baris menggunakan harga sebenar yang diketahui sahaja." : "Line totals show known actual prices only."}</p>{record.lines.length ? <ul className="divide-y divide-[#e6ede9]">{record.lines.map(line => <li key={line.id} className="flex justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="font-bold text-[#17362c]">{line.itemName}</p><p className="mt-1 text-xs text-[#718078]">{line.quantity} × {line.status === "bought" ? (isMs ? "dibeli" : "bought") : line.status === "not_bought" ? (isMs ? "tidak dibeli" : "not bought") : (isMs ? "belum selesai" : "unfinished")}</p></div><span className="shrink-0 font-extrabold text-[#17362c]">{line.actualLineTotalRm == null ? "—" : formatRm(line.actualLineTotalRm)}</span></li>)}</ul> : <p className="text-sm text-[#617069]">{isMs ? "Tiada item dalam rekod ini." : "This record has no items."}</p>}</div></details></AppCard>)}</div>}
  </div>;
}

function InboxScreen({ messages, locale, onRead }: { messages: InboxMessage[]; locale: Locale; onRead: (id: string) => void }) {
  const isMs = locale === "ms";
  return <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-8 sm:px-7 lg:px-12 lg:pt-12"><div className="mb-7"><p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#087f5b]">SmartCart</p><h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] text-[#10231d]">{isMs ? "Peti masuk" : "Inbox"}</h1><p className="mt-3 text-[#617069]">{isMs ? "Laporan simpanan dan perbelanjaan anda akan dihantar ke sini." : "Your savings and spending reports will be delivered here."}</p></div>
    {messages.length === 0 ? <AppCard><div className="mx-auto max-w-xl py-8 text-center"><span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7f7f0] text-2xl text-[#087f5b]">✉</span><h2 className="mt-4 text-xl font-extrabold text-[#17362c]">{isMs ? "Peti masuk anda kosong" : "Your inbox is clear"}</h2><p className="mt-2 text-sm leading-6 text-[#617069]">{isMs ? "Laporan mingguan atau bulanan akan muncul di sini apabila tersedia." : "Weekly or monthly reports will appear here when they’re available."}</p></div></AppCard> : <div className="grid gap-4 lg:grid-cols-2">{messages.map(message => <button type="button" key={message.id} onClick={() => onRead(message.id)} className={`rounded-3xl border p-5 text-left shadow-[0_8px_28px_rgba(16,35,29,0.045)] transition-colors sm:p-7 ${message.readAt ? "border-[#e0e9e4] bg-white" : "border-[#aad6c2] bg-[#f2f8f4]"}`}><div className="flex items-start justify-between gap-4"><div><span className="text-xs font-extrabold uppercase tracking-wide text-[#087f5b]">{message.type === "weekly_report" ? (isMs ? "Laporan mingguan" : "Weekly report") : (isMs ? "Laporan bulanan" : "Monthly report")}</span><h2 className="mt-2 text-xl font-extrabold text-[#17362c]">{message.title}</h2></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#087f5b]">{message.readAt ? (isMs ? "Dibaca" : "Read") : (isMs ? "Baharu" : "New")}</span></div><p className="mt-3 leading-6 text-[#53635c]">{message.summary}</p><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-white/80 p-3 text-sm"><p><span className="block text-xs text-[#718078]">{isMs ? "Perbelanjaan" : "Spending"}</span><strong className="text-[#17362c]">{message.spendingRm == null ? "—" : formatRm(message.spendingRm)}</strong></p><p><span className="block text-xs text-[#718078]">{isMs ? "Penjimatan" : "Savings"}</span><strong className="text-[#17362c]">{message.savingsRm == null ? "—" : formatRm(message.savingsRm)}</strong></p></div><p className="mt-4 text-xs text-[#718078]">{new Intl.DateTimeFormat(isMs ? "ms-MY" : "en-MY", { dateStyle: "medium" }).format(new Date(message.createdAt))} · {new Intl.DateTimeFormat(isMs ? "ms-MY" : "en-MY", { dateStyle: "medium" }).format(new Date(message.periodStart))}–{new Intl.DateTimeFormat(isMs ? "ms-MY" : "en-MY", { dateStyle: "medium" }).format(new Date(message.periodEnd))}</p></button>)}</div>}
  </div>;
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const pathname = usePathname();
  const router = useRouter();
  const screen = routeScreen(pathname);
  const go = (path: string) => router.push(path);
  const [basket, setBasket] = useState<BasketItem[]>(INIT_BASKET);
  const [selectedStore, setSelectedStore] = useState<StoreRecommendation | null>(null);
  const [checklist, setChecklist] = useState<ShoppingChecklist | null>(null);
  const [checklistStorageReady, setChecklistStorageReady] = useState(false);
  const [tripHistory, setTripHistory] = useState<TripRecord[]>([]);
  const [tripHistoryStorageReady, setTripHistoryStorageReady] = useState(false);
  const [tripNotification, setTripNotification] = useState({ id: 0, message: "" });
  const [locale, setLocale] = useState<Locale>("en");
  const [preferences, setPreferences] = useState<TravelPreferences>(DEFAULT_PREFERENCES);
  const [candidatePreparation, setCandidatePreparation] = useState<CandidatePreparationResponse | null>(null);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxStorageReady, setInboxStorageReady] = useState(false);

  const acceptCandidatePreparation = useCallback((preparation: CandidatePreparationResponse | null) => {
    setCandidatePreparation(current => {
      if (current?.preparationId && current.preparationId !== preparation?.preparationId) {
        void deleteRecommendationCandidates(current.preparationId).catch(() => undefined);
      }
      return preparation;
    });
  }, []);

  useEffect(() => {
    if (pathname === "/planner") router.replace("/trip/travel");
    window.scrollTo(0, 0);
  }, [pathname, router]);

  useEffect(() => {
    if (screen !== "shop" && screen !== "basket" && screen !== "compare") return;
    const preparationIsUsable = candidatePreparation != null
      && candidatePreparation.candidateCount > 0
      && Date.parse(candidatePreparation.expiresAt) > Date.now();
    if (!preferences.origin || !preparationIsUsable) {
      router.replace("/trip/travel");
      return;
    }
    if (screen === "compare" && basket.length === 0) {
      router.replace("/trip/review");
    }
  }, [basket.length, candidatePreparation, preferences.origin, router, screen]);

  useEffect(() => {
    if (!pathname.startsWith("/trip/results/")) setSelectedStore(null);
  }, [pathname]);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("smartcart-locale");
    if (savedLocale === "en" || savedLocale === "ms") setLocale(savedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "ms" ? "ms-MY" : "en-MY";
    window.localStorage.setItem("smartcart-locale", locale);
  }, [locale]);

  useEffect(() => {
    try {
      const serialized = window.localStorage.getItem(SHOPPING_CHECKLIST_STORAGE_KEY);
      const savedChecklist = parseShoppingChecklist(serialized);
      if (serialized && !savedChecklist) {
        window.localStorage.removeItem(SHOPPING_CHECKLIST_STORAGE_KEY);
      }
      setChecklist(savedChecklist);
    } catch {
      setChecklist(null);
    } finally {
      setChecklistStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!checklistStorageReady) return;
    try {
      if (checklist) {
        window.localStorage.setItem(
          SHOPPING_CHECKLIST_STORAGE_KEY,
          serializeShoppingChecklist(checklist),
        );
        return;
      }
      window.localStorage.removeItem(SHOPPING_CHECKLIST_STORAGE_KEY);
    } catch {
      // The active checklist remains usable in memory when storage is blocked
      // or full; a later update can retry persistence.
    }
  }, [checklist, checklistStorageReady]);

  // AC 5.4.3: trip records live on this device only (localStorage), mirroring
  // the checklist persistence pattern above.
  useEffect(() => {
    try {
      const serialized = window.localStorage.getItem(TRIP_HISTORY_STORAGE_KEY);
      setTripHistory(parseTripHistory(serialized));
    } catch {
      setTripHistory([]);
    } finally {
      setTripHistoryStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!tripHistoryStorageReady) return;
    try {
      window.localStorage.setItem(TRIP_HISTORY_STORAGE_KEY, serializeTripHistory(tripHistory));
    } catch {
      // Records remain usable in memory when storage is blocked or full; a
      // later update can retry persistence.
    }
  }, [tripHistory, tripHistoryStorageReady]);

  useEffect(() => {
    try {
      setInboxMessages(parseInbox(window.localStorage.getItem(INBOX_STORAGE_KEY)));
    } catch {
      setInboxMessages([]);
    } finally {
      setInboxStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!inboxStorageReady) return;
    try {
      window.localStorage.setItem(INBOX_STORAGE_KEY, serializeInbox(inboxMessages));
    } catch {
      // Inbox controls remain usable in memory when device storage is blocked.
    }
  }, [inboxMessages, inboxStorageReady]);

  useEffect(() => {
    const savedPreferences = window.localStorage.getItem("smartcart-travel-preferences");
    if (!savedPreferences) return;
    try {
      const saved = JSON.parse(savedPreferences) as Record<string, unknown>;
      const transportMode = ["walk", "public_transport", "motorcycle", "car"].includes(String(saved.transportMode))
        ? saved.transportMode as TransportMode
        : "motorcycle";
      const limitType = saved.limitType === "both" ? "both" : saved.limitType === "time" ? "time" : "distance";
      const candidateLimit = Number(saved.limitValue);
      const limitValue = Number.isFinite(candidateLimit) && candidateLimit > 0
        ? candidateLimit
        : limitType === "distance" ? 5 : 20;
      const saraFilter = ["any", "candidate", "verified"].includes(String(saved.saraFilter))
        ? saved.saraFilter as SaraFilter
        : "any";
      const distanceKm = Number(saved.distanceKm ?? (limitType === "distance" ? limitValue : 5));
      const timeMinutes = Number(saved.timeMinutes ?? (limitType === "time" ? limitValue : 20));
      setPreferences({ origin: null, transportMode, limitType, limitValue,
        distanceKm: Number.isFinite(distanceKm) && distanceKm >= 0.5 && distanceKm <= 100 ? distanceKm : 5,
        timeMinutes: Number.isFinite(timeMinutes) && timeMinutes >= 5 && timeMinutes <= 180 ? timeMinutes : 20, saraFilter });
    } catch {
      window.localStorage.removeItem("smartcart-travel-preferences");
    }
  }, []);

  const basketCount = basket.reduce((count, item) => count + item.qty, 0);
  const copy = COPY[locale];
  const toggleLanguage = () => setLocale(current => current === "en" ? "ms" : "en");
  const updateChecklistStatus = (
    itemId: string,
    status: Exclude<ChecklistStatus, "neutral">,
  ) => {
    setChecklist(current => current
      ? toggleChecklistItemStatus(current, itemId, status)
      : current);
  };
  const addChecklistItem = (input: ManualChecklistItemInput) => {
    setChecklist(current => current
      ? addManualChecklistItem(current, input) ?? current
      : current);
  };
  const editChecklistItem = (itemId: string, input: ManualChecklistItemInput) => {
    setChecklist(current => current
      ? editChecklistItemModel(current, itemId, input) ?? current
      : current);
  };
  const setActualPrice = (itemId: string, actualPriceRm: number | null) => {
    setChecklist(current => current
      ? setChecklistItemActualPrice(current, itemId, actualPriceRm) ?? current
      : current);
  };
  const setActualQuantity = (itemId: string, actualQuantity: number | null) => {
    setChecklist(current => current
      ? setChecklistItemActualQuantity(current, itemId, actualQuantity) ?? current
      : current);
  };
  const removeChecklistItem = (itemId: string) => {
    setChecklist(current => current ? deleteChecklistItem(current, itemId) : current);
  };
  const removeChecklist = () => {
    setChecklist(null);
    go("/");
  };
  const recordTrip = () => {
    if (!checklist) return;
    const record = buildTripRecord(checklist);
    // The record appears in the in-memory history immediately (no reload) and
    // is persisted by the storage effect above.
    setTripHistory(current => addTripRecord(current, record));
    setTripNotification(current => ({ id: current.id + 1, message: copy.tripRecorded }));
  };
  const goBack = screen === "basket"
    ? () => go("/trip/shop")
    : screen === "shop"
      ? () => go("/trip/travel")
      : screen === "location"
        ? () => go("/")
        : screen === "compare"
          ? () => go(pathname.startsWith("/trip/results/") ? "/trip/results" : "/trip/review")
          : undefined;

  const hasDraft = basket.length > 0 || preferences.origin != null;
  const unreadCount = unreadInboxCount(inboxMessages);
  const continueTrip = () => {
    if (pathname.startsWith("/trip/results/") && selectedStore) {
      go(`/trip/results/${encodeURIComponent(selectedStore.premiseId)}`);
    } else if (preferences.origin && basket.length > 0) {
      go("/trip/review");
    } else if (preferences.origin) {
      go("/trip/shop");
    } else {
      go("/trip/travel");
    }
  };
  const startNewTrip = () => {
    if (hasDraft && !window.confirm(locale === "ms"
      ? "Buang perjalanan semasa dan mulakan perjalanan baharu?"
      : "Discard this trip draft and start a new one?")) return;
    setBasket(INIT_BASKET);
    setSelectedStore(null);
    acceptCandidatePreparation(null);
    setPreferences(current => ({ ...current, origin: null }));
    go("/trip/travel");
  };

  return (
    <div className="min-h-full bg-[#f7f8f6]">
      <Header
        basketCount={basketCount}
        basketActive={screen === "basket"}
        onBasket={screen === "shop" || screen === "basket" || screen === "compare" ? () => go("/trip/review") : undefined}
        onBack={goBack}
        locale={locale}
        onToggleLanguage={toggleLanguage}
        copy={copy}
      />

      <main className="mx-auto w-full max-w-[1440px] pt-16">
        {screen === "home" && (
          <HomeDashboard
            checklist={checklist}
            history={tripHistory}
            unreadCount={unreadCount}
            locale={locale}
            hasDraft={hasDraft}
            onStartTrip={() => go("/trip/travel")}
            onContinueTrip={continueTrip}
            onStartNewTrip={startNewTrip}
          />
        )}
        {screen === "checklist" && checklist && (
          <div className="mx-auto grid w-full max-w-[1440px] gap-5 px-3 pb-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-7 lg:px-12">
            <ShoppingChecklistScreen
              checklist={checklist}
              locale={locale}
              copy={copy}
              onToggleStatus={updateChecklistStatus}
              onAddManual={addChecklistItem}
              onEditItem={editChecklistItem}
              onSetActualPrice={setActualPrice}
              onSetActualQuantity={setActualQuantity}
              onDeleteItem={removeChecklistItem}
              onDeleteChecklist={removeChecklist}
              alreadyRecorded={tripHistory.some(record => record.checklistId === checklist.id)}
              onRecordTrip={recordTrip}
            />
            <aside className="lg:sticky lg:top-20">{checklist.savingsSnapshot && <SavingsEstimatePanel snapshot={checklist.savingsSnapshot} locale={locale} />}</aside>
          </div>
        )}
        {screen === "checklist" && !checklist && (
          <div className="mx-auto w-full max-w-[960px] px-4 pb-12 pt-8 sm:px-7 lg:pt-12">
            <AppCard className="py-12 text-center"><span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7f7f0] text-2xl text-[#087f5b]">☑</span><h1 className="mt-4 text-2xl font-extrabold text-[#17362c]">{locale === "ms" ? "Tiada senarai semak aktif" : "No active checklist"}</h1><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#617069]">{locale === "ms" ? "Bandingkan kedai dan mulakan senarai semak daripada perjalanan membeli-belah." : "Compare stores and start a checklist from a shopping trip."}</p><Link href="/trip/travel" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[#087f5b] px-5 text-sm font-extrabold text-white">{locale === "ms" ? "Mulakan perjalanan" : "Start a trip"}</Link></AppCard>
          </div>
        )}
        {screen === "history" && <TripHistoryScreen records={tripHistory} locale={locale} />}
        {screen === "inbox" && <InboxScreen messages={inboxMessages} locale={locale} onRead={id => setInboxMessages(current => setInboxMessageRead(current, id, true))} />}
        {screen === "shop" && (
          <BasketScreen
            view="shop"
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => go("/trip/review")}
            onBackToShop={() => go("/trip/shop")}
            onContinue={() => go("/trip/review")}
            copy={copy}
            locale={locale}
          />
        )}
        {screen === "basket" && (
          <BasketScreen
            view="basket"
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => go("/trip/review")}
            onBackToShop={() => go("/trip/shop")}
            onContinue={() => go("/trip/results")}
            preferences={preferences}
            candidateCount={candidatePreparation?.candidateCount}
            copy={copy}
            locale={locale}
          />
        )}
        {screen === "location" && (
          <LocationScreen
            preferences={preferences}
            onBack={() => go("/")}
            onPreparationChange={acceptCandidatePreparation}
            locale={locale}
            copy={copy}
            onCompare={nextPreferences => {
              setPreferences(nextPreferences);
              setSelectedStore(null);
              go("/trip/shop");
            }}
          />
        )}
        {screen === "compare" && (
          <CompareScreen
            basket={basket}
            setBasket={setBasket}
            activeChecklist={checklist}
            onCreateChecklist={nextChecklist => {
              setChecklist(nextChecklist);
              go("/checklist");
            }}
            selectedStore={selectedStore}
            setSelectedStore={setSelectedStore}
            candidatePreparation={candidatePreparation}
            onPreparationChange={acceptCandidatePreparation}
            selectedPremiseId={pathname.startsWith("/trip/results/") ? decodeURIComponent(pathname.split("/").at(-1) ?? "") : null}
            onOpenStore={store => {
              setSelectedStore(store);
              go(`/trip/results/${encodeURIComponent(store.premiseId)}`);
            }}
            preferences={preferences}
            onReviewAgain={() => go("/trip/review")}
            onChangeTravel={() => go("/trip/travel")}
            copy={copy}
          />
        )}
      </main>
      {tripNotification.message && (
        <SuccessToast
          notificationId={tripNotification.id}
          message={tripNotification.message}
          dismissLabel={copy.dismiss}
          onDismiss={() => setTripNotification(current => ({ ...current, message: "" }))}
        />
      )}
    </div>
  );
}
