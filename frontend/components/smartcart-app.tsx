"use client";

import { usePathname, useRouter } from "next/navigation";
import { UIIcon } from "./ui-icon";
import { CatalogueItemDialog, cataloguePrice } from "./catalogue-item-dialog";
import { CatalogueItemImage } from "./catalogue-item-image";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { listCategories, searchItems, type Item } from "@/lib/api";
import { DEFAULT_QTY, MAX_QTY, basketDetails, basketSummary, parseQty, resultRowFields, stepQty, upsertBasketLine } from "@/lib/result-row";
import { COPY, categoryLabel, type AppCopy, type Locale } from "@/lib/i18n";
import {
  getRecommendations,
  getBasketAlternatives,
  prepareRecommendationCandidates,
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
  TransportMode,
  TravelLimitType,
  TravelPreferencesRequest,
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
import {
  ConfirmationDialog,
  EmptyChecklistScreen,
  NextTripList,
  ShoppingChecklistScreen,
} from "@/components/shopping-checklist";
import { EstimatedSavingsSummary } from "@/components/estimated-savings-summary";
import {
  SmartCartHomeScreen,
  type TripJourneyStep,
} from "@/components/journey-screens";
import { ReceiptHistoryScreen, ReportScreen } from "@/components/report-screens";
import { mapsRouteUrl } from "@/lib/travel";
import { formatRm } from "@/lib/format-rm";
import { uppercaseItemName } from "@/lib/item-name";
import { localizedPackageSize } from "@/lib/package-size";
import { VISIBLE_STEP, hasMoreStores, nextVisibleCount } from "@/lib/visible-stores";
import {
  SHOPPING_CHECKLIST_STORAGE_KEY,
  addManualChecklistItem,
  createShoppingChecklist,
  deleteChecklistItem,
  editChecklistValues,
  revertChecklistItem,
  parseShoppingChecklist,
  serializeShoppingChecklist,
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
  type TripRecord,
} from "@/lib/trip-history";
import {
  NEXT_TRIP_STORAGE_KEY,
  addNextTripItem,
  nextTripBasket,
  nextTripItemId,
  parseNextTrip,
  saveForNextTrip,
  serializeNextTrip,
  type NextTripItem,
  type NextTripPriceQuote,
} from "@/lib/next-trip";
import { calculateEstimatedSavings } from "@/lib/estimated-savings";
import {
  EMPTY_INBOX,
  INBOX_STORAGE_KEY,
  markReportRead,
  parseInboxState,
  serializeInboxState,
  setReportCadence,
  setSummaryHidden,
  syncInboxReports,
  type InboxState,
  type ReportCadence,
} from "@/lib/inbox";
import svgPathsBasket from "@/components/icons/basket";
import svgPathsLocation from "@/components/icons/location";
import svgPathsCompare from "@/components/icons/compare";

// ── Types ───────────────────────────────────────────────────────────────────
type Screen = "home" | "shop" | "basket" | "location" | "compare" | "checklist" | "history" | "inbox";

const SCREEN_ROUTES: Record<Screen, string> = {
  home: "/", location: "/location", shop: "/shop", basket: "/basket",
  compare: "/compare", checklist: "/checklist", history: "/history", inbox: "/reports",
};

function screenForPath(pathname: string): Screen {
  if (pathname.startsWith("/store/")) return "compare";
  return (Object.entries(SCREEN_ROUTES).find(([, route]) => route === pathname)?.[0] as Screen | undefined) ?? "home";
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

function recommendationTravelRequest(preferences: TravelPreferences): TravelPreferencesRequest {
  if (!preferences.origin) throw new Error("A selected origin is required for recommendations.");
  return {
    origin: preferences.origin,
    transportMode: preferences.transportMode,
    limit: preferences.limitType === "both"
      ? {
          type: "both",
          distanceKm: preferences.distanceKm,
          timeMinutes: preferences.timeMinutes,
        }
      : { type: preferences.limitType, value: preferences.limitValue },
    saraFilter: preferences.saraFilter,
  };
}

function localizedName(copy: AppCopy, name: string | null | undefined, translations?: { itemNameEn?: string | null; itemNameMs?: string | null }): string {
  const locale = copy === COPY.ms ? "ms" : "en";
  const localized = (locale === "ms" ? translations?.itemNameMs : translations?.itemNameEn) || name || "Catalogue item";
  return uppercaseItemName(localized);
}

function packageSizeForCopy(copy: AppCopy, value: string | null | undefined): string | null {
  return localizedPackageSize(value, copy === COPY.ms ? "ms" : "en");
}

const INIT_BASKET: BasketItem[] = [];

// ── Shared SVG icons (from imports) ─────────────────────────────────────────
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
  candidate = false,
  copy,
}: {
  status: boolean | null;
  candidate?: boolean;
  copy: AppCopy;
}) {
  if (status !== true && !candidate) return null;
  return <span className="sara-item-status">{copy.saraCategory}</span>;
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

function CompactBasketPriceList({ prices, basket = [], copy }: { prices: BasketItemPrice[]; basket?: BasketItem[]; copy: AppCopy }) {
  return (
    <ul className="flex flex-col gap-2 rounded-xl bg-[#f4f8f9] p-3">
      {prices.map(price => (
        <li key={price.itemId} className="flex items-start justify-between gap-3 border-b border-[#e2e9e5] pb-2 last:border-b-0 last:pb-0">
          <span className="store-price-item-image" aria-hidden="true"><CatalogueItemImage imageUrl={basket.find(item => item.id === `db-${price.itemId}`)?.imageUrl} fallbackSize={24}/></span>
          <div className="min-w-0">
            <p className="break-words text-[13px] font-semibold text-[#10152e]">{localizedName(copy, price.itemName, price)}</p>
            {price.packageSize && <p className="mt-0.5 text-xs text-[#718078]">{packageSizeForCopy(copy, price.packageSize)}</p>}
            {price.priceSource === "median" && (
              <p className="mt-1 text-[11px] font-semibold text-[#7a5b00]">{copy.medianPriceEstimate}</p>
            )}
            <div className="mt-1">
              <SaraEligibilityFlag status={price.saraEligible ?? null} candidate={price.saraCategoryCandidate} copy={copy} />
            </div>
          </div>
          {price.unitPriceRm != null && price.lineTotalRm != null ? (
            <div className="shrink-0 text-right">
              <p className="text-[13px] font-extrabold text-[#10152e]">{formatRm(price.lineTotalRm)}</p>
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
  return <button type="button" onClick={onToggle} aria-label={COPY[locale].switchLanguage} className="language-toggle"><span className={locale === "en" ? "active" : ""}>EN</span><span className={locale === "ms" ? "active" : ""}>BM</span></button>;
}

function Header({ basketCount, onBasket, basketActive, onHome, locale, onToggleLanguage, copy, screen, onNavigate }: {
  basketCount: number; onBasket: () => void; basketActive: boolean; showBasket: boolean;
  onHome: () => void; locale: Locale; onToggleLanguage: () => void; copy: AppCopy;
  screen: string; onNavigate: (screen: "home" | "checklist" | "history" | "inbox") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [{id: "home", label: locale === "en" ? "Home" : "Utama", icon: "home"}, {id: "checklist", label: locale === "en" ? "Checklist" : "Senarai semak", icon: "checklist"}, {id: "history", label: locale === "en" ? "History" : "Sejarah", icon: "history"}, {id: "inbox", label: locale === "en" ? "Reports" : "Laporan", icon: "reports"}] as const;
  return <header className="app-header"><div className="header-inner">
    <button type="button" className="mobile-menu" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
    <button type="button" onClick={onHome} aria-label="SmartCart home" className="brand"><UIIcon name="basket" size={30} style={{color: "#007d38"}}/><span>Smart<span>Cart</span></span></button>
    <nav aria-label={locale === "en" ? "Main navigation" : "Navigasi utama"} className={"header-nav " + (menuOpen ? "is-open" : "")}>
      {links.map(link => <button key={link.id} type="button" aria-current={screen === link.id ? "page" : undefined} onClick={() => { onNavigate(link.id); setMenuOpen(false); }}><UIIcon name={link.icon}/>{link.label}</button>)}
    </nav>
    <LanguageToggle locale={locale} onToggle={onToggleLanguage}/>
    <button type="button" className="header-basket" onClick={onBasket} aria-label={copy.viewBasketAria(basketCount)} aria-current={basketActive ? "page" : undefined}><UIIcon name="basket" size={30} style={{color: "#007d38"}}/><span>{basketCount}</span></button>
  </div></header>;
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
    <div className="quantity-selector flex min-w-0 flex-col gap-2 sm:items-start">
      <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
        <button type="button" aria-label={decreaseLabel} disabled={qty === DEFAULT_QTY} onClick={() => onStep(-1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd8d1] text-lg text-[#007d38] disabled:opacity-40">−</button>
        <input
          type="text"
          inputMode="numeric"
          aria-label={quantityLabel}
          aria-invalid={qty === null}
          aria-describedby={qty === null && errorId ? errorId : undefined}
          value={value}
          onChange={event => onChange(event.target.value)}
          className={`h-11 w-12 rounded-xl border text-center text-sm font-bold focus:outline-none ${qty === null ? "border-[#c92a2a] bg-[#fff5f5] text-[#93000a] focus:border-[#c92a2a]" : "border-[#cbd8d1] text-[#10152e] focus:border-[#007d38]"}`}
        />
        <button type="button" aria-label={increaseLabel} disabled={qty === MAX_QTY} onClick={() => onStep(1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#007d38] text-lg text-white disabled:opacity-40">+</button>
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
  candidateCacheId = null,
  view,
  basket,
  setBasket,
  onViewBasket,
  onContinue,
  copy,
  locale,
}: {
  candidateCacheId?: string | null;
  view: "shop" | "basket";
  basket: BasketItem[];
  setBasket: Dispatch<SetStateAction<BasketItem[]>>;
  onViewBasket: () => void;
  onContinue: () => void;
  copy: AppCopy;
  locale: Locale;
}) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [priceContext, setPriceContext] = useState<"ready" | "unavailable">("unavailable");
  const [priceStoreCount, setPriceStoreCount] = useState(0);
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
  const [qtyById, setQtyById] = useState<Record<number, string>>({});
  const [basketQtyById, setBasketQtyById] = useState<Record<string, string>>({});

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
      searchItems(query, page, activeCategories, controller.signal, candidateCacheId)
        .then(data => {
          if (controller.signal.aborted) return;
          setApiResults(data.items);
          setSelectedItem(current => current ? data.items.find(item => item.item_id === current.item_id) ?? current : null);
          setPriceContext(data.price_context ?? "unavailable");
          setPriceStoreCount(data.price_store_count ?? 0);
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
  }, [activeCategories, page, search, view, candidateCacheId]);

  const toggleCategory = (category: string) => {
    setPage(1);
    setActiveCategories(current => current.includes(category)
      ? current.filter(selected => selected !== category)
      : [...current, category]);
  };

  const stepResultQty = (itemId: number, delta: number) => {
    setQtyById(current => {
      const base = parseQty(current[itemId] ?? String(DEFAULT_QTY)) ?? DEFAULT_QTY;
      return { ...current, [itemId]: String(stepQty(base, delta)) };
    });
  };

  const typeResultQty = (itemId: number, raw: string) => {
    setQtyById(current => ({ ...current, [itemId]: raw }));
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
  const selectedFields = selectedItem ? resultRowFields(selectedItem) : null;
  const selectedName = selectedItem ? localizedName(copy, selectedItem.item_name, { itemNameEn: selectedItem.item_name_en, itemNameMs: selectedItem.item_name_ms }) : "";
  const selectedRawQty = selectedItem ? qtyById[selectedItem.item_id] ?? String(DEFAULT_QTY) : "1";
  const selectedQty = parseQty(selectedRawQty);
  const basketCostSummary = basketSavingsSummary(basket);
  const isDesktopBasketRail = view === "shop";

  const quotedBasketLines = basket.filter(item => item.replacement != null);
  const quotedBasketTotal = quotedBasketLines.length ? quotedBasketLines.reduce((sum, item) => sum + item.replacement!.alternativeUnitPriceRm * item.qty, 0) : null;
  const basketPanel = (
    <section className={"basket-panel " + (isDesktopBasketRail ? "is-rail" : "is-review")} aria-label={copy.basketItems}>
      <header className="basket-panel-heading"><UIIcon name="basket"/><h2>{isDesktopBasketRail ? (locale === "en" ? "Your basket" : "Bakul anda") : copy.basketItems}</h2><span>{itemCount}</span></header>
      {basket.length === 0 ? <p className="basket-empty">{copy.basketEmpty}</p> : <>
        <div className="basket-columns" aria-hidden="true"><span>{locale === "en" ? "Product" : "Produk"}</span><span>SARA</span><span>{locale === "en" ? "Unit size" : "Saiz unit"}</span><span>{locale === "en" ? "Quantity" : "Kuantiti"}</span><span>{locale === "en" ? "Subtotal" : "Subjumlah"}</span><span/></div>
        <ul className="basket-rows">{basket.map(item => <li key={item.id} className={"basket-row " + (item.replacement ? "is-replaced" : "")}>
          <div className="basket-product"><span className="basket-product-icon" aria-hidden="true"><CatalogueItemImage imageUrl={item.imageUrl} fallbackSize={32}/></span><div><h3>{localizedName(copy, item.name, item)}</h3><span className="basket-mobile-size">{packageSizeForCopy(copy, item.size)}</span></div></div>
          <div className="basket-sara"><SaraEligibilityFlag status={item.saraEligible} candidate={item.saraCategoryCandidate} copy={copy}/></div>
          <span className="basket-package">{packageSizeForCopy(copy, item.size)}</span>
          <div className="basket-quantity"><QuantitySelector value={basketQtyById[item.id] ?? String(item.qty)} onChange={raw => typeBasketQty(item.id, raw)} onStep={delta => stepBasketQty(item.id, delta)} decreaseLabel={copy.decreaseQuantity(localizedName(copy, item.name, item))} increaseLabel={copy.increaseQuantity(localizedName(copy, item.name, item))} quantityLabel={copy.quantityFor(localizedName(copy, item.name, item))} errorId={`basket-quantity-error-${item.id}`} errorText={copy.quantityError}/></div>
          <div className="basket-quote">{item.replacement ? <><strong>{formatRm(item.replacement.alternativeUnitPriceRm * item.qty)}</strong><small>{item.replacement.premiseName}</small></> : <span title={copy.noStorePrice} aria-label={copy.noStorePrice}>—</span>}</div>
          <button type="button" className="basket-remove" aria-label={copy.removeItem(localizedName(copy, item.name, item))} onClick={() => removeItem(item.id)}><IcoTrash color="#526078"/></button>
          {item.replacement && <div className="basket-replacement"><span>{item.replacement.kind === "pack" ? copy.packChanged : copy.swapped} · {copy.originally(localizedName(copy, item.replacement.original.name, item.replacement.original))} ({packageSizeForCopy(copy, item.replacement.original.size)}) · {replacementImpactText(copy, currentReplacementImpactRm(item))}</span><button type="button" onClick={() => setBasket(current => undoBasketReplacement(current, item.id))}>{copy.undoSwap}</button></div>}
        </li>)}</ul>
      </>}
      <div className="basket-panel-summary"><span>{copy.itemCount(itemCount)}</span>{quotedBasketTotal != null && <div><small>{quotedBasketLines.length < basket.length ? copy.estimatedPartialTotal : copy.estimatedSubtotal}</small><strong>{formatRm(quotedBasketTotal)}</strong></div>}</div>
      <CompactSavingsFooter copy={copy} hasReplacements={basketCostSummary.hasReplacements} comparable={basketCostSummary.comparable} originalRm={basketCostSummary.originalRm} newRm={basketCostSummary.newRm} netSavingRm={basketCostSummary.netSavingRm} totalsLabel={copy.affectedItemsTotal}/>
      {isDesktopBasketRail && <div className="basket-rail-action"><button type="button" className="primary-button" onClick={onViewBasket} disabled={basket.length === 0}>{copy.viewBasket} →</button></div>}
    </section>
  );

  return (
    <div className={"screen-enter catalogue-layout " + (view === "shop" ? "catalogue-shop" : "basket-review")}>
      {view === "shop" && (
        <div className="catalogue-content">
      {/* Page header */}
      <div className="px-4 pb-5 pt-1 sm:px-6 sm:pt-0">

        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10152e] sm:text-[36px] sm:leading-[42px]">{copy.shopTitle}</h1>
        <p className="mt-2 max-w-[580px] text-[16px] leading-6 text-[#526078]">
          {copy.shopDescription}
        </p>
      </div>

      {/* Search —— now calls the real backend API (Step 6) */}
      <div className="catalogue-search px-4 pb-3 pt-2 sm:px-6">
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
            className="h-14 w-full rounded-2xl border border-[#dce5e0] bg-white pl-12 pr-14 text-[16px] text-[#10152e] shadow-[0_3px_14px_rgba(16,35,29,0.07)] placeholder:text-[#718078] focus:border-[#007d38] focus:outline-none"
          />
          {search && <button type="button" aria-label={copy.clearSearch} onClick={() => { setSearch(""); setPage(1); searchRef.current?.focus(); }} className="absolute right-1 top-1 h-12 w-12 rounded-xl text-xl text-[#526078]">×</button>}
        </div>
      </div>

      {/* Multi-select category filter */}
      <div className="catalogue-categories">
        <button
          type="button"
          aria-expanded={categoryOpen}
          aria-controls="category-options"
          onClick={() => setCategoryOpen(open => !open)}
          className="flex min-h-12 w-full items-center justify-between rounded-xl border border-[#d7e1dc] bg-white px-4 text-left shadow-sm"
        >
          <span>
            <span className="block text-xs font-semibold text-[#718078]">{copy.categories}</span>
            <span className="block text-[15px] font-bold text-[#10152e]">
              {activeCategories.length === 0 ? copy.allCategories : activeCategories.map(category => categoryLabel(locale, category)).join(", ")}
            </span>
          </span>
          <span aria-hidden="true" className={`text-lg text-[#007d38] transition-transform ${categoryOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>

        {categoryOpen && (
          <div id="category-options" className="absolute left-4 right-4 top-[60px] rounded-2xl border border-[#d7e1dc] bg-white p-3 shadow-[0_14px_34px_rgba(16,35,29,0.16)] sm:left-6 sm:right-6">
            <div className="mb-2 flex items-center justify-between border-b border-[#edf1ef] px-1 pb-2">
              <p className="text-sm font-extrabold text-[#10152e]">{copy.filterByCategory}</p>
              {activeCategories.length > 0 && (
                <button type="button" onClick={() => { setActiveCategories([]); setPage(1); }} className="min-h-11 px-2 text-sm font-bold text-[#007d38]">{copy.clearAll}</button>
              )}
            </div>
            <div className="grid max-h-[210px] grid-cols-1 gap-1 overflow-y-auto sm:max-h-[300px] sm:grid-cols-2">
              {categoriesLoading && <p className="col-span-full px-2 py-3 text-sm text-[#526078]">{copy.loadingCategories}</p>}
              {!categoriesLoading && categoriesError && <p className="col-span-full px-2 py-3 text-sm text-[#ba1a1a]">{copy.categoriesUnavailable}</p>}
              {categories.map(category => (
                <label key={category} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-[#f2f6f3]">
                  <input
                    type="checkbox"
                    checked={activeCategories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="h-5 w-5 accent-[#007d38]"
                  />
                  <span className="min-w-0 break-words text-sm font-medium text-[#263b33]">{categoryLabel(locale, category)}</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setCategoryOpen(false)} className="mt-3 h-11 w-full rounded-xl bg-[#007d38] text-sm font-extrabold text-white">{copy.showItems(apiTotal)}</button>
          </div>
        )}
      </div>

      {/* Matching items —— now shows real backend data with prices (Step 7) */}
      <div id="catalogue-results" className="scroll-mt-36 px-4 pb-7 sm:px-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10152e]">
            {search.trim().length >= 2 || activeCategories.length > 0 ? copy.searchResults : copy.allEssentials}
          </h2>
          <span className="text-sm font-medium text-[#718078]">
            {apiLoading ? copy.searching : copy.itemCount(apiTotal)}
          </span>
        </div>
        {!apiLoading && <p className="catalogue-price-context">{priceContext === "ready"
          ? (locale === "en" ? `Recorded prices across ${priceStoreCount} nearby stores. Prices may vary in store.` : `Harga direkodkan daripada ${priceStoreCount} kedai berdekatan. Harga di kedai mungkin berbeza.`)
          : (locale === "en" ? "Nearby prices unavailable. Set your location in Travel to load nearby stores." : "Harga berdekatan tidak tersedia. Tetapkan lokasi dalam Perjalanan untuk memuatkan kedai berdekatan.")}</p>}

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
          <div className="product-grid">
            {apiResults.map(item => {
              const fields = { ...resultRowFields(item), name: localizedName(copy, item.item_name, { itemNameEn: item.item_name_en, itemNameMs: item.item_name_ms }) };
              return (
              <article key={item.item_id} className="product-card"><div className="product-visual" aria-hidden="true"><CatalogueItemImage imageUrl={item.image_url}/></div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="break-words text-[15px] font-extrabold leading-5 text-[#10152e]">{fields.name}</h3>
                  <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-0.5 text-[12px] leading-5">
                    <span className="break-words text-[#526078]">{packageSizeForCopy(copy, fields.packageSize)}</span>
                    <span className="break-words text-[#718078]">{categoryLabel(locale, item.item_category)}</span>
                  </div>
                  <SaraEligibilityFlag status={item.sara_eligible} candidate={item.sara_category_candidate} copy={copy} />
                </div>
                <div className="product-card-footer">
                  <strong className={item.price_range ? "product-price" : "product-price is-unavailable"}>{cataloguePrice(item, locale)}</strong>
                  <button type="button" className="product-add icon-button" aria-haspopup="dialog" aria-label={`${copy.addToBasket}: ${fields.name}`} onClick={() => { setQtyById(current => ({ ...current, [item.item_id]: "1" })); setSelectedItem(item); }}><UIIcon name="plus"/></button>
                </div>
              </article>
              );
            })}
          </div>
        )}

        {!apiLoading && !apiError && apiTotalPages > 1 && (
          <nav aria-label={copy.pagination} className="mt-6 flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-[#526078]">{copy.pageOf(page, apiTotalPages)}</p>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page === 1}
                aria-label={copy.previousPage}
                className="flex min-h-11 items-center gap-1 rounded-xl border border-[#cbd8d1] bg-white px-3 text-sm font-bold text-[#007d38] disabled:opacity-40"
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
                  className={`h-11 min-w-11 rounded-xl px-2 text-sm font-extrabold ${entry === page ? "bg-[#007d38] text-white" : "border border-[#cbd8d1] bg-white text-[#007d38]"}`}
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
                className="flex min-h-11 items-center gap-1 rounded-xl border border-[#cbd8d1] bg-white px-3 text-sm font-bold text-[#007d38] disabled:opacity-40"
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
        <aside aria-label={copy.basketTitle} className="basket-rail">
          {basketPanel}
        </aside>
      )}
      {notification.message && <SuccessToast notificationId={notification.id} message={notification.message} dismissLabel={copy.dismiss} onDismiss={() => setNotification(current => ({ ...current, message: "" }))} />}
      <CatalogueItemDialog open={selectedItem !== null} title={selectedName} locale={locale} onClose={() => setSelectedItem(null)} canAdd={selectedQty !== null}
        onAdd={() => { if (selectedItem && selectedQty !== null) { addRealItem(selectedItem, selectedQty); setSelectedItem(null); } }}
        details={selectedItem && <div className="catalogue-dialog-details">
          <div className="product-visual" aria-hidden="true"><CatalogueItemImage imageUrl={selectedItem.image_url}/></div>
          <p>{packageSizeForCopy(copy, selectedFields?.packageSize)} · {categoryLabel(locale, selectedItem.item_category)}</p>
          <SaraEligibilityFlag status={selectedItem.sara_eligible} candidate={selectedItem.sara_category_candidate} copy={copy}/>
          <strong className="product-price">{cataloguePrice(selectedItem, locale)}</strong>
          {selectedItem.price_range && <p>{locale === "en" ? `Recorded at ${selectedItem.price_range.store_count} nearby stores. Per unit; final price depends on your store.` : `Direkodkan di ${selectedItem.price_range.store_count} kedai berdekatan. Seunit; harga akhir bergantung pada kedai.`}</p>}
          {selectedItem.price_range?.oldest_observed_date && <p>{locale === "en" ? "Oldest price observation: " : "Rekod harga terlama: "}{selectedItem.price_range.oldest_observed_date}</p>}
        </div>}
        quantity={<QuantitySelector value={selectedRawQty} onChange={raw => { if (selectedItem) typeResultQty(selectedItem.item_id, raw); }} onStep={delta => { if (selectedItem) stepResultQty(selectedItem.item_id, delta); }} decreaseLabel={copy.decreaseQuantity(selectedName)} increaseLabel={copy.increaseQuantity(selectedName)} quantityLabel={copy.quantityFor(selectedName)} errorId="catalogue-dialog-quantity-error" errorText={copy.quantityError}/>}/>
      {view === "basket" && (
        <>
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10152e] sm:text-[36px] sm:leading-[42px]">{copy.basketTitle}</h1><p className="page-description">{locale === "en" ? "Check your items and quantities before comparing stores." : copy.basketDescription}</p>
      </div>

      {basketPanel}
        </>
      )}

      {(view === "basket" || itemCount > 0) && !(view === "shop" && categoryOpen) && <div className={(view === "shop" ? "lg:hidden " : "") + "fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur"}>
        {view === "basket" ? (
          <div className="mx-auto flex w-full max-w-[712px] gap-3">
            <button
              type="button"
              onClick={handleContinue}
              className="h-14 w-full rounded-2xl bg-[#007d38] text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)]"
            >
              {copy.chooseLocation}
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[712px] flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={onViewBasket}
              className="flex min-h-14 w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-2xl bg-[#007d38] px-5 py-2 text-center text-[15px] font-extrabold leading-5 text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)] sm:w-auto sm:min-w-[190px]"
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
  { id: "walk", Icon: ({ active }: { active: boolean }) => <IcoWalkFigma color={active ? "#007d38" : "#3E494A"} /> },
  { id: "public_transport", Icon: ({ active }: { active: boolean }) => (
    <div className="flex items-center gap-1">
      <IcoWalkFigma color={active ? "#007d38" : "#3E494A"} />
      <IcoBusFigma color={active ? "#007d38" : "#3E494A"} />
    </div>
  ) },
  { id: "motorcycle", Icon: ({ active }: { active: boolean }) => <IcoMotoFigma color={active ? "#007d38" : "#3E494A"} /> },
  { id: "car", Icon: ({ active }: { active: boolean }) => <IcoCarFigma color={active ? "#007d38" : "#3E494A"} /> },
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

const DISTANCE_LIMITS = [2, 5, 10, 15] as const;
const TIME_LIMITS = [10, 20, 30, 45] as const;

function LocationScreen({
  preferences,
  onCompare,
  onDraftChange,
  copy,
}: {
  preferences: TravelPreferences;
  onCompare: (preferences: TravelPreferences) => void;
  onDraftChange: (preferences: TravelPreferences) => void;
  copy: AppCopy;
}) {
  const [expandedPreference, setExpandedPreference] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState(preferences.origin?.label ?? "");
  const [selectedOrigin, setSelectedOrigin] = useState<SelectedLocation | null>(preferences.origin);
  const [transportMode, setTransportMode] = useState<TransportMode>(preferences.transportMode);
  const [limitType, setLimitType] = useState<TravelLimitType>(preferences.limitType);
  const [distanceKm, setDistanceKm] = useState(preferences.distanceKm);
  const [timeMinutes, setTimeMinutes] = useState(preferences.timeMinutes);
  const limitValue = limitType === "time" ? timeMinutes : distanceKm;
  const locationSearchRef = useRef<HTMLInputElement>(null);
  const [saraFilter, setSaraFilter] = useState<SaraFilter>(preferences.saraFilter === "verified" ? "candidate" : preferences.saraFilter);
  const [remember, setRemember] = useState(true);
  const [sessionToken, setSessionToken] = useState(createLocationSessionToken);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "resolving" | "locating">("idle");
  const [locationError, setLocationError] = useState("");

  const locationGeneration = useRef(0);
  const reverseController = useRef<AbortController | null>(null);
  const [notification, setNotification] = useState({ id: 0, message: "" });
  useEffect(() => () => { locationGeneration.current += 1; reverseController.current?.abort(); }, []);

  useEffect(() => {
    onDraftChange({
      origin: selectedOrigin,
      transportMode,
      limitType,
      limitValue,
      distanceKm,
      timeMinutes,
      saraFilter,
    });
  }, [distanceKm, limitType, limitValue, onDraftChange, saraFilter, selectedOrigin, timeMinutes, transportMode]);

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
    <div className="screen-enter location-screen">
      {notification.message && <SuccessToast notificationId={notification.id} message={notification.message} dismissLabel={copy.dismiss} onDismiss={() => setNotification(current => ({ ...current, message: "" }))} />}
      <div className="location-map">
        {selectedOrigin ? <>
          <iframe title={copy === COPY.ms ? "Peta lokasi permulaan" : "Starting location map"} loading="lazy" referrerPolicy="no-referrer" src={"https://maps.google.com/maps?" + new URLSearchParams({q: `${selectedOrigin.latitude},${selectedOrigin.longitude}`, z: "13", output: "embed"}).toString()}/>
          <span className="location-map-selection">● {selectedOrigin.label}</span>
        </> : <div className="location-map-empty"><IcoLocation color="#007d38"/><p>{copy.chooseStartingLocation}</p></div>}
      </div>

      <div className="location-layout">
        <section className="origin-panel">
          <div className="location-heading"><h1>{copy.locationTitle}</h1><p>{copy === COPY.ms ? "Pilih lokasi dan pilihan perjalanan anda." : "Set your location and travel preferences."}</p></div>
          <div className="origin-title">
            <IcoLocation />
            <h2>{copy.startingPoint}</h2>
          </div>

          <button
            type="button"
            onClick={usePreciseLocation}
            disabled={searchState === "locating"}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-[#007d38] bg-[#edf7f2] px-4 text-[15px] font-extrabold text-[#007d38] disabled:cursor-wait disabled:opacity-60"
          >
            <IcoLocation color="#007d38" />
            {searchState === "locating" ? copy.findingLocation : copy.usePreciseLocation}
          </button>

          <div className="origin-separator flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-[#718078]">
            <span className="h-px flex-1 bg-[#dce5e0]" />
            {copy.orSearch}
            <span className="h-px flex-1 bg-[#dce5e0]" />
          </div>

          <div className="origin-search relative">
            <div className="origin-search-icon"><IcoSearch color="#3E494A" /></div>
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
              className="h-14 w-full rounded-xl border border-[#dce5e0] bg-[#f7f9f8] pl-10 pr-14 text-[16px] text-[#10152e] focus:border-[#007d38] focus:outline-none"
            />
            {locationInput && (
              <button
                type="button"
                aria-label={copy.clearSearch}
                onClick={clearLocationSearch}
                className="origin-search-clear"
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
                    <span className="block text-[15px] font-bold text-[#10152e]">{suggestion.mainText}</span>
                    {suggestion.secondaryText && <span className="mt-0.5 block text-xs text-[#526078]">{suggestion.secondaryText}</span>}
                  </button>
                ))}
                <p className="bg-[#fafbf9] px-4 py-2 text-right text-[11px] font-semibold text-[#718078]">{copy.poweredByGoogle}</p>
              </div>
            )}
          </div>

          {(searchState === "searching" || searchState === "resolving" || locationError) && (
            <div aria-live="polite" className="origin-status text-sm">
              {searchState === "searching" && <span className="text-[#526078]">{copy.searchingLocations}</span>}
              {searchState === "resolving" && <span className="text-[#526078]">{copy.selectingLocation}</span>}
              {locationError && <span role="alert" className="font-medium text-[#ba1a1a]">{locationError}</span>}
            </div>
          )}

        </section>

        <div className="preference-bar">
        <section className={"transport-panel preference-panel " + (expandedPreference === "transport" ? "preference-open" : "")}><button type="button" className="preference-summary" aria-expanded={expandedPreference === "transport"} onClick={() => setExpandedPreference(current => current === "transport" ? null : "transport")}><TransportModeIcon mode={transportMode}/> <strong>{copy.transportMode}</strong><span>{transportLabel(copy, transportMode)}</span><span aria-hidden="true">›</span></button><div className="preference-content">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10152e]">{copy.transportMode}</h2>
          <div className="grid grid-cols-2 gap-3">
            {TRANSPORT_OPTS.map(option => {
              const active = transportMode === option.id;
              return (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => setTransportMode(option.id)}
                  aria-pressed={active}
                  className={"flex min-h-[92px] flex-col items-center justify-center rounded-2xl border py-4 shadow-sm " + (active ? "border-[#007d38] bg-[#007d38]" : "border-[#dce5e0] bg-white")}
                >
                  <div className="transport-option-icon"><option.Icon active={active} /></div>
                  <span className={"text-[14px] font-medium leading-5 " + (active ? "text-white" : "text-[#191c1d]")}>{transportLabel(copy, option.id)}</span>
                </button>
              );
            })}
          </div>
        </div>{transportMode === "public_transport" && <p className="transit-note">{copy.transitWalking}</p>}</section>

        <section className={"limit-panel preference-panel " + (expandedPreference === "limit" ? "preference-open" : "")}><button type="button" className="preference-summary" aria-expanded={expandedPreference === "limit"} onClick={() => setExpandedPreference(current => current === "limit" ? null : "limit")}><UIIcon name="history" size={20}/> <strong>{copy.travelLimit}</strong><span>{limitType === "both" ? `${distanceKm} km · ${timeMinutes} min` : limitType === "distance" ? `${distanceKm} km` : `${timeMinutes} min`}</span><span aria-hidden="true">›</span></button><div className="preference-content">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10152e]">{copy.travelLimit}</h2>
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
                className={"min-h-11 rounded-lg px-3 text-sm font-bold " + (limitType === type ? "bg-white text-[#007d38] shadow-sm" : "text-[#526078]")}
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
                  <button type="button" key={value} onClick={() => type === "distance" ? setDistanceKm(value) : setTimeMinutes(value)} aria-pressed={(type === "distance" ? distanceKm : timeMinutes) === value} className={"h-12 rounded-xl border px-2 text-sm font-bold " + ((type === "distance" ? distanceKm : timeMinutes) === value ? "border-[#007d38] bg-[#007d38] text-white" : "border-[#dce5e0] bg-white text-[#405149]")}>
                    {value}{type === "distance" ? " km" : " min"}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div></section>

        <section className={"sara-panel preference-panel " + (expandedPreference === "sara" ? "preference-open" : "")}>
          <button type="button" className="preference-summary" aria-expanded={expandedPreference === "sara"} onClick={() => setExpandedPreference(current => current === "sara" ? null : "sara")}>
            <UIIcon name="basket" size={20}/><strong>{copy.saraPlanning}</strong><span>{saraFilter === "any" ? (copy === COPY.en ? "All stores" : "Semua kedai") : (copy === COPY.en ? "SARA stores" : "Kedai SARA")}</span><span aria-hidden="true">›</span>
          </button>
          <div className="preference-content">
            <h2>{copy.saraPlanning}</h2>
            <div className="sara-options">
              {(["any", "candidate"] as const).map(value => <button type="button" key={value} aria-pressed={saraFilter === value} onClick={() => setSaraFilter(value)}>{value === "any" ? (copy === COPY.en ? "All stores" : "Semua kedai") : (copy === COPY.en ? "SARA stores" : "Kedai SARA")}</button>)}
            </div>
            {saraFilter === "candidate" && <p className="text-xs text-amber-800">{copy.saraCandidateNote}</p>}
          </div>
        </section>

        <button
          type="button"
          onClick={() => setRemember(!remember)}
          aria-pressed={remember}
          className="remember-preferences"
        >
          <UIIcon name="settings" size={20}/><span>{copy.rememberPreferences}</span><span className={"remember-switch " + (remember ? "is-on" : "")}/>
        </button>
      <div className="location-actions">
        <div>
          <button
            type="button"
            onClick={handleCompare}
            disabled={!selectedOrigin || searchState === "resolving" || searchState === "locating"}
            className="location-continue"
          >
            {copy.findStores}
          </button>
        </div>
      </div>
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
  const priceListId = `store-prices-${store.premiseId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const totalLabel = store.missingItems.length > 0
    ? (hasMedianPrices ? copy.estimatedPartialTotal : copy.partialEstimatedTotal)
    : (storeOfficialPriceCount > 0 && hasMedianPrices ? copy.estimatedCombinedTotal : copy.combinedTotal);
  const travelMinutes = Math.round(store.estimatedTravelMinutes);
  const travelDuration = travelMinutes >= 60
    ? `${Math.floor(travelMinutes / 60)} ${copy === COPY.ms ? "jam" : "h"}${travelMinutes % 60 ? ` ${travelMinutes % 60} min` : ""}`
    : `${travelMinutes} ${copy.minutes}`;

  return (
    <article className={"store-card " + (isRecommended ? "is-recommended" : "")}>
      <div className="store-card-marker">{isRecommended && <span>★ {copy.recommendedStore}</span>}</div>
      <header className="store-card-header">
        <div className="store-symbol" aria-hidden="true"><IcoStore /></div>
        <div className="store-card-identity">
          <h3>{store.name}</h3>
          <SaraStoreTag status={store.saraStatus} copy={copy} />
          {store.exceedsLimit && <span className="store-limit-note">{copy.beyondTravelLimit}</span>}
        </div>
      </header>
        <div className="store-card-travel">
          <div className="store-card-trip-fact"><TransportModeIcon mode={transportMode}/><small>{copy.distance} · {copy.oneWay}</small><strong>{store.routeDistanceKm.toFixed(1)} km</strong></div>
          <div className="store-card-trip-fact"><UIIcon name="history" size={20}/><small>{copy.travelTime} · {copy.oneWay}</small><strong>{travelDuration}</strong></div>
          <div className="store-card-trip-fact"><IcoStore/><small>{copy.returnTravel}</small><strong>{formatRm(store.estimatedRoundTripCostRm)}</strong></div>
        {routeUrl && <a className="store-card-route" href={routeUrl} target="_blank" rel="noopener noreferrer">{copy.openInGoogleMaps} <span aria-hidden="true">↗</span></a>}
      </div>
      <div className="store-card-costs">
        <div><span>{store.missingItems.length ? (hasMedianPrices ? copy.estimatedPartialTotal : copy.partialTotal) : hasMedianPrices ? copy.estimatedSubtotal : copy.basketSubtotal}{store.basketLineCount ? ` (${store.basketLineCount})` : ""}</span><strong>{store.basketSubtotalRm == null ? "—" : formatRm(store.basketSubtotalRm)}</strong></div>
        <div><span>{copy.returnTravel}</span><strong>{formatRm(store.estimatedRoundTripCostRm)}</strong></div>
        <div className="store-card-grand-total"><span>{totalLabel}</span><strong>{store.combinedTotalRm == null ? "—" : formatRm(store.combinedTotalRm)}</strong></div>
      </div>
      {(store.basketLineCount ?? 0) > 0 && <div className="price-coverage"><span>{storeOfficialPriceCount} {copy === COPY.ms ? "harga kedai" : "store prices"} · {storeMedianPriceCount} {copy === COPY.ms ? "anggaran median" : "median estimates"} · {store.missingItems.length} {copy === COPY.ms ? "tiada harga" : "missing prices"}</span><progress max={store.basketLineCount ?? 1} value={storeOfficialPriceCount} aria-label={copy.priceCoverage(storeOfficialPriceCount, store.basketLineCount ?? 0)}/></div>}
      <div className="store-card-actions">
        {(store.basketLineCount ?? 0) > 0 && store.basketPrices.length > 0 && <div className="store-price-anchor">
          <button type="button" className="store-price-trigger" aria-expanded={pricesExpanded} aria-controls={priceListId} onClick={onTogglePrices}>{pricesExpanded ? copy.hidePriceList : copy.viewPriceList} <span aria-hidden="true">{pricesExpanded ? "⌃" : "⌄"}</span></button>
          {pricesExpanded && <div id={priceListId} className="store-price-popover" onKeyDown={event => { if (event.key === "Escape") onTogglePrices(); }}>
            <div className="store-price-popover-heading"><strong>{copy.basketItems}</strong><button type="button" onClick={onTogglePrices} aria-label={copy.dismiss}>×</button></div>
            <div className="store-price-table-head"><span>{copy === COPY.ms ? "Item" : "Item"}</span><span>{copy === COPY.ms ? "Saiz" : "Pack"}</span><span>{copy === COPY.ms ? "Kuantiti" : "Qty"}</span><span>{copy === COPY.ms ? "Harga" : "Unit"}</span><span>{copy === COPY.ms ? "Jumlah" : "Total"}</span></div>
            <ul>{store.basketPrices.map(price => <li key={price.itemId} className="store-price-table-row"><span>{localizedName(copy, price.itemName, price)}{price.priceSource === "median" && <small>{copy.medianPriceEstimate}</small>}</span><span>{packageSizeForCopy(copy, price.packageSize) ?? "—"}</span><span>{price.quantity}</span><span>{price.unitPriceRm == null ? "—" : formatRm(price.unitPriceRm)}</span><strong>{price.lineTotalRm == null ? "—" : formatRm(price.lineTotalRm)}</strong></li>)}</ul>
            {store.missingItems.length > 0 && <p className="store-price-missing">{copy.missingItemPrices(store.missingItems.map(name => localizedName(copy, name, store.basketPrices.find(price => price.itemName === name))).join(", "))}</p>}
          </div>}
        </div>}
        <button type="button" className="store-select-button" onClick={onSelectStore} aria-label={copy.selectStore + " " + store.name}>{copy.selectStore} <span aria-hidden="true">→</span></button>
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
  onChangeQuantity,
}: {
  row: RecommendationDetailRow;
  basket: BasketItem[];
  copy: AppCopy;
  onApplyAlternative: (line: BasketAlternativeLine) => void;
  onApplyPack: (row: RecommendationDetailRow, packItemId: string) => void;
  onUndo: (row: RecommendationDetailRow) => void;
  onChangeQuantity: (id: string, quantity: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
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
  const hasOtherPacks = packOptions.some(pack => pack.itemId !== row.current.itemId);
  const hasOptions = Boolean(row.replacement || lowerCostAvailable || hasOtherPacks);
  const currentImageUrl = row.basketItem?.id === `db-${row.current.itemId}` ? row.basketItem.imageUrl : undefined;

  return (
    <li className="recommendation-item">
      <div className="store-item-row">
        <span className="store-item-image" aria-hidden="true"><CatalogueItemImage imageUrl={currentImageUrl} fallbackSize={27}/></span>
        <div className="store-item-name">
          <strong>{localizedName(copy, row.current.itemName, row.current)}</strong>
          <small>{packageSizeForCopy(copy, row.current.packageSize) ?? "—"}<span className="store-item-mobile-quantity"> × {row.current.quantity}</span>{row.replacement ? ` · ${copy.originally(localizedName(copy, row.replacement.original.name, row.replacement.original))}` : ""}</small>
          {row.replacement && <small className="store-item-replaced">{row.replacement.kind === "pack" ? copy.packChanged : copy.swapped}</small>}
          {row.current.priceSource === "median" && <small className="store-item-estimate">{copy.medianPriceEstimate}</small>}
        </div>
        <div className="store-item-sara"><SaraEligibilityFlag status={row.current.saraEligible} candidate={row.current.saraCategoryCandidate} copy={copy}/></div>
        <span className="store-item-package">{packageSizeForCopy(copy, row.current.packageSize) ?? "—"}</span>
        <div className="store-item-quantity">
          {row.basketItem ? <QuantitySelector value={String(row.current.quantity)} onChange={raw => { const quantity = parseQty(raw); if (quantity != null) onChangeQuantity(row.basketItem!.id, quantity); }} onStep={delta => onChangeQuantity(row.basketItem!.id, stepQty(row.current.quantity, delta))} decreaseLabel={copy.decreaseQuantity(row.current.itemName)} increaseLabel={copy.increaseQuantity(row.current.itemName)} quantityLabel={copy.quantityFor(row.current.itemName)} errorId={`store-quantity-${row.source.itemId}`} errorText={copy.quantityError}/> : row.current.quantity}
        </div>
        <span className="store-item-unit-price">{row.current.unitPriceRm == null ? "—" : formatRm(row.current.unitPriceRm)}</span>
        <strong className="store-item-total">{row.current.lineTotalRm == null ? copy.noStorePrice : formatRm(row.current.lineTotalRm)}</strong>
        {hasOptions && <button type="button" className="store-item-toggle" aria-expanded={expanded} aria-label={`${expanded ? copy.hidePriceList : copy.viewPriceList}: ${localizedName(copy, row.current.itemName, row.current)}`} onClick={() => setExpanded(value => !value)}>{expanded ? "⌃" : "›"}</button>}
      </div>
      {hasOptions && expanded && <div className="store-item-options">

      {row.replacement && row.basketItem && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f3faf7] px-3 py-2 text-xs text-[#286d67]">
          <span className="font-semibold">{replacementImpactText(copy, impactRm)}</span>
          <button type="button" onClick={() => onUndo(row)} className="min-h-9 font-extrabold text-[#007d38] underline underline-offset-2">{copy.undoSwap}</button>
        </div>
      )}

      {lowerCostAvailable && alternative && suggestion.savingsRm != null && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl bg-[#f3faf7] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#286d67]">{copy.lowerPriceNow}</p>
            <p className="mt-0.5 break-words text-xs font-semibold text-[#10152e]">{localizedName(copy, alternative.itemName, alternative)}</p>
            <p className="text-[11px] text-[#718078]">{packageSizeForCopy(copy, alternative.packageSize ?? alternative.unit) ?? "—"}</p>
            <p className="mt-0.5 text-[11px] font-bold text-[#175f4b]">{copy.saveAmount(formatRm(suggestion.savingsRm))}</p>
            {eligibilityChanges && (
              <div className="mt-1"><SaraEligibilityFlag status={alternative.saraEligible} candidate={alternative.saraCategoryCandidate} copy={copy} /></div>
            )}
          </div>
          <button
            type="button"
            disabled={lowerCostDuplicate}
            onClick={() => onApplyAlternative(suggestion)}
            aria-label={`${copy.swapAndSave}: ${localizedName(copy, alternative.itemName, alternative)}`}
            className="min-h-11 shrink-0 rounded-lg bg-[#007d38] px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#9db5ac]"
          >
            {lowerCostDuplicate ? copy.alreadyInBasket : copy.swapAndSave}
          </button>
        </div>
      )}

      {hasOtherPacks && bestPack && (
        <details className="pack-comparison mt-2 rounded-xl border border-[#dce5e0] bg-white">
          <summary className="cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[#10152e]">{copy.comparePackSizes(packOptions.length)}</p>
                <p className="mt-0.5 break-words text-[11px] text-[#526078]">
                  {bestPack.itemId === row.current.itemId
                    ? copy.currentPackBestValue
                    : `${copy.bestUnitValue}: ${packageSizeForCopy(copy, bestPack.packageSize) ?? "—"} · ${bestPack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(bestPack.pricePerUnitRm), bestPack.unitKind) : "—"}`}
                </p>
              </div>
              <span aria-hidden="true" className="shrink-0 text-lg font-bold text-[#007d38]">⌄</span>
            </div>
          </summary>
          <div className="pack-options">
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
                <div key={pack.itemId} className={`pack-option ${isCurrent ? "bg-[#e7f7f0] ring-1 ring-[#007d38]" : "bg-[#f4f8f9]"}`}>
                  <div className="flex flex-wrap gap-1">
                    {pack.isBestValue && <span className="rounded-md bg-[#007d38] px-1.5 py-0.5 text-[9px] font-extrabold text-white">{copy.bestUnitValue}</span>}
                    {isCurrent && <span className="rounded-md bg-[#e2e9e5] px-1.5 py-0.5 text-[9px] font-extrabold text-[#526078]">{copy.currentPack}</span>}
                  </div>
                  <p className="mt-1 break-words text-xs font-bold leading-4 text-[#10152e]">{localizedName(copy, pack.itemName, pack)}</p>
                  <p className="text-[11px] text-[#718078]">{packageSizeForCopy(copy, pack.packageSize) ?? "—"}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-[#10152e]">{pack.totalPriceRm != null ? formatRm(pack.totalPriceRm) : "—"}</p>
                      <p className="text-[10px] text-[#526078]">{pack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(pack.pricePerUnitRm), pack.unitKind) : "—"}</p>
                      {upfrontText && !isCurrent && <p className="mt-0.5 text-[10px] font-semibold text-[#526078]">{upfrontText}</p>}
                    </div>
                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={duplicate}
                        onClick={() => onApplyPack(row, pack.itemId)}
                        aria-label={`${copy.choosePack}: ${localizedName(copy, pack.itemName, pack)}`}
                        className="min-h-11 shrink-0 rounded-lg border border-[#007d38] bg-[#007d38] px-2.5 text-[11px] font-extrabold text-white disabled:cursor-not-allowed disabled:border-[#b8d3c6] disabled:bg-[#e8f4ee] disabled:text-[#245d4b]"
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
      </div>}
    </li>
  );
}

// AC 2.4.1: Recommendation overview for the selected premise. The detail
// view keeps store identity, totals, item prices and savings actions together
// so the shopper can compare and swap without jumping between sections.
function RecommendationOverview({
  store,
  recommendations,
  basket,
  activeChecklist,
  preferences,
  copy,
  routeProvider,
  locale,
  onSetBasket,
  onCreateChecklist,
}: {
  store: StoreRecommendation;
  recommendations: StoreRecommendation[];
  basket: BasketItem[];
  activeChecklist: ShoppingChecklist | null;
  preferences: TravelPreferences;
  copy: AppCopy;
  routeProvider: "google" | "straight_line";
  locale: Locale;
  onSetBasket: Dispatch<SetStateAction<BasketItem[]>>;
  onCreateChecklist: (checklist: ShoppingChecklist) => void;
}) {
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

  const detailRows = useMemo(() => {
    const lines: BasketAlternativeLine[] = alternativeLines.length > 0 ? alternativeLines : store.basketPrices.map(price => ({
      quantity: price.quantity,
      source: {
        itemId: price.itemId,
        itemName: price.itemName,
        itemNameEn: price.itemNameEn,
        itemNameMs: price.itemNameMs,
        unit: price.packageSize,
        packageSize: price.packageSize,
        unitPriceRm: price.unitPriceRm,
        lineTotalRm: price.lineTotalRm,
        observedDate: price.priceObservedDate,
        priceObservedDaysAgo: null,
        priceSource: price.priceSource,
        saraEligible: price.saraEligible ?? null,
        saraCategoryCandidate: price.saraCategoryCandidate ?? false,
        isSaraCreditCandidate: price.saraEligible === true || price.saraCategoryCandidate === true,
      },
      alternative: null,
      savingsRm: null,
      packOptions: [],
    }));
    return buildRecommendationDetailRows(basket, store, lines);
  }, [alternativeLines, basket, store]);
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
  const estimatedSavings = useMemo(
    () => calculateEstimatedSavings(
      store,
      recommendations,
      detailTotals.originalSubtotalRm,
      detailTotals.currentSubtotalRm,
      routeProvider,
    ),
    [detailTotals.currentSubtotalRm, detailTotals.originalSubtotalRm, recommendations, routeProvider, store],
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
    onCreateChecklist(createShoppingChecklist(store, detailRows, {
      alternativeStores: recommendations,
      estimatedSavings,
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

  const changeQuantity = (id: string, quantity: number) => {
    onSetBasket(current => current.map(item => item.id === id ? { ...item, qty: quantity } : item));
  };

  return (
    <div className="screen-enter store-detail">
      <div className="store-detail-shell">
        <header className="store-detail-header">
          <div className="store-symbol store-detail-symbol" aria-hidden="true"><IcoStore /></div>
          <div className="store-detail-identity"><div><h1>{store.name}</h1><SaraStoreTag status={store.saraStatus} copy={copy}/></div><p>{[store.address, store.district, store.state].filter(Boolean).join(", ")}</p></div>
          <div className="store-detail-facts">
            <span><TransportModeIcon mode={preferences.transportMode}/><strong>{transportLabel(copy, preferences.transportMode)}</strong></span>
            <span><UIIcon name="history" size={20}/><strong>{store.estimatedTravelMinutes} {copy.minutes}</strong></span>
            <span><UIIcon name="route" size={20}/><strong>{store.routeDistanceKm.toFixed(1)} km</strong></span>
            <span><IcoStore/><strong>{formatRm(store.estimatedRoundTripCostRm)}</strong></span>
          </div>
          {preferences.origin && <a className="store-detail-route" href={mapsRouteUrl(preferences.origin, store, preferences.transportMode)} target="_blank" rel="noopener noreferrer">{copy.openInGoogleMaps} ↗</a>}
        </header>
        <div className="store-detail-layout">
          <section className="store-detail-items">
            <div className="store-detail-items-heading"><div><h2>{locale === "en" ? "Basket items at this store" : "Item bakul di kedai ini"}</h2><p>{copy.basketItems} · {copy.itemCount(displayedLineCount)}</p></div></div>
            <div className="store-item-columns"><span>{locale === "en" ? "Product" : "Produk"}</span><span>SARA</span><span>{locale === "en" ? "Unit size" : "Saiz unit"}</span><span>{locale === "en" ? "Qty" : "Kuantiti"}</span><span>{locale === "en" ? "Unit price" : "Harga unit"}</span><span>{locale === "en" ? "Total" : "Jumlah"}</span><span/></div>
            {alternativesLoading && <p role="status" className="store-detail-message">{copy.alternativesLoading}</p>}
            {alternativesError && <p role="alert" className="store-detail-message">{copy.alternativesUnavailable}</p>}
            {detailRows.length > 0 ? <ul className="store-item-list">{detailRows.map(row => <RecommendationBasketRow key={row.source.itemId} row={row} basket={basket} copy={copy} onApplyAlternative={applyAlternative} onApplyPack={applyPack} onUndo={undoReplacement} onChangeQuantity={changeQuantity}/>)}</ul>
              : !alternativesLoading && store.basketPrices.length > 0 ? <div className="store-detail-fallback"><CompactBasketPriceList prices={store.basketPrices} basket={basket} copy={copy}/></div> : null}
            <p className="store-price-note">{copy.stockNotVerified}</p>
          </section>
          <aside className="store-detail-sidebar">
            <section className="store-detail-summary">
              <h2><UIIcon name="basket" size={22}/>{locale === "en" ? "Basket summary" : "Ringkasan bakul"}</h2>
              <dl className="summary-counts"><div><dt>{locale === "en" ? "Items" : "Item"}</dt><dd>{displayedLineCount}</dd></div><div><dt>{locale === "en" ? "Store prices" : "Harga kedai"}</dt><dd>{displayedStorePriceCount}</dd></div><div><dt>{locale === "en" ? "Median estimates" : "Anggaran median"}</dt><dd>{displayedMedianPriceCount}</dd></div><div><dt>{locale === "en" ? "Missing prices" : "Tiada harga"}</dt><dd>{Math.max(0, displayedLineCount - displayedPricedCount)}</dd></div></dl>
              <dl className="store-summary-money"><div><dt>{hasIncompleteBasket ? (hasEstimatedPrices ? copy.estimatedPartialTotal : copy.partialTotal) : hasEstimatedPrices ? copy.estimatedSubtotal : copy.basketSubtotal}</dt><dd>{displayedSubtotal == null ? "—" : formatRm(displayedSubtotal)}</dd></div>{displayedCredit != null && displayedCash != null && <><div><dt>{copy.saraCreditLabel}</dt><dd>{formatRm(displayedCredit)}</dd></div><div><dt>{copy.cashNeededLabel}</dt><dd>{formatRm(displayedCash)}</dd></div></>}</dl>
              {displayedCredit != null && <p className="store-summary-note">{locale === "en" ? "SARA eligibility and final payment should be verified at the store." : "Kelayakan SARA dan bayaran akhir perlu disahkan di kedai."}</p>}
              <div className="store-summary-travel"><h3>{locale === "en" ? "Travel and total cost" : "Perjalanan dan jumlah kos"}</h3><div><span>{copy.returnTravel}</span><strong>{formatRm(store.estimatedRoundTripCostRm)}</strong></div><div><span>{totalLabel}</span><strong>{adjustedCombinedTotal == null ? "—" : formatRm(adjustedCombinedTotal)}</strong></div></div>
              <button type="button" className="primary-button store-start-button" disabled={alternativesLoading} onClick={beginChecklistCreation}>{alternativesLoading ? copy.checklistPreparing : activeChecklist ? copy.replaceChecklist : copy.createChecklist} →</button>
            </section>
            {!alternativesLoading && <EstimatedSavingsSummary snapshot={estimatedSavings} locale={locale}/>}
          </aside>
        </div>
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
  onSelectStore,
  preferences,
  candidateCacheId,
  onChangeTravel,
  copy,
}: {
  basket: BasketItem[];
  setBasket: Dispatch<SetStateAction<BasketItem[]>>;
  activeChecklist: ShoppingChecklist | null;
  onCreateChecklist: (checklist: ShoppingChecklist) => void;
  selectedStore: StoreRecommendation | null;
  onSelectStore: (store: StoreRecommendation) => void;
  preferences: TravelPreferences;
  candidateCacheId: string | null;
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
  const [requestBasketLines, setRequestBasketLines] = useState(() => basketLines);
  const [requestCandidateCacheId] = useState(candidateCacheId);
  const hasBasket = requestBasketLines.length > 0;
  const previousSelectedStore = useRef(selectedStore);

  useEffect(() => {
    if (previousSelectedStore.current && !selectedStore) {
      const nextBasketLines = toBasketLineRequests(basket);
      const basketChanged = JSON.stringify(nextBasketLines) !== JSON.stringify(requestBasketLines);
      // Returning without changing the basket can reuse the existing list;
      // only swaps require a fresh recommendation request.
      if (basketChanged) {
        setLoading(true);
        setRequestBasketLines(nextBasketLines);
      }
    }
    previousSelectedStore.current = selectedStore;
  }, [basket, requestBasketLines, selectedStore]);

  useEffect(() => {
    if (!preferences.origin) {
      setError(copy.chooseStartingLocation);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    // AC 2.3.2: a fresh recommendation list starts again at the first five.
    setVisibleCount(VISIBLE_STEP);
    setExpandedStoreId(null);

    getRecommendations({
      ...(requestBasketLines.length > 0 ? { basket: requestBasketLines } : {}),
      ...(requestCandidateCacheId ? { candidateCacheId: requestCandidateCacheId } : {}),
      travel: recommendationTravelRequest(preferences),
    }, controller.signal)
      .then(response => {
        setResult(response);
            setVisibleCount(VISIBLE_STEP);
        setExpandedStoreId(null);
      })
      .catch(requestError => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(copy.recommendationsUnavailable);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [requestBasketLines, requestCandidateCacheId, copy.chooseStartingLocation, copy.recommendationsUnavailable, preferences]);

  const recommendations = result?.recommendations ?? [];
  const recommendedStore = recommendations.find(store => (store.pricedCount ?? 0) > 0);
  const visibleStores = recommendations.slice(0, visibleCount);
  const modeLabel = transportLabel(copy, preferences.transportMode) || copy.selectedTransport;
  const originLabel = preferences.origin?.label ?? "";
  const limitLabel = preferences.limitType === "both"
    ? `${preferences.distanceKm} km · ${preferences.timeMinutes} ${copy.minutes}`
    : preferences.limitType === "distance"
    ? preferences.limitValue + " km"
    : preferences.limitValue + " " + copy.minutes;

  // AC 2.4.1: once a store is selected the overview replaces the list. It
  // renders the saved snapshot, so a background refresh of the list can
  // never swap the premise, basket or travel preferences underneath it;
  // going back simply clears the snapshot and the list reappears as-is.
  if (selectedStore) {
    return (
      <RecommendationOverview
        store={selectedStore}
        recommendations={recommendations}
        basket={basket}
        activeChecklist={activeChecklist}
        onSetBasket={setBasket}
        onCreateChecklist={onCreateChecklist}
        preferences={preferences}
        copy={copy}
        routeProvider={result?.routeProvider ?? "google"}
        locale={copy === COPY.ms ? "ms" : "en"}
      />
    );
  }

  return (
    <div className="screen-enter compare-screen pb-8">
      <div className="flex flex-col gap-6 px-4 pb-6 pt-5 sm:gap-8 sm:px-6 sm:pt-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10152e] sm:text-[36px] sm:leading-[42px]">
            {copy.recommendationTitle}
          </h1>
          <p className="text-sm leading-5 text-[#526078]">
            {result?.routeProvider === "straight_line" ? copy.straightLineFallbackNote : copy.storesWithinLimit(limitLabel, originLabel, modeLabel)}
          </p>
          {preferences.saraFilter === "candidate" && (
            <p className="text-sm font-medium text-[#7a5b00]">{copy.saraFilterApplied}</p>
          )}
        </div>

        <div className="comparison-context"><div><UIIcon name="home"/><span><small>{copy === COPY.ms ? "Dari" : "From"}</small><strong>{originLabel || "—"}</strong></span></div><div><TransportModeIcon mode={preferences.transportMode}/><span><small>{copy.transportMode}</small><strong>{modeLabel}</strong></span></div><div><UIIcon name="history"/><span><small>{copy.travelLimit}</small><strong>{limitLabel}</strong></span></div><div><IcoStore/><span><small>{copy === COPY.ms ? "Kedai" : "Stores"}</small><strong>{loading ? "—" : recommendations.length}</strong></span></div></div>
        {loading && (
          <div role="status" className="rounded-2xl border border-[#dce5e0] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#cce3d9] border-t-[#007d38]" />
            <p className="font-bold text-[#10152e]">{copy.checkingStores}</p>
            <p className="mt-1 text-sm text-[#526078]">{copy.routeTimesNote}</p>
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
            {result.expandedSearch && (
              <div role="status" className="rounded-2xl border border-[#efd3a6] bg-[#fff7e8] p-4 text-sm leading-5 text-[#7a4d00]">
                {copy.expandedSearchNotice}
              </div>
            )}
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold leading-7 text-[#10152e]">{result.routeProvider === "straight_line" ? copy.nearbyStores : copy.reachablePremises}</h2>
                <p className="mt-1 text-sm text-[#526078]">{result.routeProvider === "straight_line" ? `${recommendations.length} / ${result.totalCandidatesEvaluated}` : copy.reachableSummary(recommendations.length, result.totalCandidatesEvaluated)}</p>
              </div>
              <span className="text-right text-xs font-medium text-[#718078]">{hasBasket ? copy.lowerTravelFirst : "Lower travel cost first"}</span>
            </div>

            <div className="store-grid">
              {visibleStores.map(store => (
                <StoreCard
                  key={store.premiseId}
                  store={store}
                  isRecommended={recommendedStore?.premiseId === store.premiseId}
                  routeUrl={preferences.origin ? mapsRouteUrl(preferences.origin, store, preferences.transportMode) : undefined}
                  pricesExpanded={expandedStoreId === store.premiseId}
                  onTogglePrices={() => setExpandedStoreId(current => (current === store.premiseId ? null : store.premiseId))}
                  onSelectStore={() => onSelectStore(store)}
                  copy={copy}
                  transportMode={preferences.transportMode}
                />
              ))}

              {/* Page the unified ranking five stores at a time. */}
              {hasMoreStores(visibleCount, recommendations.length) && (
                <button type="button" onClick={() => setVisibleCount(count => nextVisibleCount(count, recommendations.length))} className="h-12 w-full rounded-xl border border-[#007d38] bg-white text-sm font-bold text-[#007d38]">
                  {copy.moreStores}
                </button>
              )}

              {recommendations.length === 0 && (
                <div className="rounded-2xl border border-[#bec8ca] bg-white p-5 text-center">
                  <p className="font-semibold text-[#191c1d]">{copy.noStores}</p>
                  <p className="mt-1 text-sm text-[#526078]">{copy.noStoresHint}</p>
                  <button type="button" onClick={onChangeTravel} className="mt-3 min-h-11 px-3 font-bold text-[#00535b]">{copy.changeTravel}</button>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const screen = screenForPath(pathname);
  const isStoreRoute = pathname.startsWith("/store/");
  const pendingPathRef = useRef<string | null>(null);
  const navigateTo = (next: Screen) => {
    pendingPathRef.current = SCREEN_ROUTES[next];
    router.push(SCREEN_ROUTES[next]);
  };
  const [resumeStep, setResumeStep] = useState<TripJourneyStep>("location");
  const [basket, setBasket] = useState<BasketItem[]>(INIT_BASKET);
  const [selectedStore, setSelectedStore] = useState<StoreRecommendation | null>(null);
  const [candidateCacheId, setCandidateCacheId] = useState<string | null>(null);
  const candidatePreparationController = useRef<AbortController | null>(null);
  const [checklist, setChecklist] = useState<ShoppingChecklist | null>(null);
  const [checklistStorageReady, setChecklistStorageReady] = useState(false);
  const [savedItems, setSavedItems] = useState<NextTripItem[]>([]);
  const [savedItemsReady, setSavedItemsReady] = useState(false);
  const [savedItemsToUse, setSavedItemsToUse] = useState<NextTripItem[]>([]);
  const [tripHistory, setTripHistory] = useState<TripRecord[]>([]);
  const [tripHistoryStorageReady, setTripHistoryStorageReady] = useState(false);
  const [inbox, setInbox] = useState<InboxState>(EMPTY_INBOX);
  const [inboxStorageReady, setInboxStorageReady] = useState(false);
  const [restartTripOpen, setRestartTripOpen] = useState(false);
  const [tripNotification, setTripNotification] = useState({ id: 0, message: "" });
  const [locale, setLocale] = useState<Locale>("en");
  const [preferences, setPreferences] = useState<TravelPreferences>({
    origin: null,
    transportMode: "motorcycle",
    limitType: "distance",
    limitValue: 5,
    distanceKm: 5,
    timeMinutes: 20,
    saraFilter: "any",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (pendingPathRef.current === pathname) pendingPathRef.current = null;
    // Saving a plan clears the selected store before the home route commits.
    // Do not let the direct-link fallback override that navigation.
    if (isStoreRoute && !selectedStore && !pendingPathRef.current) router.replace(SCREEN_ROUTES.compare);
  }, [isStoreRoute, pathname, router, selectedStore]);

  useEffect(() => () => candidatePreparationController.current?.abort(), []);

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

  useEffect(() => {
    try {
      setSavedItems(parseNextTrip(window.localStorage.getItem(NEXT_TRIP_STORAGE_KEY)));
    } catch {
      setSavedItems([]);
    } finally {
      setSavedItemsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!savedItemsReady) return;
    try {
      window.localStorage.setItem(NEXT_TRIP_STORAGE_KEY, serializeNextTrip(savedItems));
    } catch {
      // Retain the list in memory when device storage is unavailable.
    }
  }, [savedItems, savedItemsReady]);

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
      setInbox(parseInboxState(window.localStorage.getItem(INBOX_STORAGE_KEY)));
    } catch {
      setInbox(EMPTY_INBOX);
    } finally {
      setInboxStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!inboxStorageReady) return;
    try {
      window.localStorage.setItem(INBOX_STORAGE_KEY, serializeInboxState(inbox));
    } catch {
      // Reports remain readable in memory if device storage is unavailable.
    }
  }, [inbox, inboxStorageReady]);

  useEffect(() => {
    if (!inboxStorageReady || !tripHistoryStorageReady) return;
    setInbox(current => syncInboxReports(current, tripHistory));
  }, [inboxStorageReady, tripHistory, tripHistoryStorageReady]);

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
      const saraFilter: SaraFilter = saved.saraFilter === "verified" || saved.saraFilter === "candidate"
        ? "candidate"
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
  const hasTripInProgress = preferences.origin != null || basket.length > 0;
  const unreadReportCount = inbox.messages.filter(message => !message.read).length;
  const toggleLanguage = () => setLocale(current => current === "en" ? "ms" : "en");
  const updatePreferencesDraft = useCallback((next: TravelPreferences) => {
    candidatePreparationController.current?.abort();
    setCandidateCacheId(null);
    setPreferences(next);
  }, []);
  const prepareCandidates = useCallback((next: TravelPreferences) => {
    if (!next.origin) return;
    candidatePreparationController.current?.abort();
    const controller = new AbortController();
    candidatePreparationController.current = controller;
    setCandidateCacheId(null);
    prepareRecommendationCandidates(recommendationTravelRequest(next), controller.signal)
      .then(response => {
        if (!controller.signal.aborted) setCandidateCacheId(response.candidateCacheId);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Candidate preparation is an optimization. The explicit Search stores
        // action remains the user-visible retry and fetches fresh prices.
      });
  }, []);
  const navigateTrip = (next: TripJourneyStep) => {
    setResumeStep(next);
    navigateTo(next);
  };
  const resetTrip = () => {
    candidatePreparationController.current?.abort();
    setCandidateCacheId(null);
    setBasket([]);
    setSelectedStore(null);
    setPreferences(current => ({ ...current, origin: null }));
    setResumeStep("location");
    setSavedItemsToUse([]);
  };
  const startNewTrip = () => {
    resetTrip();
    setRestartTripOpen(false);
    navigateTo("location");
  };
  const updateChecklistStatus = (itemId: string, status: Exclude<ChecklistStatus, "neutral">) => {
    if (!checklist) return;
    const currentItem = checklist.items.find(item => item.id === itemId);
    if (!currentItem) return;
    // Unticking a purchased item records it as unbought and keeps it for later.
    const isSaved = savedItems.some(item => item.id === nextTripItemId(currentItem));
    let next = checklist;
    if (status === "bought") {
      next = toggleChecklistItemStatus(checklist, itemId, currentItem.status === "bought" ? "not_bought" : "bought");
    } else if ((currentItem.status === "not_bought") === isSaved) {
      // A saved item can also be neutral after recording an unfinished trip.
      next = toggleChecklistItemStatus(checklist, itemId, "not_bought");
    }
    setChecklist(next);
    const item = next.items.find(candidate => candidate.id === itemId)!;
    setSavedItems(current => (status === "not_bought" ? !isSaved : item.status === "not_bought")
      ? saveForNextTrip(current, item)
      : current.filter(saved => saved.id !== nextTripItemId(item)));
  };
  const addChecklistItem = (input: ManualChecklistItemInput) => {
    setChecklist(current => current ? addManualChecklistItem(current, input) ?? current : current);
  };
  const editChecklistItem = (itemId: string, input: ManualChecklistItemInput) => {
    if (!checklist) return;
    const next = editChecklistValues(checklist, itemId, input) ?? checklist;
    setChecklist(next);
    const item = next.items.find(candidate => candidate.id === itemId);
    if (item) setSavedItems(current => current.some(saved => saved.id === nextTripItemId(item)) ? saveForNextTrip(current, item) : current);
  };
  const revertItem = (itemId: string) => {
    if (!checklist) return;
    const next = revertChecklistItem(checklist, itemId);
    setChecklist(next);
    const item = next.items.find(candidate => candidate.id === itemId);
    if (item) setSavedItems(current => current.some(saved => saved.id === nextTripItemId(item)) ? saveForNextTrip(current, item) : current);
  };
  const removeSavedItem = (id: string) => {
    setSavedItems(current => current.filter(item => item.id !== id));
    setSavedItemsToUse(current => current.filter(item => item.id !== id));
  };
  const restoreSavedItem = async (item: NextTripItem) => {
    if (!checklist) return;

    let quote: NextTripPriceQuote | undefined;
    if (item.catalogueItemId != null) {
      try {
        const response = await getBasketAlternatives(
          checklist.store.premiseId,
          [{ itemId: item.catalogueItemId, quantity: item.quantity }],
        );
        const source = response.lines[0]?.source;
        if (source) {
          quote = {
            itemName: source.itemName,
            itemNameEn: source.itemNameEn,
            itemNameMs: source.itemNameMs,
            packageSize: source.packageSize,
            unitPriceRm: source.unitPriceRm,
            observedDate: source.observedDate,
            priceSource: source.priceSource,
          };
        }
      } catch {
        // A saved item is still useful when the price lookup is unavailable;
        // keep its price explicit as unavailable rather than inventing one.
      }
    }

    setChecklist(current => current ? addNextTripItem(current, item, quote) : current);
    removeSavedItem(item.id);
  };
  const planWithSavedItems = () => {
    setBasket(current => nextTripBasket(current, savedItems));
    setSavedItemsToUse(savedItems);
    navigateTrip(preferences.origin ? "shop" : "location");
  };
  const removeChecklistItem = (itemId: string) => {
    setChecklist(current => current ? deleteChecklistItem(current, itemId) : current);
  };
  const removeChecklist = () => {
    setChecklist(null);
    navigateTo("home");
  };
  const recordTrip = () => {
    if (!checklist) return;
    const record = buildTripRecord(checklist);
    setSavedItems(current => checklist.items.reduce((saved, item) => saveForNextTrip(saved, item), current));
    // The record appears in the in-memory history immediately (no reload) and
    // is persisted by the storage effect above.
    setTripHistory(current => addTripRecord(current, record));
    setTripNotification(current => ({ id: current.id + 1, message: copy.tripRecorded }));
    navigateTo("history");
  };
  return (
    <div className="smartcart-app">
      <Header
        screen={screen}
        onNavigate={navigateTo}
        basketCount={basketCount}
        basketActive={screen === "basket"}
        showBasket={screen === "shop" || screen === "basket" || screen === "compare"}
        onBasket={() => navigateTrip("basket")}
        onHome={() => navigateTo("home")}
        locale={locale}
        onToggleLanguage={toggleLanguage}
        copy={copy}
      />

      <main className={"app-main screen-" + screen}>
        {screen === "home" ? (
          <>
          <SmartCartHomeScreen
            locale={locale}
            checklist={checklist}
            history={tripHistory}
            unreadReports={unreadReportCount}
            hasTripInProgress={hasTripInProgress}
            resumeStep={resumeStep}
            onStartOrResume={() => navigateTrip(hasTripInProgress ? resumeStep : "location")}
            onStartNew={() => hasTripInProgress ? setRestartTripOpen(true) : startNewTrip()}
            onChecklist={() => navigateTo("checklist")}
            onHistory={() => navigateTo("history")}
            onInbox={() => navigateTo("inbox")}
          />
          {savedItems.length > 0 && <div className="px-4 pb-8 sm:px-6"><NextTripList items={savedItems} locale={locale} copy={copy} onUse={planWithSavedItems} onRemove={removeSavedItem} /></div>}
          </>
        ) : null}
        {screen === "checklist" ? checklist ? (
          <ShoppingChecklistScreen
            checklist={checklist}
            locale={locale}
            copy={copy}
            onToggleStatus={updateChecklistStatus}
            onAddManual={addChecklistItem}
            onEditItem={editChecklistItem}
            onRevertItem={revertItem}
            savedItems={savedItems}
            onRestoreSavedItem={restoreSavedItem}
            onRemoveSavedItem={removeSavedItem}
            onDeleteItem={removeChecklistItem}
            onDeleteChecklist={removeChecklist}
            alreadyRecorded={tripHistory.some(record => record.checklistId === checklist.id)}
            onRecordTrip={recordTrip}
          />
        ) : (
          <EmptyChecklistScreen
            locale={locale}
            copy={copy}
            savedItems={savedItems}
            onUseSavedItems={planWithSavedItems}
            onRemoveSavedItem={removeSavedItem}
            onStartOrResume={() => navigateTrip(hasTripInProgress ? resumeStep : "location")}
          />
        ) : null}
        {screen === "history" ? <ReceiptHistoryScreen history={tripHistory} locale={locale} /> : null}
        {screen === "inbox" ? (
          <ReportScreen
            state={inbox}
            locale={locale}
            history={tripHistory}
            onCadence={(cadence: ReportCadence) => setInbox(current => setReportCadence(current, cadence))}
            onRead={id => setInbox(current => markReportRead(current, id))}
            onToggleSummary={() => setInbox(current => setSummaryHidden(current, !current.summaryHidden))}
          />
        ) : null}
        {screen === "shop" ? (
          <BasketScreen
            view="shop"
            candidateCacheId={candidateCacheId}
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => navigateTrip("basket")}
            onContinue={() => navigateTrip("basket")}
            copy={copy}
            locale={locale}
          />
        ) : null}
        {screen === "basket" ? (
          <BasketScreen
            view="basket"
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => navigateTrip("basket")}
            onContinue={() => navigateTrip("compare")}
            copy={copy}
            locale={locale}
          />
        ) : null}
        {screen === "location" ? (
          <LocationScreen
            preferences={preferences}
            copy={copy}
            onDraftChange={updatePreferencesDraft}
            onCompare={nextPreferences => {
              setPreferences(nextPreferences);
              prepareCandidates(nextPreferences);
              navigateTrip("shop");
            }}
          />
        ) : null}
        {screen === "compare" ? (
          <CompareScreen
            basket={basket}
            setBasket={setBasket}
            activeChecklist={checklist}
            onCreateChecklist={nextChecklist => {
              // Respect catalogue items removed from the planning basket.
              // Manual items are added only to the checklist, with no quote.
              const usedSavedItems = savedItems.filter(item =>
                savedItemsToUse.some(saved => saved.id === item.id)
                && (item.source === "manual" || nextChecklist.items.some(line => nextTripItemId(line) === item.id)));
              const withSavedItems = usedSavedItems.reduce(
                (current, saved) => addNextTripItem(current, saved),
                nextChecklist,
              );
              setChecklist(withSavedItems);
              setSavedItems(current => current.filter(item => !usedSavedItems.some(saved => saved.id === item.id)));
              resetTrip();
              navigateTo("home");
            }}
            selectedStore={isStoreRoute ? selectedStore : null}
            onSelectStore={store => {
              setSelectedStore(store);
              router.push(`/store/${encodeURIComponent(store.premiseId)}`);
            }}
            preferences={preferences}
            candidateCacheId={candidateCacheId}
            onChangeTravel={() => navigateTo("location")}
            copy={copy}
          />
        ) : null}
      </main>
      <ConfirmationDialog
        open={restartTripOpen}
        title={locale === "ms" ? "Mulakan perjalanan baharu?" : "Start a new trip?"}
        body={locale === "ms"
          ? "Bakul dan kemajuan perjalanan semasa akan dikosongkan. Senarai semak aktif dan sejarah anda tidak akan berubah."
          : "Your current basket and trip progress will be cleared. Your active checklist and shopping history will not change."}
        confirmLabel={locale === "ms" ? "Mulakan baharu" : "Start new"}
        cancelLabel={copy.cancel}
        destructive
        onCancel={() => setRestartTripOpen(false)}
        onConfirm={startNewTrip}
      />
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
