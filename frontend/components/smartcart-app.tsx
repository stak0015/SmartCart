"use client";

import { useEffect, useState } from "react";
import { searchItems, type Item } from "@/lib/api";
import { DEFAULT_QTY, MAX_QTY, QTY_ERROR, basketDetails, basketSummary, linePriceLabel, parseQty, resultRowFields, stepQty, upsertBasketLine } from "@/lib/result-row";
import {
  getRecommendations,
  resolveLocation,
  searchLocations,
  SmartCartApiError,
} from "@/lib/api-client";
import type {
  LocationSuggestion,
  RecommendationResponse,
  SaraFilter,
  SelectedLocation,
  TransportMode,
  TravelLimitType,
} from "@/lib/contracts";
import svgPathsBasket from "@/components/icons/basket";
import svgPathsLocation from "@/components/icons/location";
import svgPathsCompare from "@/components/icons/compare";
import svgPathsSaved from "@/components/icons/saved";

// ── Types ───────────────────────────────────────────────────────────────────
type Screen = "shop" | "basket" | "location" | "compare";

interface BasketItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  qty: number;
  price: number;
  unitPrice: number;
  saraEligible: true | null;
}

interface TravelPreferences {
  origin: SelectedLocation | null;
  transportMode: TransportMode;
  limitType: TravelLimitType;
  limitValue: number;
  saraFilter: SaraFilter;
}

// ── Data ────────────────────────────────────────────────────────────────────
const CATALOG = [
  { id: "1", name: "Beras Sri Wangi", brand: "Sri Wangi", size: "5kg per bag", category: "Rice & Grains", hasImg: true, price: 15.90, unitPrice: 3.18, unit: "kg", saraEligible: true as const },
  { id: "2", name: "Cooking Oil (Blended)", brand: "Saji", size: "1kg polybag", category: "Cooking Oil", hasImg: false, price: 12.50, unitPrice: 12.50, unit: "kg", saraEligible: true as const },
  { id: "3", name: "Grade A Eggs", brand: "Farm Fresh", size: "10 pcs per tray", category: "Eggs & Dairy", hasImg: false, price: 13.00, unitPrice: 1.30, unit: "egg", saraEligible: null },
  { id: "4", name: "Full Cream UHT Milk", brand: "Goodday", size: "1 litre per pack", category: "Eggs & Dairy", hasImg: false, price: 17.00, unitPrice: 17.00, unit: "litre", saraEligible: true as const },
  { id: "5", name: "Fresh Spinach", brand: "Unbranded", size: "250g per bundle", category: "Vegetables", hasImg: false, price: 4.20, unitPrice: 16.80, unit: "kg", saraEligible: null },
];

const CATEGORIES = ["Rice & Grains", "Cooking Oil", "Eggs & Dairy", "Vegetables", "Meat & Fish", "Beverages", "Household Essentials", "Other"];

