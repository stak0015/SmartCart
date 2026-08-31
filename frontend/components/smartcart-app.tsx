"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { listCategories, searchItems, type Item } from "@/lib/api";
import { DEFAULT_QTY, MAX_QTY, basketDetails, basketSummary, parseQty, resultRowFields, stepQty, upsertBasketLine } from "@/lib/result-row";
import { COPY, categoryLabel, type AppCopy, type Locale } from "@/lib/i18n";
import {
  getRecommendations,
  getBasketAlternatives,
  resolveLocation,
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
} from "@/lib/contracts";
import { toBasketLineRequests } from "@/lib/basket-lines";
import {
  applyBasketSwap,
  currentSwapSavingRm,
  undoBasketSwap,
  type BasketItem,
} from "@/lib/basket-state";
import { isCompleteBasket } from "@/lib/basket-coverage";
import { formatRm } from "@/lib/format-rm";
import { VISIBLE_STEP, hasMoreStores, nextVisibleCount } from "@/lib/visible-stores";
import svgPathsBasket from "@/components/icons/basket";
import svgPathsLocation from "@/components/icons/location";
import svgPathsCompare from "@/components/icons/compare";
import svgPathsSaved from "@/components/icons/saved";

// ── Types ───────────────────────────────────────────────────────────────────
type Screen = "shop" | "basket" | "location" | "compare";

interface TravelPreferences {
  origin: SelectedLocation | null;
  transportMode: TransportMode;
  limitType: TravelLimitType;
  limitValue: number;
  saraFilter: SaraFilter;
}

const INIT_BASKET: BasketItem[] = [];
const HIDDEN_RECOMMENDATION_NAMES = new Set(["TESCO PUCHONG"]);

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

function formatPriceDate(date: string | null | undefined): string {
  if (!date) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

function latestPriceDate(prices: BasketItemPrice[]): string | null {
  return prices
    .map(price => price.priceObservedDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1) ?? null;
}

function TripDetails({
  store,
  copy,
  basketSubtotal,
  basketLineCount,
  incomplete = false,
}: {
  store: StoreRecommendation;
  copy: AppCopy;
  basketSubtotal?: number | null;
  basketLineCount?: number | null;
  incomplete?: boolean;
}) {
  const hasBasket = (basketLineCount ?? 0) > 0;

  return (
    <div className={"grid grid-cols-2 gap-2 " + (hasBasket ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      <div className="rounded-xl bg-[#f3faf7] p-3">
        <p className="text-xs text-[#617069]">{copy.returnTravel}</p>
        <p className="mt-1 text-lg font-extrabold text-[#087f5b]">{formatRm(store.estimatedRoundTripCostRm)}</p>
      </div>
      <div className="rounded-xl bg-[#f7f8f6] p-3">
        <p className="text-xs text-[#617069]">{copy.oneWay}</p>
        <p className="mt-1 text-lg font-extrabold text-[#17362c]">{store.estimatedTravelMinutes} {copy.minutes}</p>
      </div>
      <div className="rounded-xl bg-[#f7f8f6] p-3">
        <p className="text-xs text-[#617069]">{copy.route}</p>
        <p className="mt-1 text-lg font-extrabold text-[#17362c]">{store.routeDistanceKm.toFixed(1)} km</p>
      </div>
      {hasBasket && (
        <div className={"rounded-xl p-3 " + (incomplete ? "bg-[#f3f4f5]" : "bg-[#e7f7f0]")}>
          <p className={"text-xs " + (incomplete ? "text-[#5f6368]" : "text-[#286d67]")}>
            {incomplete ? copy.partialTotal : copy.basketSubtotal}
          </p>
          <p className={"mt-1 text-lg font-extrabold " + (incomplete ? "text-[#3f4944]" : "text-[#175f4b]")}>
            {basketSubtotal == null ? "—" : formatRm(basketSubtotal)}
          </p>
          {store.pricedCount != null && basketLineCount != null && (
            <p className={"mt-1 text-[11px] font-medium " + (incomplete ? "text-[#5f6368]" : "text-[#286d67]")}>
              {copy.priceCoverage(store.pricedCount ?? 0, basketLineCount)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CompactBasketPriceList({ prices, copy }: { prices: BasketItemPrice[]; copy: AppCopy }) {
  return (
    <ul className="flex flex-col gap-2 rounded-xl bg-[#f7f8f6] p-3">
      {prices.map(price => (
        <li key={price.itemId} className="flex items-start justify-between gap-3 border-b border-[#e2e9e5] pb-2 last:border-b-0 last:pb-0">
          <div className="min-w-0">
            <p className="break-words text-[13px] font-semibold text-[#17362c]">{price.itemName}</p>
            {price.packageSize && <p className="mt-0.5 text-xs text-[#718078]">{price.packageSize}</p>}
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
  onBasket: () => void;
  basketActive: boolean;
  onBack?: () => void;
  locale: Locale;
  onToggleLanguage: () => void;
  copy: AppCopy;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e7ece9] bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-[760px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        {onBack ? (
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 justify-self-start text-sm font-bold text-[#087f5b]">
            <IcoArrowBack /> {copy.back}
          </button>
        ) : <span aria-hidden="true" />}

        <span className="text-lg font-extrabold tracking-[-0.3px] text-[#10231d]">SmartCart</span>

        <div className="flex items-center gap-2 justify-self-end">
          <LanguageToggle locale={locale} onToggle={onToggleLanguage} />
          <button
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
          </button>
        </div>
      </div>
    </header>
  );
}

// ── Progress indicator ────────────────────────────────────────────────────────
function ProgressIndicator({ step, copy }: { step: 1 | 2 | 3 | 4; copy: AppCopy }) {
  const steps = [
    { n: 1, label: copy.shop },
    { n: 2, label: copy.basket },
    { n: 3, label: copy.travel },
    { n: 4, label: copy.compare },
  ] as const;

  return (
    <div aria-label={copy.step(step)} className="grid w-full grid-cols-4 rounded-xl bg-[#edf3ef] p-1">
      {steps.map(current => (
        <div
          key={current.n}
          className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center text-[11px] font-bold sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5 sm:text-sm ${
            step === current.n ? "bg-white text-[#087f5b] shadow-sm" : current.n < step ? "text-[#087f5b]" : "text-[#617069]"
          }`}
        >
          <span aria-hidden="true">{current.n < step ? "✓" : current.n}</span>
          <span className="min-w-0 break-words leading-4">{current.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Screen 1: Build Your Basket ───────────────────────────────────────────────
function BasketScreen({
  view,
  basket,
  setBasket,
  onViewBasket,
  onContinue,
  copy,
  locale,
}: {
  view: "shop" | "basket";
  basket: BasketItem[];
  setBasket: (b: BasketItem[]) => void;
  onViewBasket: () => void;
  onContinue: () => void;
  copy: AppCopy;
  locale: Locale;
}) {
  const [search, setSearch] = useState("");
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

  const updateQty = (id: string, delta: number) => {
    setBasket(basket.map(b => b.id === id ? { ...b, qty: Math.max(1, b.qty + delta) } : b));
  };

  const removeItem = (id: string) => setBasket(basket.filter(b => b.id !== id));

  // Convert a real database Item into a BasketItem and add it to the basket.
  // id is prefixed with "db-" to avoid colliding with the demo STORES ids ("1".."5").
  // Package size comes from the same mapping as the result row, so both views
  // always show identical details; unparsed values show "—".
  const addRealItem = (item: Item, qty: number) => {
    // AC-1.4.2: same item added again increases quantity, never duplicates.
    setBasket(upsertBasketLine(basket, {
      id: `db-${item.item_id}`,
      ...basketDetails(item),
      qty,
      saraEligible: item.sara_eligible,
      saraCategoryCandidate: item.sara_category_candidate,
    }));
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

  return (
    <div className="screen-enter pb-32">
      {view === "shop" && (
        <>
      {/* Progress */}
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <ProgressIndicator step={1} copy={copy} />
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
            type="text"
            aria-label={copy.searchAria}
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-14 w-full rounded-2xl border border-[#dce5e0] bg-white pl-12 pr-4 text-[16px] text-[#10231d] shadow-[0_3px_14px_rgba(16,35,29,0.07)] placeholder:text-[#718078] focus:border-[#087f5b] focus:outline-none"
          />
        </div>
      </div>

      {/* Multi-select category filter */}
      <div className="relative z-[60] px-4 pb-6 pt-1 sm:px-6">
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
              {activeCategories.length === 0 ? copy.allCategories : copy.categoriesSelected(activeCategories.length)}
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
              const fields = resultRowFields(item);
              const rawQty = qtyById[item.item_id] ?? String(DEFAULT_QTY);
              const qty = parseQty(rawQty); // null while the typed value is invalid (AC-1.4.1)
              return (
              <article key={item.item_id} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-[#e2e9e5] bg-white p-3 shadow-[0_3px_12px_rgba(16,35,29,0.045)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="break-words text-[15px] font-extrabold leading-5 text-[#10231d]">{fields.name}</h3>
                  <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-0.5 text-[12px] leading-5">
                    <span className="break-words text-[#617069]">{fields.packageSize}</span>
                    <span className="break-words text-[#718078]">{categoryLabel(locale, item.item_category)}</span>
                  </div>
                  <SaraEligibilityFlag status={item.sara_eligible} categoryCandidate={item.sara_category_candidate} copy={copy} />
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:items-end">
                  <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <button type="button" aria-label={copy.decreaseQuantity(fields.name)} disabled={qty === DEFAULT_QTY} onClick={() => stepResultQty(item.item_id, -1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd8d1] text-lg text-[#087f5b] disabled:opacity-40">−</button>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={copy.quantityFor(fields.name)}
                      aria-invalid={qty === null}
                      aria-describedby={qty === null ? `quantity-error-${item.item_id}` : undefined}
                      value={rawQty}
                      onChange={e => typeResultQty(item.item_id, e.target.value)}
                      className={`h-11 w-12 rounded-xl border text-center text-sm font-bold focus:outline-none ${qty === null ? "border-[#c92a2a] bg-[#fff5f5] text-[#93000a] focus:border-[#c92a2a]" : "border-[#cbd8d1] text-[#10231d] focus:border-[#087f5b]"}`}
                    />
                    <button type="button" aria-label={copy.increaseQuantity(fields.name)} disabled={qty === MAX_QTY} onClick={() => stepResultQty(item.item_id, 1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087f5b] text-lg text-white disabled:opacity-40">+</button>
                    <button
                      disabled={qty === null}
                      onClick={() => { if (qty === null) return; addRealItem(item, qty); }}
                      aria-label={`${copy.addToBasket}: ${fields.name}`}
                      className="min-h-11 min-w-[76px] whitespace-normal break-words rounded-xl border border-[#087f5b] bg-white px-3 py-2 text-[14px] font-extrabold leading-5 text-[#087f5b] hover:bg-[#edf7f2] disabled:border-[#cbd8d1] disabled:text-[#718078] disabled:hover:bg-white"
                    >
                      {copy.addShort}
                    </button>
                  </div>
                  {qty === null && (
                    <p id={`quantity-error-${item.item_id}`} role="alert" className="max-w-full break-words text-right text-[13px] font-semibold leading-5 text-[#c92a2a]">{copy.quantityError}</p>
                  )}
                </div>
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

        </>
      )}

      {/* Your basket */}
      {view === "basket" && (
        <>
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <ProgressIndicator step={2} copy={copy} />
        <p className="mb-1 mt-6 text-sm font-bold text-[#087f5b]">{copy.basketEyebrow}</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">{copy.basketTitle}</h1>
        <p className="mt-2 text-[16px] leading-6 text-[#53635c]">{copy.basketDescription}</p>
      </div>

      <div className="px-4 pb-8 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_4px_18px_rgba(16,35,29,0.05)]">
          {/* Heading */}
          <div className="flex items-center justify-between border-b border-[#edf1ef] px-4 py-4">
            <div className="flex items-center gap-2">
              <IcoBasket color="#087f5b" size={22} />
              <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.basketItems}</h2>
            </div>
            <span className="text-sm font-bold text-[#617069]">{copy.itemCount(itemCount)}</span>
          </div>

          <div className="p-4">

          {basket.length === 0 ? (
            <p className="text-[16px] text-[#3e494a] text-center py-4">{copy.basketEmpty}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {basket.map((item, idx) => (
                <div key={item.id}>
                  <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1.5 sm:pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-[15px] font-bold leading-5 text-[#10231d]">{item.name}</p>
                        {item.swap && <span className="rounded-md bg-[#e7f7f0] px-2 py-1 text-[11px] font-extrabold text-[#17634f]">{copy.swapped}</span>}
                      </div>
                      <p className="break-words text-[13px] leading-5 text-[#617069]">{item.size}</p>
                      <SaraEligibilityFlag status={item.saraEligible} categoryCandidate={item.saraCategoryCandidate} copy={copy} />
                      {item.swap && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#286d67]">
                          <span>{copy.swappedAt(item.swap.premiseName)} · {copy.saveAmount(formatRm(currentSwapSavingRm(item)))}</span>
                          <button type="button" onClick={() => setBasket(undoBasketSwap(basket, item.id))} className="min-h-9 font-extrabold text-[#087f5b] underline underline-offset-2">{copy.undoSwap}</button>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 self-start sm:self-auto">
                      <button aria-label={copy.decreaseQuantity(item.name)} onClick={() => updateQty(item.id, -1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd8d1] text-lg text-[#087f5b]">−</button>
                      <span aria-label={copy.selectedQuantity(item.qty)} className="w-7 text-center text-sm font-bold">{item.qty}</span>
                      <button aria-label={copy.increaseQuantity(item.name)} onClick={() => updateQty(item.id, 1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087f5b] text-lg text-white">+</button>
                      <button aria-label={copy.removeItem(item.name)} onClick={() => removeItem(item.id)} className="flex h-11 w-9 items-center justify-center">
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
        </div>
      </div>
        </>
      )}

      {(view === "basket" || itemCount > 0) && !(view === "shop" && categoryOpen) && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[712px] flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="min-w-0 flex-1 break-words text-sm font-semibold text-[#617069]">{copy.itemCount(itemCount)}</p>
          <button
            onClick={view === "shop" ? onViewBasket : handleContinue}
            className="flex min-h-14 w-full min-w-0 items-center justify-center gap-2 whitespace-normal break-words rounded-2xl bg-[#087f5b] px-5 py-2 text-center text-[15px] font-extrabold leading-5 text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)] sm:w-auto sm:min-w-[190px]"
          >
            {view === "shop" ? copy.viewBasket : copy.chooseLocation}
            <IcoArrowRight />
          </button>
        </div>
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
  { id: "public_transport", Icon: ({ active }: { active: boolean }) => <IcoBusFigma color={active ? "white" : "#3E494A"} /> },
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

const DISTANCE_LIMITS = [2, 5, 10, 15] as const;
const TIME_LIMITS = [10, 20, 30, 45] as const;

function LocationScreen({
  preferences,
  onBack,
  onCompare,
  copy,
}: {
  preferences: TravelPreferences;
  onBack: () => void;
  onCompare: (preferences: TravelPreferences) => void;
  copy: AppCopy;
}) {
  const [locationInput, setLocationInput] = useState(preferences.origin?.label ?? "");
  const [selectedOrigin, setSelectedOrigin] = useState<SelectedLocation | null>(preferences.origin);
  const [transportMode, setTransportMode] = useState<TransportMode>(preferences.transportMode);
  const [limitType, setLimitType] = useState<TravelLimitType>(preferences.limitType);
  const [limitValue, setLimitValue] = useState(preferences.limitValue);
  const [saraFilter, setSaraFilter] = useState<SaraFilter>(preferences.saraFilter);
  const [remember, setRemember] = useState(true);
  const [sessionToken, setSessionToken] = useState(createLocationSessionToken);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "resolving" | "locating">("idle");
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (selectedOrigin?.source !== "device" || selectedOrigin.label === copy.currentLocation) return;
    setSelectedOrigin({ ...selectedOrigin, label: copy.currentLocation });
    setLocationInput(copy.currentLocation);
  }, [copy.currentLocation, selectedOrigin]);

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
    setSearchState("resolving");
    setLocationError("");
    try {
      const resolved = await resolveLocation(suggestion.placeId, sessionToken);
      const origin: SelectedLocation = { ...resolved, source: "search" };
      setSelectedOrigin(origin);
      setLocationInput(origin.label);
      setSuggestions([]);
      setActiveSuggestion(-1);
      setSessionToken(createLocationSessionToken());
    } catch {
      setLocationError(copy.locationSelectionFailed);
    } finally {
      setSearchState("idle");
    }
  };

  const usePreciseLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(copy.geolocationUnsupported);
      return;
    }

    setSearchState("locating");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      position => {
        const origin: SelectedLocation = {
          label: copy.currentLocation,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "device",
        };
        setSelectedOrigin(origin);
        setLocationInput(origin.label);
        setSuggestions([]);
        setSearchState("idle");
      },
      error => {
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
      saraFilter,
    };

    if (remember) {
      window.localStorage.setItem("smartcart-travel-preferences", JSON.stringify({
        transportMode,
        limitType,
        limitValue,
        saraFilter,
      }));
    } else {
      window.localStorage.removeItem("smartcart-travel-preferences");
    }
    onCompare(nextPreferences);
  };

  const limits = limitType === "distance" ? DISTANCE_LIMITS : TIME_LIMITS;

  return (
    <div className="screen-enter">
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <ProgressIndicator step={3} copy={copy} />
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <p className="mb-1 text-sm font-bold text-[#087f5b]">{copy.locationEyebrow}</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">{copy.locationTitle}</h1>
        <p className="mt-2 text-[16px] leading-6 text-[#53635c]">
          {copy.locationDescription}
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-36 sm:px-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5">
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
              type="text"
              value={locationInput}
              onChange={event => {
                const value = event.target.value;
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
              className="h-14 w-full rounded-xl border border-[#dce5e0] bg-[#f7f9f8] pl-10 pr-4 text-[16px] text-[#10231d] focus:border-[#087f5b] focus:outline-none"
            />
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

          <div aria-live="polite" className="min-h-5 text-sm">
            {searchState === "searching" && <span className="text-[#53635c]">{copy.searchingLocations}</span>}
            {searchState === "resolving" && <span className="text-[#53635c]">{copy.selectingLocation}</span>}
            {selectedOrigin && searchState === "idle" && <span className="font-medium text-[#166534]">{copy.locationSelected}</span>}
            {locationError && <span role="alert" className="font-medium text-[#ba1a1a]">{locationError}</span>}
          </div>

          <div className="flex items-start gap-1 text-[14px] text-[#3e494a]">
            <svg width={13.333} height={13.333} viewBox="0 0 13.3333 13.3333" fill="none" className="mt-0.5 shrink-0">
              <path d={svgPathsLocation.p33549300} fill="#3E494A" />
            </svg>
            <span>{copy.locationPrivacy}</span>
          </div>
        </section>

        <section className="flex flex-col gap-4">
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

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.travelLimit}</h2>
            <p className="mt-1 text-[16px] text-[#3e494a]">{copy.travelLimitDescription}</p>
          </div>
          <div className="grid grid-cols-2 rounded-xl bg-[#e8efeb] p-1" aria-label={copy.travelLimitType}>
            {(["distance", "time"] as const).map(type => (
              <button
                type="button"
                key={type}
                onClick={() => {
                  setLimitType(type);
                  setLimitValue(type === "distance" ? 5 : 20);
                }}
                aria-pressed={limitType === type}
                className={"min-h-11 rounded-lg px-3 text-sm font-bold " + (limitType === type ? "bg-white text-[#087f5b] shadow-sm" : "text-[#53635c]")}
              >
                {type === "distance" ? copy.distance : copy.travelTime}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {limits.map(value => (
              <button
                type="button"
                key={value}
                onClick={() => setLimitValue(value)}
                aria-pressed={limitValue === value}
                className={"h-12 rounded-xl border px-2 text-[14px] font-bold " + (limitValue === value ? "border-[#087f5b] bg-[#087f5b] text-white" : "border-[#dce5e0] bg-white text-[#405149]")}
              >
                {value}{limitType === "distance" ? " km" : " min"}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)]">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.saraPlanning} <span className="text-sm font-normal text-[#53635c]">({copy.optional})</span></h2>
            <p className="mt-1 text-sm text-[#3e494a]">{copy.saraPrivacy}</p>
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
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#dce5e0] bg-white px-4 py-3 text-left"
        >
          <span className={"flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[2px] border " + (remember ? "border-[#00535b] bg-[#00535b]" : "border-[#bec8ca] bg-white")}>
            {remember && <IcoCheckbox />}
          </span>
          <span className="text-[16px] leading-6 text-[#191c1d]">{copy.rememberPreferences}</span>
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[712px] gap-3">
          <button type="button" onClick={onBack} className="h-14 flex-[0.8] rounded-2xl border border-[#cbd8d1] bg-white text-[14px] font-bold text-[#087f5b]">
            {copy.backToBasket}
          </button>
          <button
            type="button"
            onClick={handleCompare}
            disabled={!selectedOrigin || searchState === "resolving" || searchState === "locating"}
            className="h-14 flex-1 rounded-2xl bg-[#087f5b] text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)] disabled:cursor-not-allowed disabled:bg-[#8aa69d] disabled:shadow-none"
          >
            {copy.findStores}
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
  copy,
}: {
  store: StoreRecommendation;
  isRecommended: boolean;
  pricesExpanded: boolean;
  onTogglePrices: () => void;
  onSelectStore: () => void;
  copy: AppCopy;
}) {
  return (
    <article className={"relative overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(16,35,29,0.06)] " + (isRecommended ? "border-2 border-[#087f5b]" : "border-[#e2e9e5]") + (store.missingItems.length > 0 ? " opacity-70" : "")}>
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
            <div className="mt-2"><SaraStoreTag status={store.saraStatus} copy={copy} /></div>
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
          incomplete={store.missingItems.length > 0}
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
                  <p className="mb-3 text-[13px] leading-5 text-[#5f6368]">{copy.missingItemPrices(store.missingItems.join(", "))}</p>
                )}
                <CompactBasketPriceList prices={store.basketPrices} copy={copy} />
              </div>
            )}
          </>
        )}

        {store.combinedTotalRm != null && (
          <div className="rounded-2xl bg-[#087f5b] p-4 text-white shadow-[0_6px_18px_rgba(8,127,91,0.22)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#d3f0e4]">{copy.combinedTotal}</p>
                <p className="mt-1 text-2xl font-extrabold leading-8">{formatRm(store.combinedTotalRm)}</p>
              </div>
              <p className="text-right text-xs leading-5 text-[#d3f0e4]">{copy.basketSubtotal} + {copy.returnTravel}</p>
            </div>
          </div>
        )}

        {/* AC 2.4.1: primary "Select store" action — native button keeps
            keyboard and screen-reader access; always visible on every card */}
        <button
          type="button"
          onClick={onSelectStore}
          aria-label={"Select store " + store.name}
          className="min-h-11 w-full rounded-xl bg-[#087f5b] px-5 text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)]"
        >
          Select store
        </button>
      </div>
    </article>
  );
}

// AC 2.4.1: Recommendation overview for the selected premise. The detail
// view keeps store identity, totals, item prices and savings actions together
// so the shopper can compare and swap without jumping between sections.
function RecommendationOverview({
  store,
  basket,
  preferences,
  copy,
  rankingMethod,
  costAssumptions,
  routeProvider,
  onSetBasket,
}: {
  store: StoreRecommendation;
  basket: BasketItem[];
  preferences: TravelPreferences;
  copy: AppCopy;
  rankingMethod: string;
  costAssumptions: Record<TransportMode, string> | undefined;
  routeProvider: "google" | "straight_line";
  onSetBasket: Dispatch<SetStateAction<BasketItem[]>>;
}) {
  // AC 2.4.2: labels for the selected travel preferences, written the same
  // way as on the compare screen so both pages describe them identically.
  const modeLabel = transportLabel(copy, preferences.transportMode) || copy.selectedTransport;
  const routeEstimateNote = routeProvider === "straight_line"
    ? copy.straightLineFallbackNote
    : copy.routeEstimateNote;
  const limitLabel = preferences.limitType === "distance"
    ? preferences.limitValue + " km"
    : preferences.limitValue + " " + copy.minutes;
  // AC 2.4.2: combined total = priced basket subtotal + estimated return
  // transport. The API only sends combinedTotalRm for complete baskets, so
  // for incomplete ones it is recomputed from the partial subtotal
  // (missing prices stay excluded).
  const hasIncompleteBasket = store.missingItems.length > 0;
  const initialBasket = useRef(basket);
  const [alternativeLines, setAlternativeLines] = useState<BasketAlternativeLine[]>([]);
  const [alternativesLoading, setAlternativesLoading] = useState(true);
  const [alternativesError, setAlternativesError] = useState(false);
  const [appliedSwaps, setAppliedSwaps] = useState<Record<string, BasketAlternativeLine>>({});
  const [pricesExpanded, setPricesExpanded] = useState(true);

  useEffect(() => {
    const requestedBasket = toBasketLineRequests(initialBasket.current.filter(item => !item.swap));
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
  }, [store.premiseId]);

  const appliedLines = Object.values(appliedSwaps);
  const persistedSwapByItemId = new Map(
    basket
      .filter(item => item.swap)
      .map(item => [item.id.replace(/^db-/, ""), item] as const),
  );
  const appliedSavings = appliedLines.reduce((total, line) => total + (line.savingsRm ?? 0), 0);
  const remainingSavings = alternativeLines.reduce((total, line) => {
    const alternativeId = line.alternative?.itemId;
    if (!alternativeId || appliedSwaps[line.source.itemId] || basket.some(item => item.id === `db-${alternativeId}`)) return total;
    return total + (line.savingsRm ?? 0);
  }, 0);
  const adjustedSubtotal = store.basketSubtotalRm == null ? null : Math.max(0, Number((store.basketSubtotalRm - appliedSavings).toFixed(2)));
  const creditAdjustment = appliedLines.reduce((total, line) => {
    const sourceCredit = line.source.isSaraCreditCandidate ? (line.source.lineTotalRm ?? 0) : 0;
    const alternativeCredit = line.alternative?.isSaraCreditCandidate ? (line.alternative.lineTotalRm ?? 0) : 0;
    return total + alternativeCredit - sourceCredit;
  }, 0);
  const adjustedCredit = store.saraCreditRm == null || adjustedSubtotal == null ? null : Math.max(0, Number((store.saraCreditRm + creditAdjustment).toFixed(2)));
  const adjustedCash = adjustedSubtotal == null || adjustedCredit == null ? null : Math.max(0, Number((adjustedSubtotal - adjustedCredit).toFixed(2)));
  const adjustedCombinedTotal = adjustedSubtotal == null ? null : Number((adjustedSubtotal + store.estimatedRoundTripCostRm).toFixed(2));

  const applyAlternative = (line: BasketAlternativeLine) => {
    const next = applyBasketSwap(basket, line, { id: store.premiseId, name: store.name });
    if (next === basket || !line.alternative) return;
    onSetBasket(next);
    setAppliedSwaps(current => ({ ...current, [line.source.itemId]: line }));
  };

  const undoAlternative = (line: BasketAlternativeLine) => {
    onSetBasket(undoBasketSwap(basket, `db-${line.alternative?.itemId ?? ""}`));
    setAppliedSwaps(current => {
      const next = { ...current };
      delete next[line.source.itemId];
      return next;
    });
  };

  const alternativeBySourceId = new Map(
    alternativeLines.map(line => [line.source.itemId, line] as const),
  );
  const lastPriceDate = latestPriceDate(store.basketPrices);

  return (
    <div className="screen-enter pb-8">
      <div className="flex flex-col gap-6 px-4 pb-6 pt-5 sm:gap-8 sm:px-6 sm:pt-8">
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#53635c]">
            <span>{copy.transportMode}: {modeLabel} · {copy.travelLimit}: {limitLabel}</span>
          </div>
          <div className="mt-4">
            <TripDetails
              store={store}
              copy={copy}
              basketSubtotal={adjustedSubtotal}
              basketLineCount={store.basketLineCount}
              incomplete={hasIncompleteBasket}
            />
          </div>

          {store.basketLines.length > 0 && (
            <>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPricesExpanded(expanded => !expanded)}
                  aria-expanded={pricesExpanded}
                  className="min-h-8 w-full rounded-lg border border-[#cbd8d1] bg-white px-2 text-[9px] font-bold text-[#087f5b]"
                >
                  {pricesExpanded ? copy.hidePriceList : copy.viewPriceList}
                </button>
              </div>
              {pricesExpanded && (
                <div className={"mt-3 rounded-xl p-3 " + (hasIncompleteBasket ? "bg-[#f3f4f5]" : "bg-[#e7f7f0]")}>
            {hasIncompleteBasket && store.missingItems.length > 0 && (
              <p className="mt-2 text-xs leading-5 text-[#5f6368]">{copy.missingItemPrices(store.missingItems.join(", "))}</p>
            )}
            {lastPriceDate && (
              <p className="mt-2 text-xs text-[#617069]">{copy.lastUpdated}: {formatPriceDate(lastPriceDate)}</p>
            )}
            {adjustedCredit != null && adjustedCash != null && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#bfe3d3] pt-3 text-xs">
                <span className="font-semibold text-[#286d67]">{copy.saraCreditLabel}: {formatRm(adjustedCredit)}</span>
                <span className="font-semibold text-[#17362c]">{copy.cashNeededLabel}: {formatRm(adjustedCash)}</span>
              </div>
            )}

          <div className="mt-4 border-t border-[#bfe3d3] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[16px] font-extrabold leading-6 text-[#10231d]">{copy.basketItemsAndSavings}</h3>
              <div className="text-right text-xs font-bold text-[#286d67]">
                {appliedSavings > 0 && <span>{copy.appliedSavings(formatRm(Number(appliedSavings.toFixed(2))))}</span>}
                {appliedSavings > 0 && remainingSavings > 0 && <span> · </span>}
                {remainingSavings > 0 && <span>{copy.potentialSavings(formatRm(Number(remainingSavings.toFixed(2))))}</span>}
              </div>
            </div>
            {alternativesLoading && <p role="status" className="mt-2 text-xs text-[#617069]">{copy.alternativesLoading}</p>}
            {alternativesError && <p role="alert" className="mt-2 text-xs text-[#93000a]">{copy.alternativesUnavailable}</p>}

            {store.basketLines.length > 0 ? (
              <ul className="mt-2 flex flex-col">
                {store.basketLines.map(line => {
                  const applied = appliedSwaps[line.itemId];
                  const persisted = persistedSwapByItemId.get(line.itemId);
                  const suggestion = alternativeBySourceId.get(line.itemId);
                  const replacement = applied?.alternative;
                  const sourcePrice = store.basketPrices.find(price => price.itemId === line.itemId);
                  const displayPackageSize = replacement?.packageSize ?? sourcePrice?.packageSize ?? line.unit;
                  const displaySaraEligible = replacement?.saraEligible ?? sourcePrice?.saraEligible ?? null;
                  const displaySaraCandidate = replacement?.saraCategoryCandidate ?? sourcePrice?.saraCategoryCandidate ?? false;
                  const displayLine = replacement
                    ? { ...line, itemId: replacement.itemId, itemName: replacement.itemName, unit: replacement.unit, unitPriceRm: replacement.unitPriceRm, lineTotalRm: replacement.lineTotalRm, observedDate: replacement.observedDate }
                    : line;
                  const hasSuggestion = Boolean(suggestion?.alternative && suggestion.savingsRm != null && suggestion.source.lineTotalRm != null);
                  const targetAlreadyInBasket = suggestion?.alternative
                    ? basket.some(item => item.id === `db-${suggestion.alternative!.itemId}`)
                    : false;
                  return (
                    <li key={line.itemId} className="border-b border-[#e2e9e5] py-3 last:border-b-0 last:pb-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words text-[13px] font-bold text-[#17362c]">{displayLine.itemName ?? "Catalogue item"}</p>
                            {(applied || persisted) && <span className="rounded-md bg-[#e7f7f0] px-2 py-0.5 text-[10px] font-extrabold text-[#17634f]">{copy.swapped}</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-[#718078]">{displayPackageSize ?? "—"}{persisted?.swap ? ` · ${copy.originally(persisted.swap.original.name)}` : ""}</p>
                          <div className="mt-1"><SaraEligibilityFlag status={displaySaraEligible} categoryCandidate={displaySaraCandidate} copy={copy} /></div>
                        </div>
                        <div className="shrink-0 text-right">
                          {displayLine.unitPriceRm != null && displayLine.lineTotalRm != null ? (
                            <>
                              <p className="text-[15px] font-extrabold text-[#17362c]">{formatRm(displayLine.lineTotalRm)}</p>
                              <p className="text-[11px] text-[#718078]">{displayLine.quantity} × {formatRm(displayLine.unitPriceRm)}</p>
                              <p className="text-[11px] text-[#718078]">{copy.priceCatcherUpdated}: {formatPriceDate(displayLine.observedDate)}</p>
                            </>
                          ) : (
                            <p className="text-lg font-extrabold text-[#718078]">—</p>
                          )}
                        </div>
                      </div>

                      {hasSuggestion && !applied && !persisted && suggestion?.alternative && suggestion.savingsRm != null && (
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-[#f3faf7] px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-[#286d67]">{copy.lowerCostMatch}</p>
                            <p className="break-words text-xs font-semibold text-[#17362c]">{suggestion.alternative.itemName ?? "Catalogue item"}</p>
                            <p className="text-[11px] text-[#718078]">{suggestion.alternative.packageSize ?? suggestion.alternative.unit ?? "—"}</p>
                            <p className="text-[11px] text-[#53635c]">{copy.saveAmount(formatRm(suggestion.savingsRm))} · {formatRm(suggestion.alternative.unitPriceRm ?? 0)} each</p>
                            <SaraEligibilityFlag status={suggestion.alternative.saraEligible} categoryCandidate={suggestion.alternative.saraCategoryCandidate} copy={copy} />
                            <p className="text-[11px] text-[#718078]">{copy.priceCatcherUpdated}: {formatPriceDate(suggestion.alternative.observedDate)}</p>
                          </div>
                          <button type="button" disabled={targetAlreadyInBasket} onClick={() => applyAlternative(suggestion)} aria-label={`${copy.swapAndSave}: ${suggestion.alternative.itemName ?? "Catalogue item"}`} className="min-h-10 shrink-0 rounded-lg bg-[#087f5b] px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#9db5ac]">{targetAlreadyInBasket ? copy.swapped : copy.swapAndSave}</button>
                        </div>
                      )}

                      {!applied && !persisted && (suggestion?.packOptions?.length ?? 0) > 0 && (
                        <div className="mt-2 rounded-xl border border-[#e2e9e5] bg-white px-3 py-2">
                          <p className="text-[11px] font-bold text-[#286d67]">{copy.packSizeOptions}</p>
                          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                            {suggestion!.packOptions!.map(pack => (
                              <div key={pack.itemId} className="w-36 shrink-0 rounded-lg bg-[#f3faf7] px-2.5 py-2">
                                <p className="break-words text-[11px] font-semibold leading-4 text-[#17362c]">{pack.itemName ?? "Catalogue item"}</p>
                                <p className="mt-0.5 text-[10px] text-[#718078]">{pack.packageSize ?? "—"}</p>
                                {pack.itemId === line.itemId && (
                                  <span className="mt-0.5 inline-block rounded-md bg-[#e2e9e5] px-1.5 py-0.5 text-[9px] font-extrabold text-[#53635c]">{copy.currentPack}</span>
                                )}
                                <p className="mt-1 text-[13px] font-extrabold text-[#17362c]">{pack.totalPriceRm != null ? formatRm(pack.totalPriceRm) : "—"}</p>
                                <p className="text-[10px] text-[#53635c]">{pack.pricePerUnitRm != null ? copy.packUnitPrice(formatRm(pack.pricePerUnitRm), pack.unitKind) : "—"}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(applied || persisted) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#286d67]">
                          {applied && <span>{copy.saveAmount(formatRm(applied.savingsRm ?? 0))}</span>}
                          <button type="button" onClick={() => {
                            if (applied) undoAlternative(applied);
                            else if (persisted) onSetBasket(undoBasketSwap(basket, persisted.id));
                          }} className="min-h-9 font-extrabold text-[#087f5b] underline underline-offset-2">{copy.undoSwap}</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[#617069]">{copy.noPricedBasketLines}</p>
           )}
          </div>
          </div>
              )}
            </>
          )}

          {adjustedCombinedTotal != null && (
            <div className="mt-4 rounded-2xl bg-[#087f5b] p-4 text-white shadow-[0_6px_18px_rgba(8,127,91,0.22)]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#d3f0e4]">{copy.combinedTotal}</p>
                  <p className="mt-1 text-2xl font-extrabold leading-8">{formatRm(adjustedCombinedTotal)}</p>
                </div>
                <p className="text-right text-xs leading-5 text-[#d3f0e4]">{copy.basketSubtotal} + {copy.returnTravel}</p>
              </div>
            </div>
          )}

          <details className="mt-4 border-t border-[#e2e9e5] pt-3 text-xs">
            <summary className="cursor-pointer font-bold text-[#17362c]">{copy.calculationTitle}</summary>
            {rankingMethod && <p className="mt-2 leading-5 text-[#53635c]">{rankingMethod}</p>}
            {costAssumptions && <p className="mt-2 leading-5 text-[#53635c]">{costAssumptions[preferences.transportMode]}</p>}
            <p className="mt-2 leading-5 text-[#53635c]">{routeEstimateNote} {copy.stockNotVerified}</p>
          </details>
        </section>
      </div>
    </div>
  );
}

function CompareScreen({
  basket,
  setBasket,
  selectedStore,
  setSelectedStore,
  preferences,
  onBack,
  copy,
}: {
  basket: BasketItem[];
  setBasket: Dispatch<SetStateAction<BasketItem[]>>;
  selectedStore: StoreRecommendation | null;
  setSelectedStore: Dispatch<SetStateAction<StoreRecommendation | null>>;
  preferences: TravelPreferences;
  onBack: () => void;
  copy: AppCopy;
}) {
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  // AC 2.3.2: which completeness tab is active; AC 2.3.9: which card's
  // per-line prices are expanded.
  const [activeTab, setActiveTab] = useState<"complete" | "incomplete">("complete");
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  // AC 2.3.1: only real catalogue items ("db-" ids) are priced; mock rows are
  // filtered out. Empty after filtering -> request without a basket, keeping
  // transport-first ranking.
  const basketLines = useMemo(() => toBasketLineRequests(basket), [basket]);
  const [requestBasketLines, setRequestBasketLines] = useState(() => basketLines);
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
    setActiveTab("complete");
    setExpandedStoreId(null);

    getRecommendations({
      ...(requestBasketLines.length > 0 ? { basket: requestBasketLines } : {}),
      travel: {
        origin: preferences.origin,
        transportMode: preferences.transportMode,
        limit: { type: preferences.limitType, value: preferences.limitValue },
        saraFilter: preferences.saraFilter,
      },
    }, controller.signal)
      .then(response => {
        setResult(response);
        setActiveTab("complete");
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
  }, [requestBasketLines, copy.chooseStartingLocation, copy.recommendationsUnavailable, preferences]);

  const recommendations = (result?.recommendations ?? []).filter(
    store => !HIDDEN_RECOMMENDATION_NAMES.has(store.name.trim().toUpperCase()),
  );
  // AC 2.3.2/2.3.3: with a priced basket the list splits into Complete and
  // Incomplete basket tabs (complete baskets first, as ranked by the API);
  // without a basket there is nothing to price, so the flat transport-first
  // list is kept and the tabs are hidden.
  const completeStores = hasBasket ? recommendations.filter(isCompleteBasket) : recommendations;
  const incompleteStores = hasBasket ? recommendations.filter(store => !isCompleteBasket(store)) : [];
  // AC 2.3.5: the recommended store is the first complete basket.
  const recommendedStore = completeStores[0];
  const visibleStores = activeTab === "complete" ? completeStores.slice(0, visibleCount) : incompleteStores;
  // AC 2.3.2: the summary counts basket units (matching the header badge),
  // not line rows.
  const basketItemCount = requestBasketLines.reduce((count, line) => count + line.quantity, 0);
  const modeLabel = transportLabel(copy, preferences.transportMode) || copy.selectedTransport;
  const originLabel = preferences.origin?.source === "device"
    ? copy.currentLocation
    : preferences.origin?.label ?? "";
  const limitLabel = preferences.limitType === "distance"
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
        basket={basket}
        onSetBasket={setBasket}
        preferences={preferences}
        copy={copy}
        rankingMethod={result?.rankingMethod ?? ""}
        costAssumptions={result?.costAssumptions}
        routeProvider={result?.routeProvider ?? "google"}
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
          {hasBasket && (
            <p className="text-[15px] font-semibold leading-6 text-[#17362c]">
              Basket: {basketItemCount} {basketItemCount === 1 ? "item" : "items"}
            </p>
          )}
          <p className="text-[15px] leading-6 text-[#53635c]">
            {copy.storesWithinLimit(limitLabel, originLabel, modeLabel)}
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
            <button type="button" onClick={onBack} className="mt-4 min-h-11 rounded-xl border border-[#ba1a1a] bg-white px-4 text-sm font-bold text-[#93000a]">{copy.changeTravel}</button>
          </div>
        )}

        {!loading && !error && result && (
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{copy.reachablePremises}</h2>
                <p className="mt-1 text-sm text-[#617069]">{copy.reachableSummary(recommendations.length, result.totalCandidatesEvaluated)}</p>
              </div>
              <span className="text-right text-xs font-medium text-[#718078]">{hasBasket ? copy.lowerTravelFirst : "Lower travel cost first"}</span>
            </div>

            {/* AC 2.3.2/2.3.3: with a priced basket the shopper switches
                between the Complete and Incomplete basket tabs */}
            {hasBasket && (
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label={`${copy.completeBasketsTab} / ${copy.incompleteBasketsTab}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "complete"}
                  onClick={() => setActiveTab("complete")}
                  className={"min-h-11 rounded-xl border text-sm font-bold " + (activeTab === "complete" ? "border-[#087f5b] bg-[#087f5b] text-white" : "border-[#cbd8d1] bg-white text-[#087f5b]")}
                >
                  {copy.completeBasketsTab} ({completeStores.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "incomplete"}
                  onClick={() => setActiveTab("incomplete")}
                  className={"min-h-11 rounded-xl border text-sm font-bold " + (activeTab === "incomplete" ? "border-[#5f6368] bg-[#5f6368] text-white" : "border-[#cbd8d1] bg-white text-[#5f6368]")}
                >
                  {copy.incompleteBasketsTab} ({incompleteStores.length})
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {visibleStores.map(store => (
                <StoreCard
                  key={store.premiseId}
                  store={store}
                  isRecommended={activeTab === "complete" && recommendedStore?.premiseId === store.premiseId}
                  pricesExpanded={expandedStoreId === store.premiseId}
                  onTogglePrices={() => setExpandedStoreId(current => (current === store.premiseId ? null : store.premiseId))}
                  onSelectStore={() => setSelectedStore(store)}
                  copy={copy}
                />
              ))}

              {/* AC 2.3.2: See More pages the Complete baskets tab only; the
                  Incomplete tab lists every incomplete basket at once */}
              {activeTab === "complete" && hasMoreStores(visibleCount, completeStores.length) && (
                <button type="button" onClick={() => setVisibleCount(count => nextVisibleCount(count, completeStores.length))} className="h-12 w-full rounded-xl border border-[#087f5b] bg-white text-sm font-bold text-[#087f5b]">
                  See More (+5)
                </button>
              )}

              {recommendations.length > 0 && visibleStores.length === 0 && (
                <p className="rounded-xl border border-[#e2e9e5] bg-white p-4 text-center text-sm text-[#617069]">
                  {activeTab === "complete" ? copy.noCompleteBaskets : copy.noIncompleteBaskets}
                </p>
              )}

              {recommendations.length === 0 && (
                <div className="rounded-2xl border border-[#bec8ca] bg-white p-5 text-center">
                  <p className="font-semibold text-[#191c1d]">{copy.noStores}</p>
                  <p className="mt-1 text-sm text-[#617069]">{copy.noStoresHint}</p>
                  <button type="button" onClick={onBack} className="mt-3 min-h-11 px-3 font-bold text-[#00535b]">{copy.changeTravel}</button>
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && !error && result && (
          <details className="rounded-2xl border border-[#dce5e0] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-bold text-[#17362c]">{copy.calculationTitle}</summary>
            <p className="mt-3 leading-5 text-[#53635c]">{copy.rankingMethod}</p>
            <p className="mt-2 leading-5 text-[#53635c]">{copy.costAssumptions[preferences.transportMode]}</p>
            <p className="mt-2 leading-5 text-[#53635c]">{result.routeProvider === "straight_line" ? copy.straightLineFallbackNote : copy.routeEstimateNote}</p>
          </details>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("shop");
  const [basket, setBasket] = useState<BasketItem[]>(INIT_BASKET);
  const [selectedStore, setSelectedStore] = useState<StoreRecommendation | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [preferences, setPreferences] = useState<TravelPreferences>({
    origin: null,
    transportMode: "motorcycle",
    limitType: "distance",
    limitValue: 5,
    saraFilter: "any",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    if (screen !== "compare") setSelectedStore(null);
  }, [screen]);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("smartcart-locale");
    if (savedLocale === "en" || savedLocale === "ms") setLocale(savedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "ms" ? "ms-MY" : "en-MY";
    window.localStorage.setItem("smartcart-locale", locale);
  }, [locale]);

  useEffect(() => {
    const savedPreferences = window.localStorage.getItem("smartcart-travel-preferences");
    if (!savedPreferences) return;
    try {
      const saved = JSON.parse(savedPreferences) as Record<string, unknown>;
      const transportMode = ["walk", "public_transport", "motorcycle", "car"].includes(String(saved.transportMode))
        ? saved.transportMode as TransportMode
        : "motorcycle";
      const limitType = saved.limitType === "time" ? "time" : "distance";
      const candidateLimit = Number(saved.limitValue);
      const limitValue = Number.isFinite(candidateLimit) && candidateLimit > 0
        ? candidateLimit
        : limitType === "distance" ? 5 : 20;
      const saraFilter = ["any", "candidate", "verified"].includes(String(saved.saraFilter))
        ? saved.saraFilter as SaraFilter
        : "any";
      setPreferences({ origin: null, transportMode, limitType, limitValue, saraFilter });
    } catch {
      window.localStorage.removeItem("smartcart-travel-preferences");
    }
  }, []);

  const basketCount = basket.reduce((count, item) => count + item.qty, 0);
  const copy = COPY[locale];
  const toggleLanguage = () => setLocale(current => current === "en" ? "ms" : "en");
  const goBack = screen === "basket"
    ? () => setScreen("shop")
    : screen === "location"
      ? () => setScreen("basket")
      : screen === "compare"
        ? () => {
            if (selectedStore) setSelectedStore(null);
            else setScreen("location");
          }
        : undefined;

  return (
    <div className="min-h-full bg-[#f7f8f6]">
      <Header
        basketCount={basketCount}
        basketActive={screen === "basket"}
        onBasket={() => setScreen("basket")}
        onBack={goBack}
        locale={locale}
        onToggleLanguage={toggleLanguage}
        copy={copy}
      />

      <main className="mx-auto w-full max-w-[760px] pt-16">
        {screen === "shop" && (
          <BasketScreen
            view="shop"
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => setScreen("basket")}
            onContinue={() => setScreen("location")}
            copy={copy}
            locale={locale}
          />
        )}
        {screen === "basket" && (
          <BasketScreen
            view="basket"
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => setScreen("basket")}
            onContinue={() => setScreen("location")}
            copy={copy}
            locale={locale}
          />
        )}
        {screen === "location" && (
          <LocationScreen
            preferences={preferences}
            onBack={() => setScreen("basket")}
            copy={copy}
            onCompare={nextPreferences => {
              setPreferences(nextPreferences);
              setScreen("compare");
            }}
          />
        )}
        {screen === "compare" && (
          <CompareScreen
            basket={basket}
            setBasket={setBasket}
            selectedStore={selectedStore}
            setSelectedStore={setSelectedStore}
            preferences={preferences}
            onBack={() => setScreen("location")}
            copy={copy}
          />
        )}
      </main>
    </div>
  );
}