const INIT_BASKET: BasketItem[] = [
  { id: "2", name: "Cooking Oil (Blended)", brand: "Saji", size: "1kg polybag", qty: 1, price: 12.50, unitPrice: 12.50, saraEligible: true },
  { id: "3", name: "Grade A Eggs", brand: "Farm Fresh", size: "10 pcs", qty: 1, price: 13.00, unitPrice: 1.30, saraEligible: null },
];

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
function IcoSavings({ color = "#286D67" }: { color?: string }) {
  return (
    <svg width={20} height={23} viewBox="0 0 20 23" fill="none">
      <path d={svgPathsCompare.p11fe5d80} fill={color} />
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
function IcoPriceCatcher({ color = "#3E494A" }: { color?: string }) {
  return (
    <svg width={14.667} height={14} viewBox="0 0 14.6667 14" fill="none">
      <path d={svgPathsCompare.p3c0a9100} fill={color} />
    </svg>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
function Header({
  basketCount,
  onBasket,
  basketActive,
  onBack,
}: {
  basketCount: number;
  onBasket: () => void;
  basketActive: boolean;
  onBack?: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e7ece9] bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-[760px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        {onBack ? (
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 justify-self-start text-sm font-bold text-[#087f5b]">
            <IcoArrowBack /> Shop
          </button>
        ) : <span aria-hidden="true" />}

        <span className="text-lg font-extrabold tracking-[-0.3px] text-[#10231d]">SmartCart</span>

        <button
          type="button"
          onClick={onBasket}
          aria-label={`View basket, ${basketCount} item${basketCount === 1 ? "" : "s"}`}
          aria-current={basketActive ? "page" : undefined}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center justify-self-end rounded-xl border ${basketActive ? "border-[#087f5b] bg-[#edf7f2]" : "border-[#dce5e0] bg-white"}`}
        >
          <IcoBasket color="#087f5b" size={22} />
          {basketCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e8590c] px-1 text-[11px] font-bold text-white">
              {basketCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

// ── Progress indicator ────────────────────────────────────────────────────────
function ProgressIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = [
    { n: 1, label: "Shop" },
    { n: 2, label: "Basket" },
    { n: 3, label: "Travel" },
    { n: 4, label: "Compare" },
  ] as const;

  return (
    <div aria-label={`Step ${step} of 4`} className="grid w-full grid-cols-4 rounded-xl bg-[#edf3ef] p-1">
      {steps.map(current => (
        <div
          key={current.n}
          className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-bold sm:text-sm ${
            step === current.n ? "bg-white text-[#087f5b] shadow-sm" : current.n < step ? "text-[#087f5b]" : "text-[#617069]"
          }`}
        >
          <span aria-hidden="true">{current.n < step ? "✓" : current.n}</span>
          <span className="truncate">{current.label}</span>
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
}: {
  view: "shop" | "basket";
  basket: BasketItem[];
  setBasket: (b: BasketItem[]) => void;
  onViewBasket: () => void;
  onContinue: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [emptyError, setEmptyError] = useState(false);

  // ── Real database search (Step 6) ─────────────────────────────────────────
  const [apiResults, setApiResults] = useState<Item[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSearched, setApiSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null); // which card's store-price list is open
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

  const filtered = CATALOG.filter(item => {
    const matchesSearch = !search || `${item.name} ${item.brand}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategories.length === 0 || activeCategories.includes(item.category);
    return matchesSearch && matchesCategory;
  });

  const toggleCategory = (category: string) => {
    setActiveCategories(current => current.includes(category)
      ? current.filter(selected => selected !== category)
      : [...current, category]);
  };

  const updateQty = (id: string, delta: number) => {
    setBasket(basket.map(b => b.id === id ? { ...b, qty: Math.max(1, b.qty + delta) } : b));
  };

  const removeItem = (id: string) => setBasket(basket.filter(b => b.id !== id));

  // Convert a real database Item into a BasketItem and add it to the basket (Step 7).
  // Only items with a known price can be added (basket total must not include unknown prices).
  // id is prefixed with "db-" to avoid colliding with the demo STORES ids ("1".."5").
  // brand/size come from the same mapping as the result row (basketDetails),
  // so both views always show identical details; unparsed values show "—".
  const addRealItem = (item: Item, qty: number) => {
    if (item.price == null) return; // no price -> cannot add
    // AC-1.4.2: same item added again increases quantity, never duplicates.
    setBasket(upsertBasketLine(basket, {
      id: `db-${item.item_id}`,
      ...basketDetails(item),
      qty,
      price: item.price,
      unitPrice: item.price,
      saraEligible: null,
    }));
  };

  const handleContinue = () => {
    if (basket.length === 0) { setEmptyError(true); return; }
    setEmptyError(false);
    onContinue();
  };

  // AC-1.4.2: summary line derives from the lines, so it recalculates on every add.
  const { itemCount, estimate: basketEstimate } = basketSummary(basket);

  return (
    <div className="screen-enter pb-32">
      {view === "shop" && (
        <>
      {/* Page header */}
      <div className="px-4 pb-5 pt-6 sm:px-6 sm:pt-8">
        <p className="mb-1 text-sm font-bold text-[#087f5b]">Plan one affordable shop</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">Shop household essentials</h1>
        <p className="mt-2 max-w-[580px] text-[16px] leading-6 text-[#53635c]">
          Search and add what you need. Open your basket when you&apos;re ready to review quantities and continue.
        </p>
      </div>

      {/* Progress */}
      <div className="px-4 pb-5 sm:px-6">
        <ProgressIndicator step={1} />
      </div>

      {/* Search —— now calls the real backend API (Step 6) */}
      <div className="sticky top-16 z-30 bg-[#f7f8f6]/95 px-4 pb-3 pt-2 backdrop-blur sm:px-6">
        <div className="relative h-14">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <IcoSearch />
          </div>
          <input
            type="text"
            aria-label="Search household essentials"
            placeholder="Search real products — try ayam, milk, beras..."
            value={search}
            onChange={e => {
              const q = e.target.value;
              setSearch(q);
              if (!q.trim()) {
                setApiResults([]);
                setApiSearched(false);
                return;
              }
              setApiLoading(true);
              setApiSearched(true);
              searchItems(q, 20)
                .then(data => setApiResults(data.items))
                .catch(() => setApiResults([]))
                .finally(() => setApiLoading(false));
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
            <span className="block text-xs font-semibold text-[#718078]">Categories</span>
            <span className="block text-[15px] font-bold text-[#17362c]">
              {activeCategories.length === 0 ? "All categories" : `${activeCategories.length} selected`}
            </span>
          </span>
          <span aria-hidden="true" className={`text-lg text-[#087f5b] transition-transform ${categoryOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>

        {categoryOpen && (
          <div id="category-options" className="absolute left-4 right-4 top-[60px] rounded-2xl border border-[#d7e1dc] bg-white p-3 shadow-[0_14px_34px_rgba(16,35,29,0.16)] sm:left-6 sm:right-6">
            <div className="mb-2 flex items-center justify-between border-b border-[#edf1ef] px-1 pb-2">
              <p className="text-sm font-extrabold text-[#10231d]">Filter by category</p>
              {activeCategories.length > 0 && (
                <button type="button" onClick={() => setActiveCategories([])} className="min-h-11 px-2 text-sm font-bold text-[#087f5b]">Clear all</button>
              )}
            </div>
            <div className="grid max-h-[210px] grid-cols-1 gap-1 overflow-y-auto sm:max-h-[300px] sm:grid-cols-2">
              {CATEGORIES.map(category => (
                <label key={category} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-[#f2f6f3]">
                  <input
                    type="checkbox"
                    checked={activeCategories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="h-5 w-5 accent-[#087f5b]"
                  />
                  <span className="text-sm font-medium text-[#263b33]">{category}</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={() => setCategoryOpen(false)} className="mt-3 h-11 w-full rounded-xl bg-[#087f5b] text-sm font-extrabold text-white">Show {filtered.length} item{filtered.length === 1 ? "" : "s"}</button>
          </div>
        )}
      </div>

      {/* Matching items —— now shows real backend data with prices (Step 7) */}
      <div className="px-4 pb-7 sm:px-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">
            {search ? "Search results" : "All essentials"}
          </h2>
          <span className="text-sm font-medium text-[#718078]">
            {apiLoading ? "Searching..." : `${apiResults.length} item${apiResults.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {/* Not searched yet */}
        {!apiSearched && (
          <p className="text-[16px] text-[#3e494a] text-center py-6">
            Type above to search 757 real products from the database 🛒
          </p>
        )}

        {/* Loading */}
        {apiLoading && (
          <p className="text-[16px] text-[#718078] text-center py-6">Searching the database...</p>
        )}

        {/* Searched but no results */}
        {!apiLoading && apiSearched && apiResults.length === 0 && (
          <p className="text-[16px] text-[#3e494a] text-center py-6">
            No items found for &quot;{search}&quot;. Try another keyword.
          </p>
        )}

        {/* Real results list */}
        {!apiLoading && apiResults.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {apiResults.map(item => {
              const fields = resultRowFields(item);
              const rawQty = qtyById[item.item_id] ?? String(DEFAULT_QTY);
              const qty = parseQty(rawQty); // null while the typed value is invalid (AC-1.4.1)
              return (
              <article key={item.item_id} className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[#e2e9e5] bg-white p-3 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-4">
                {/* Icon placeholder (real data has no image) */}
                <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-xl bg-[#eef2ef] sm:h-[92px] sm:w-[92px]">
                  <svg width={24} height={24} viewBox="0 0 18 18" fill="none">
                    <path d={svgPathsBasket.p1fe4bc00} fill="#6F797A" />
                  </svg>
                </div>
                {/* Item info: name | brand | package size, all readable before Add */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] leading-6 text-[#617069]">
                    <span className="font-extrabold text-[#10231d]">{fields.name}</span>
                    {" | "}{fields.brand}{" | "}{fields.packageSize}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-5 text-[#718078]">
                    {item.item_category ?? "—"} · code {item.item_code}
                  </p>
                </div>
                {/* Price + all-store prices + Add to basket (Step 7 v2) */}
                {item.price != null ? (
                  <>
                    <div className="col-span-2 flex items-end justify-between gap-2">
                      <p className="text-[15px] font-bold text-[#17362c]">
                        From RM{item.price.toFixed(2)}
                        <span className="ml-2 text-[12px] font-medium text-[#718078]">
                          · {item.prices.length} store{item.prices.length === 1 ? "" : "s"}
                        </span>
                      </p>
                      {item.prices.length > 1 && (
                        <button
                          type="button"
                          aria-expanded={expandedId === item.item_id}
                          onClick={() => setExpandedId(expandedId === item.item_id ? null : item.item_id)}
                          className="min-h-11 px-2 text-[13px] font-extrabold text-[#087f5b]"
                        >
                          {expandedId === item.item_id ? "Hide stores ⌃" : "All store prices ⌄"}
                        </button>
                      )}
                    </div>
                    {expandedId === item.item_id && (
                      <ul className="col-span-2 rounded-xl bg-[#f2f6f3] p-2 text-[13px]">
                        {item.prices.map((sp, i) => (
                          <li key={i} className="flex justify-between gap-2 px-2 py-1">
                            <span className="truncate text-[#3e494a]">{sp.premise_name ?? "Unknown store"}</span>
                            <span className={`shrink-0 font-bold ${i === 0 ? "text-[#087f5b]" : "text-[#10231d]"}`}>
                              RM{sp.price.toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Quantity stepper (default 1, bounds 1–99) + typed input + Add (AC-1.4.1) */}
                    <div className="col-span-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" aria-label={`Decrease ${fields.name} quantity`} disabled={qty === DEFAULT_QTY} onClick={() => stepResultQty(item.item_id, -1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd8d1] text-lg text-[#087f5b] disabled:opacity-40">−</button>
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label={`${fields.name} quantity`}
                            value={rawQty}
                            onChange={e => typeResultQty(item.item_id, e.target.value)}
                            className="h-11 w-12 rounded-xl border border-[#cbd8d1] text-center text-sm font-bold text-[#10231d] focus:border-[#087f5b] focus:outline-none"
                          />
                          <button type="button" aria-label={`Increase ${fields.name} quantity`} disabled={qty === MAX_QTY} onClick={() => stepResultQty(item.item_id, 1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087f5b] text-lg text-white disabled:opacity-40">+</button>
                        </div>
                        <button
                          disabled={qty === null}
                          onClick={() => { if (qty === null) return; addRealItem(item, qty); }}
                          className="h-11 flex-1 shrink-0 rounded-xl border border-[#087f5b] bg-white px-5 text-[14px] font-extrabold text-[#087f5b] hover:bg-[#edf7f2] disabled:border-[#cbd8d1] disabled:text-[#718078] disabled:hover:bg-white"
                        >
                          + Add to basket
                        </button>
                      </div>
                      {qty === null && (
                        <p role="alert" className="text-[13px] font-semibold text-[#c92a2a]">{QTY_ERROR}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <button
                    disabled
                    className="col-span-2 h-11 w-full shrink-0 rounded-xl border border-[#cbd8d1] bg-[#f2f6f3] px-5 text-[14px] font-extrabold text-[#718078]"
                  >
                    No price data
                  </button>
                )}
              </article>
              );
            })}
          </div>
        )}
      </div>

        </>
      )}

      {/* Your basket */}
      {view === "basket" && (
        <>
      <div className="px-4 pb-5 pt-5 sm:px-6 sm:pt-8">
        <ProgressIndicator step={2} />
        <p className="mb-1 mt-6 text-sm font-bold text-[#087f5b]">Review before comparing</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">Your basket</h1>
        <p className="mt-2 text-[16px] leading-6 text-[#53635c]">Check quantities and lower-cost alternatives before choosing your travel preferences.</p>
      </div>

      <div className="px-4 pb-8 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_4px_18px_rgba(16,35,29,0.05)]">
          {/* Heading */}
          <div className="flex items-center justify-between border-b border-[#edf1ef] px-4 py-4">
            <div className="flex items-center gap-2">
              <IcoBasket color="#087f5b" size={22} />
              <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Basket items</h2>
            </div>
            <span className="text-sm font-bold text-[#617069]">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
          </div>

          <div className="p-4">

          {basket.length === 0 ? (
            <p className="text-[16px] text-[#3e494a] text-center py-4">Your basket is empty. Search and add items to start comparing prices.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {basket.map((item, idx) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 pr-3">
                      <p className="text-[15px] font-bold leading-5 text-[#10231d]">{item.name}</p>
                      <p className="text-[13px] leading-5 text-[#617069]">{item.brand} · {item.size}</p>
                      {/* Unit price + line subtotal so shoppers can compare and decide (优化第 1 章) */}
                      <p className="text-[13px] leading-5 text-[#617069]">RM{item.price.toFixed(2)} each</p>
                      <p className="text-[13px] leading-5 font-semibold text-[#17362c]">{linePriceLabel(item)}</p>
                      {item.saraEligible === true && <p className="text-xs font-medium text-[#166534] mt-1">SARA eligible · verified</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button aria-label={`Decrease ${item.name} quantity`} onClick={() => updateQty(item.id, -1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd8d1] text-lg text-[#087f5b]">−</button>
                      <span aria-label={`${item.qty} selected`} className="w-7 text-center text-sm font-bold">{item.qty}</span>
                      <button aria-label={`Increase ${item.name} quantity`} onClick={() => updateQty(item.id, 1)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087f5b] text-lg text-white">+</button>
                      <button aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)} className="flex h-11 w-9 items-center justify-center">
                        <IcoTrash />
                      </button>
                    </div>
                  </div>
                  {idx < basket.length - 1 && <div className="border-b border-[#e1e3e4]" />}
                </div>
              ))}
            </div>
          )}

          {/* Prices note */}
          <div className="mt-4 rounded-xl bg-[#f2f6f3] px-3 py-2 text-center">
            <p className="text-[13px] leading-5 text-[#53635c]">This is an item estimate. We&apos;ll calculate the comparable store total using your location.</p>
          </div>

          {basket.some(item => item.id === "2") && (
            <div className="mt-4 rounded-xl border border-[#ead98e] bg-[#fff9e8] p-3 text-left">
              <p className="text-sm font-semibold text-[#5f4700]">Lower-cost option available</p>
              <p className="text-sm text-[#3e494a] mt-1">Cooking Oil 500g costs RM7.20 now. Your 1kg pack costs more today but offers better long-term value at RM12.50/kg versus RM14.40/kg.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => setBasket(basket.map(item => item.id === "2" ? { ...item, name: "Cooking Oil (Blended) 500g", size: "500g polybag", price: 7.20, unitPrice: 14.40 } : item))}
                  className="min-h-11 rounded-lg border border-[#087f5b] bg-white px-3 text-sm font-bold text-[#087f5b]"
                >
                  Spend RM5.30 less now
                </button>
                <span className="inline-flex items-center px-2 text-xs font-semibold text-[#286d67]">1kg is best value per kg</span>
              </div>
            </div>
          )}

          {basket.some(item => item.id === "2" && item.size.startsWith("500g")) && (
            <p role="status" className="mt-3 text-sm font-medium text-[#286d67]">Basket updated · potential saving RM5.30</p>
          )}

          </div>
        </div>
      </div>
        </>
      )}

      {(view === "basket" || itemCount > 0) && !(view === "shop" && categoryOpen) && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[712px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#718078]">{itemCount} item{itemCount === 1 ? "" : "s"} · item estimate</p>
            <p className="text-lg font-extrabold text-[#10231d]">RM{basketEstimate.toFixed(2)}</p>
          </div>
          <button
            onClick={view === "shop" ? onViewBasket : handleContinue}
            className="flex h-14 min-w-[190px] items-center justify-center gap-2 rounded-2xl bg-[#087f5b] px-5 text-[15px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)]"
          >
            {view === "shop" ? "View basket" : "Choose location"}
            <IcoArrowRight />
          </button>
        </div>
        {emptyError && (
          <p role="alert" className="mx-auto mt-2 max-w-[712px] text-right text-sm font-medium text-[#ba1a1a]">Add at least one item to continue.</p>
        )}
      </div>}
    </div>
  );
}

// ── Screen 2: Set Your Location ───────────────────────────────────────────────
const TRANSPORT_OPTS: Array<{
  id: TransportMode;
  label: string;
  Icon: ({ active }: { active: boolean }) => React.ReactNode;
}> = [
  { id: "walk", label: "Walking", Icon: ({ active }: { active: boolean }) => <IcoWalkFigma color={active ? "white" : "#3E494A"} /> },
  { id: "public_transport", label: "Public Transport", Icon: ({ active }: { active: boolean }) => <IcoBusFigma color={active ? "white" : "#3E494A"} /> },
  { id: "motorcycle", label: "Motorcycle", Icon: ({ active }: { active: boolean }) => <IcoMotoFigma color={active ? "white" : "#3E494A"} /> },
  { id: "car", label: "Car", Icon: ({ active }: { active: boolean }) => <IcoCarFigma color={active ? "white" : "#3E494A"} /> },
];

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
}: {
  preferences: TravelPreferences;
  onBack: () => void;
  onCompare: (preferences: TravelPreferences) => void;
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
          setLocationError(error instanceof Error ? error.message : "Location search is unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchState("idle");
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locationInput, selectedOrigin, sessionToken]);

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
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "That location could not be selected.");
    } finally {
      setSearchState("idle");
    }
  };

  const usePreciseLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("This browser does not support precise location.");
      return;
    }

    setSearchState("locating");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      position => {
        const origin: SelectedLocation = {
          label: "Current precise location",
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
          ? "Location access was not allowed. Search for a location instead."
          : "Your precise location could not be found. Try again or search instead.";
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
      setLocationError("Use your precise location or select a location from the search suggestions.");
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
      <header className="fixed inset-x-0 top-0 z-50 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-[#e7ece9] bg-white/95 px-4 backdrop-blur">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 justify-self-start text-[14px] font-bold text-[#087f5b]">
          <IcoArrowBack /> Back
        </button>
        <span className="text-lg font-extrabold tracking-[-0.3px] text-[#10231d]">SmartCart</span>
        <span aria-hidden="true" />
      </header>

      <div className="px-4 pb-5 pt-20 sm:px-6">
        <ProgressIndicator step={3} />
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <p className="mb-1 text-sm font-bold text-[#087f5b]">Find a reachable shop</p>
        <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">How do you get around?</h1>
        <p className="mt-2 text-[16px] leading-6 text-[#53635c]">
          Set a precise starting point, transport mode and realistic travel limit.
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-36 sm:px-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5">
          <div className="flex items-center gap-2">
            <IcoLocation />
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Starting point</h2>
          </div>

          <button
            type="button"
            onClick={usePreciseLocation}
            disabled={searchState === "locating"}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-[#087f5b] bg-[#edf7f2] px-4 text-[15px] font-extrabold text-[#087f5b] disabled:cursor-wait disabled:opacity-60"
          >
            <IcoLocation color="#087f5b" />
            {searchState === "locating" ? "Finding your location..." : "Use my precise location"}
          </button>

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-[#718078]">
            <span className="h-px flex-1 bg-[#dce5e0]" />
            or search
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
              aria-label="Search for a starting location"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="location-suggestions"
              aria-activedescendant={activeSuggestion >= 0 ? "location-suggestion-" + activeSuggestion : undefined}
              placeholder="Search an address, town or postcode"
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
                <p className="bg-[#fafbf9] px-4 py-2 text-right text-[11px] font-semibold text-[#718078]">Powered by Google</p>
              </div>
            )}
          </div>

          <div aria-live="polite" className="min-h-5 text-sm">
            {searchState === "searching" && <span className="text-[#53635c]">Searching locations...</span>}
            {searchState === "resolving" && <span className="text-[#53635c]">Selecting location...</span>}
            {selectedOrigin && searchState === "idle" && <span className="font-medium text-[#166534]">Location selected.</span>}
            {locationError && <span role="alert" className="font-medium text-[#ba1a1a]">{locationError}</span>}
          </div>

          <div className="flex items-start gap-1 text-[14px] text-[#3e494a]">
            <svg width={13.333} height={13.333} viewBox="0 0 13.3333 13.3333" fill="none" className="mt-0.5 shrink-0">
              <path d={svgPathsLocation.p33549300} fill="#3E494A" />
            </svg>
            <span>Your location is sent to Google Maps to calculate routes and is never saved by SmartCart. Remembered preferences exclude location.</span>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Transport mode</h2>
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
                  <span className={"text-[14px] font-medium leading-5 " + (active ? "text-white" : "text-[#191c1d]")}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Travel limit</h2>
            <p className="mt-1 text-[16px] text-[#3e494a]">Choose a one-way route distance or travel time.</p>
          </div>
          <div className="grid grid-cols-2 rounded-xl bg-[#e8efeb] p-1" aria-label="Travel limit type">
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
                {type === "distance" ? "Distance" : "Travel time"}
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
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">SARA planning <span className="text-sm font-normal text-[#53635c]">(optional)</span></h2>
            <p className="mt-1 text-sm text-[#3e494a]">You do not need to share your income or eligibility.</p>
          </div>
          <label className="flex items-start gap-3 text-[16px] text-[#191c1d]">
            <input
              type="checkbox"
              checked={saraFilter === "candidate"}
              onChange={event => setSaraFilter(event.target.checked ? "candidate" : "any")}
              className="mt-1 h-5 w-5 accent-[#00535b]"
            />
            <span>
              Show only SARA match candidates
              <span className="mt-1 block text-xs text-[#6f797a]">Automated one-to-one matches for development; not independently verified partners.</span>
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
          <span className="text-[16px] leading-6 text-[#191c1d]">Remember transport and travel-limit preferences on this device</span>
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[712px] gap-3">
          <button type="button" onClick={onBack} className="h-14 flex-[0.8] rounded-2xl border border-[#cbd8d1] bg-white text-[14px] font-bold text-[#087f5b]">
            Back to Basket
          </button>
          <button
            type="button"
            onClick={handleCompare}
            disabled={!selectedOrigin || searchState === "resolving" || searchState === "locating"}
            className="h-14 flex-1 rounded-2xl bg-[#087f5b] text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)] disabled:cursor-not-allowed disabled:bg-[#8aa69d] disabled:shadow-none"
          >
            Find reachable stores
          </button>
        </div>
      </div>
    </div>
  );
}

function CompareScreen({
  basket,
  preferences,
  onBack,
}: {
  basket: BasketItem[];
  preferences: TravelPreferences;
  onBack: () => void;
}) {
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!preferences.origin) {
      setError("Choose a starting location before requesting recommendations.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    getRecommendations({
      basket: basket.map(item => ({ itemId: item.id, quantity: item.qty })),
      travel: {
        origin: preferences.origin,
        transportMode: preferences.transportMode,
        limit: { type: preferences.limitType, value: preferences.limitValue },
        saraFilter: preferences.saraFilter,
      },
    }, controller.signal)
      .then(setResult)
      .catch(requestError => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(
          requestError instanceof SmartCartApiError
            ? requestError.message
            : "Recommendations are temporarily unavailable. Please try again.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [basket, preferences]);

  const recommendations = result?.recommendations ?? [];
  const visibleStores = showAll ? recommendations : recommendations.slice(0, 5);
  const recommendedStore = recommendations[0];
  const modeLabel = TRANSPORT_OPTS.find(option => option.id === preferences.transportMode)?.label ?? "Selected transport";
  const limitLabel = preferences.limitType === "distance"
    ? preferences.limitValue + " km"
    : preferences.limitValue + " minutes";

  return (
    <div className="screen-enter pb-8">
      <div className="flex flex-col gap-6 px-4 pb-6 pt-5 sm:gap-8 sm:px-6 sm:pt-8">
        <div className="flex flex-col gap-4">
          <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 self-start text-[14px] font-bold text-[#087f5b]">
            <IcoArrowBack /> Back to travel preferences
          </button>
          <ProgressIndicator step={4} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-[#087f5b]">Transport-first recommendation</p>
          <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">
            Best reachable stores
          </h1>
          <p className="text-[15px] leading-6 text-[#53635c]">
            Stores within a one-way limit of {limitLabel} from {preferences.origin?.label} by {modeLabel.toLowerCase()}.
          </p>
          {preferences.saraFilter === "candidate" && (
            <p className="text-sm font-medium text-[#7a5b00]">Filter applied: automated SARA match candidates only. These are not independently verified.</p>
          )}
        </div>

        {loading && (
          <div role="status" className="rounded-2xl border border-[#dce5e0] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#cce3d9] border-t-[#087f5b]" />
            <p className="font-bold text-[#17362c]">Checking reachable PriceCatcher stores...</p>
            <p className="mt-1 text-sm text-[#617069]">Route times depend on the selected transport mode.</p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-[#f0b8b8] bg-[#fff5f5] p-5 text-center">
            <div className="mx-auto mb-2 flex w-fit items-center gap-2 font-bold text-[#93000a]"><IcoWarn /> Recommendation unavailable</div>
            <p className="text-sm leading-5 text-[#6f3030]">{error}</p>
            <button type="button" onClick={onBack} className="mt-4 min-h-11 rounded-xl border border-[#ba1a1a] bg-white px-4 text-sm font-bold text-[#93000a]">Change travel preferences</button>
          </div>
        )}

        {!loading && !error && recommendedStore && (
          <div className="flex gap-3 rounded-2xl border border-[#b9e0d1] bg-[#e7f7f0] p-4 sm:gap-4 sm:p-5">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white"><IcoSavings /></div>
            <div className="flex flex-col gap-1">
              <p className="text-[20px] font-extrabold leading-7 text-[#175f4b]">{recommendedStore.name}</p>
              <p className="text-[14px] leading-5 text-[#286d67]">
                Best match by estimated return transport cost, then travel time and route distance.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && result?.routeWarning && (
          <div className="flex items-start gap-2 rounded-xl border border-[#ead89d] bg-[#fff9e8] p-4 text-sm leading-5 text-[#6d5700]">
            <IcoWarn color="#6d5700" />
            <span>{result.routeWarning}</span>
          </div>
        )}

        {!loading && !error && result && (
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Reachable premises</h2>
                <p className="mt-1 text-sm text-[#617069]">{result.totalReachable} reachable from {result.totalCandidatesEvaluated} nearby candidates checked.</p>
              </div>
              <span className="text-right text-xs font-medium text-[#718078]">Lower travel cost first</span>
            </div>

            <div className="flex flex-col gap-3">
              {visibleStores.map((store, index) => (
                <article key={store.premiseId} className={"relative overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(16,35,29,0.06)] " + (index === 0 ? "border-2 border-[#087f5b]" : "border-[#e2e9e5]")}>
                  {index === 0 && (
                    <div className="bg-[#087f5b] px-3 py-2 text-center">
                      <span className="text-[13px] font-extrabold leading-5 text-white">Recommended reachable store</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-4 px-4 pb-5 pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf3ef]"><IcoStore /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[18px] font-extrabold leading-6 text-[#10231d] sm:text-[20px] sm:leading-7">{store.name}</p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <IcoPriceCatcher />
                          <span className="text-[13px] font-medium text-[#53635c]">PriceCatcher premise {store.premiseCode}</span>
                        </div>
                        {(store.address || store.district || store.state) && (
                          <p className="mt-2 text-[13px] leading-5 text-[#617069]">{[store.address, store.district, store.state].filter(Boolean).join(", ")}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-[#f3faf7] p-3">
                        <p className="text-xs text-[#617069]">Return travel</p>
                        <p className="mt-1 text-lg font-extrabold text-[#087f5b]">RM{store.estimatedRoundTripCostRm.toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-[#f7f8f6] p-3">
                        <p className="text-xs text-[#617069]">One way</p>
                        <p className="mt-1 text-lg font-extrabold text-[#17362c]">{store.estimatedTravelMinutes} min</p>
                      </div>
                      <div className="rounded-xl bg-[#f7f8f6] p-3">
                        <p className="text-xs text-[#617069]">Route</p>
                        <p className="mt-1 text-lg font-extrabold text-[#17362c]">{store.routeDistanceKm.toFixed(1)} km</p>
                      </div>
                    </div>

                    {store.saraStatus === "verified" ? (
                      <span className="inline-flex self-start rounded-sm bg-[#e5f5ed] px-2 py-1 text-xs font-semibold text-[#166534]">Verified SARA partner</span>
                    ) : store.saraStatus === "candidate" ? (
                      <span className="inline-flex self-start rounded-sm bg-[#fff4ce] px-2 py-1 text-xs font-semibold text-[#755b00]">SARA match candidate - requires verification</span>
                    ) : (
                      <span className="inline-flex self-start rounded-sm bg-[#f3f4f5] px-2 py-1 text-xs font-medium text-[#5f6368]">SARA status not verified</span>
                    )}
                  </div>
                </article>
              ))}

              {recommendations.length > 5 && (
                <button type="button" onClick={() => setShowAll(value => !value)} className="h-12 w-full rounded-xl border border-[#087f5b] bg-white text-sm font-bold text-[#087f5b]">
                  {showAll ? "Show first 5" : "See more (+" + (recommendations.length - 5) + ")"}
                </button>
              )}

              {recommendations.length === 0 && (
                <div className="rounded-2xl border border-[#bec8ca] bg-white p-5 text-center">
                  <p className="font-semibold text-[#191c1d]">No routed stores were found inside this travel limit.</p>
                  <p className="mt-1 text-sm text-[#617069]">Try a larger limit, another transport mode, or remove the SARA candidate filter.</p>
                  <button type="button" onClick={onBack} className="mt-3 min-h-11 px-3 font-bold text-[#00535b]">Change travel preferences</button>
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && !error && result && (
          <details className="rounded-2xl border border-[#dce5e0] bg-white p-4 text-sm">
            <summary className="cursor-pointer font-bold text-[#17362c]">How this recommendation is calculated</summary>
            <p className="mt-3 leading-5 text-[#53635c]">{result.rankingMethod}</p>
            <p className="mt-2 leading-5 text-[#53635c]">{result.costAssumptions[preferences.transportMode]}</p>
            <p className="mt-2 leading-5 text-[#53635c]">Route distance and time are estimates from Google Maps. Straight-line distance is used only to limit paid route checks; SmartCart does not store your starting location.</p>
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

  const showHeader = screen !== "location";
  const basketCount = basket.reduce((count, item) => count + item.qty, 0);

  return (
    <div className="min-h-full bg-[#f7f8f6]">
      {showHeader && (
        <Header
          basketCount={basketCount}
          basketActive={screen === "basket"}
          onBasket={() => setScreen("basket")}
          onBack={screen === "basket" ? () => setScreen("shop") : undefined}
        />
      )}

      <main className={`mx-auto w-full max-w-[760px] ${showHeader ? "pt-16" : ""}`}>
        {screen === "shop" && (
          <BasketScreen
            view="shop"
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => setScreen("basket")}
            onContinue={() => setScreen("location")}
          />
        )}
        {screen === "basket" && (
          <BasketScreen
            view="basket"
            basket={basket}
            setBasket={setBasket}
            onViewBasket={() => setScreen("basket")}
            onContinue={() => setScreen("location")}
          />
        )}
        {screen === "location" && (
          <LocationScreen
            preferences={preferences}
            onBack={() => setScreen("basket")}
            onCompare={nextPreferences => {
              setPreferences(nextPreferences);
              setScreen("compare");
            }}
          />
        )}
        {screen === "compare" && (
          <CompareScreen basket={basket} preferences={preferences} onBack={() => setScreen("location")} />
        )}
      </main>
    </div>
  );
}
