"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import svgPathsBasket from "@/components/icons/basket";
import svgPathsLocation from "@/components/icons/location";
import svgPathsCompare from "@/components/icons/compare";
import svgPathsSaved from "@/components/icons/saved";

const productImg = "/rice-product.png";

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
  location: string;
  transport: string;
  distanceKm: number;
  saraOnly: boolean;
  saraCredit: number;
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

const STORES = [
  { id: "s1", name: "Pasar Mini Murni", total: 58.40, avg: 70.80, updated: "18 Aug 2026", distanceKm: 1.8, travelMinutes: 6, saraPartner: true as const, recommended: true, items: { "2": 12.50, "3": 13.00, "4": 17.00, "1": 15.90 } },
  { id: "s2", name: "Kedai Rakyat Harmoni", total: 63.20, avg: 70.80, updated: "18 Aug 2026", distanceKm: 2.4, travelMinutes: 8, saraPartner: null, recommended: false, items: { "2": 13.00, "3": 14.50, "4": 18.50, "1": 17.20 } },
  { id: "s3", name: "Pasaraya Sejahtera", total: 67.80, avg: 70.80, updated: "18 Aug 2026", distanceKm: 3.1, travelMinutes: 10, saraPartner: true as const, recommended: false, items: { "2": 14.20, "3": 15.00, "4": 22.10, "1": 16.50 } },
  { id: "s5", name: "Pasar Mini Cemerlang", total: 68.10, avg: 70.80, updated: "17 Aug 2026", distanceKm: 3.8, travelMinutes: 12, saraPartner: null, recommended: false, items: { "2": 13.80, "3": 14.80, "4": 21.40, "1": 18.10 } },
  { id: "s6", name: "Kedai Keluarga Kita", total: 69.40, avg: 70.80, updated: "18 Aug 2026", distanceKm: 4.2, travelMinutes: 14, saraPartner: true as const, recommended: false, items: { "2": 14.00, "3": 15.10, "4": 20.90, "1": 19.40 } },
  { id: "s7", name: "Pasaraya Pantai Timur", total: 71.20, avg: 70.80, updated: "16 Aug 2026", distanceKm: 4.6, travelMinutes: 15, saraPartner: null, recommended: false, items: { "2": 14.40, "3": 15.20, "4": 21.70, "1": 19.90 } },
  { id: "s8", name: "Kedai Mesra Wakaf", total: 72.00, avg: 70.80, updated: "18 Aug 2026", distanceKm: 4.9, travelMinutes: 16, saraPartner: true as const, recommended: false, items: { "2": 14.50, "3": 15.50, "4": 21.80, "1": 20.20 } },
];
const PARTIAL_STORES = [
  { id: "s4", name: "Kedai Desa Amanah", total: 42.50, updated: "18 Aug 2026", missing: 2, items: { "2": 12.80, "3": null, "4": null, "1": 15.50 } },
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

// ── Header ───────────────────────────────────────────────────────────────────
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

  const inBasket = (id: string) => basket.find(b => b.id === id);

  const addItem = (c: typeof CATALOG[0]) => {
    const existing = basket.find(b => b.id === c.id);
    if (existing) {
      setBasket(basket.map(b => b.id === c.id ? { ...b, qty: b.qty + 1 } : b));
    } else {
      setBasket([...basket, {
        id: c.id,
        name: c.name,
        brand: c.brand,
        size: c.size,
        qty: 1,
        price: c.price,
        unitPrice: c.unitPrice,
        saraEligible: c.saraEligible,
      }]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setBasket(basket.map(b => b.id === id ? { ...b, qty: Math.max(1, b.qty + delta) } : b));
  };

  const removeItem = (id: string) => setBasket(basket.filter(b => b.id !== id));

  const handleContinue = () => {
    if (basket.length === 0) { setEmptyError(true); return; }
    setEmptyError(false);
    onContinue();
  };

  const itemCount = basket.reduce((count, item) => count + item.qty, 0);
  const basketEstimate = basket.reduce((total, item) => total + item.price * item.qty, 0);

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

      {/* Search */}
      <div className="sticky top-16 z-30 bg-[#f7f8f6]/95 px-4 pb-3 pt-2 backdrop-blur sm:px-6">
        <div className="relative h-14">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <IcoSearch />
          </div>
          <input
            type="text"
            aria-label="Search household essentials"
            placeholder="Search household essentials"
            value={search}
            onChange={e => setSearch(e.target.value)}
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

      {/* Matching items */}
      <div className="px-4 pb-7 sm:px-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">{search ? "Search results" : activeCategories.length > 0 ? "Selected categories" : "All essentials"}</h2>
          <span className="text-sm font-medium text-[#718078]">{filtered.length} item{filtered.length === 1 ? "" : "s"}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.length === 0 ? (
            <p className="text-[16px] text-[#3e494a] text-center py-6">No items found. Try another keyword.</p>
          ) : filtered.slice(0, 5).map(item => {
            const basketItem = inBasket(item.id);
            return (
              <article key={item.id} className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[#e2e9e5] bg-white p-3 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-4">
                {/* Image */}
                <div className="h-[84px] w-[84px] shrink-0 sm:h-[92px] sm:w-[92px]">
                  {item.hasImg ? (
                    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#eef2ef]">
                      <Image src={productImg} alt={item.name} fill sizes="92px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#eef2ef]">
                      <svg width={24} height={24} viewBox="0 0 18 18" fill="none">
                        <path d={svgPathsBasket.p1fe4bc00} fill="#6F797A" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-extrabold leading-5 text-[#10231d]">{item.name}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-[#617069]">{item.brand} · {item.size}</p>
                  <p className="mt-1 text-[15px] font-bold text-[#17362c]">From RM{item.price.toFixed(2)}</p>
                  <p className="text-[12px] text-[#718078]">RM{item.unitPrice.toFixed(2)}/{item.unit}</p>
                  {item.saraEligible === true && (
                    <span className="mt-1 inline-flex rounded-md bg-[#e8f7ef] px-2 py-0.5 text-[11px] font-bold text-[#166534]">SARA eligible · verified</span>
                  )}
                </div>
                {/* Action */}
                {basketItem ? (
                  <div className="col-span-2 flex h-11 shrink-0 items-center justify-between rounded-xl bg-[#edf7f2] p-1">
                    <button
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() => updateQty(item.id, -1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xl font-medium text-[#087f5b] shadow-sm"
                    >−</button>
                    <span aria-live="polite" className="w-8 text-center text-sm font-extrabold text-[#17362c]">{basketItem.qty}</span>
                    <button
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() => updateQty(item.id, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#087f5b] text-xl font-medium text-white shadow-sm"
                    >+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => addItem(item)}
                    className="col-span-2 h-11 w-full shrink-0 rounded-xl border border-[#087f5b] bg-white px-5 text-[14px] font-extrabold text-[#087f5b]"
                  >
                    + Add to basket
                  </button>
                )}
              </article>
            );
          })}
        </div>
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
const TRANSPORT_OPTS = [
  { id: "walk", label: "Walking", Icon: ({ active }: { active: boolean }) => <IcoWalkFigma color={active ? "white" : "#3E494A"} /> },
  { id: "bus", label: "Public Transport", Icon: ({ active }: { active: boolean }) => <IcoBusFigma color={active ? "white" : "#3E494A"} /> },
  { id: "moto", label: "Motorcycle", Icon: ({ active }: { active: boolean }) => <IcoMotoFigma color={active ? "white" : "#3E494A"} /> },
  { id: "car", label: "Car", Icon: ({ active }: { active: boolean }) => <IcoCarFigma color={active ? "white" : "#3E494A"} /> },
];

function LocationScreen({
  preferences,
  onBack,
  onCompare,
}: {
  preferences: TravelPreferences;
  onBack: () => void;
  onCompare: (preferences: TravelPreferences) => void;
}) {
  const [location, setLocation] = useState(preferences.location);
  const [transport, setTransport] = useState(preferences.transport);
  const [distance, setDistance] = useState(preferences.distanceKm);
  const [saraOnly, setSaraOnly] = useState(preferences.saraOnly);
  const [saraCredit, setSaraCredit] = useState(preferences.saraCredit);
  const [remember, setRemember] = useState(true);

  const handleCompare = () => {
    const nextPreferences = { location, transport, distanceKm: distance, saraOnly, saraCredit };
    if (remember) window.localStorage.setItem("smartcart-travel-preferences", JSON.stringify(nextPreferences));
    else window.localStorage.removeItem("smartcart-travel-preferences");
    onCompare(nextPreferences);
  };

  return (
    <div className="screen-enter">
      {/* Transactional back header (overlays the main header) */}
      <header className="fixed inset-x-0 top-0 z-50 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-[#e7ece9] bg-white/95 px-4 backdrop-blur">
        <button onClick={onBack} className="flex min-h-11 items-center gap-2 justify-self-start text-[14px] font-bold text-[#087f5b]">
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
          Set a realistic starting point, transport mode and travel limit.
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 pb-36 sm:px-6">
        {/* Location card */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)] sm:p-5">
          <div className="flex items-center gap-2">
            <IcoLocation />
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Starting point</h2>
          </div>
          {/* Input */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2"><IcoSearch color="#3E494A" /></div>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              aria-label="Starting location"
              className="h-14 w-full rounded-xl border border-[#dce5e0] bg-[#f7f9f8] pl-10 pr-4 text-[16px] text-[#10231d] focus:border-[#087f5b] focus:outline-none"
            />
          </div>
          {/* Privacy note */}
          <div className="flex items-start gap-1 text-[14px] text-[#3e494a]">
            <svg width={13.333} height={13.333} viewBox="0 0 13.3333 13.3333" fill="none" className="shrink-0 mt-0.5">
              <path d={svgPathsLocation.p33549300} fill="#3E494A" />
            </svg>
            <span>Your precise location does not need to be saved.</span>
          </div>
        </div>

        {/* Transport mode */}
        <div className="flex flex-col gap-4">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Transport mode</h2>
          <div className="grid grid-cols-2 gap-3">
            {TRANSPORT_OPTS.map(t => {
              const active = transport === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTransport(t.id)}
                  aria-pressed={active}
                  className={`flex min-h-[92px] flex-col items-center justify-center rounded-2xl border py-4 shadow-sm ${
                    active ? "border-[#087f5b] bg-[#087f5b]" : "border-[#dce5e0] bg-white"
                  }`}
                >
                  <div className="mb-2"><t.Icon active={active} /></div>
                  <span className={`text-[14px] font-medium leading-5 ${active ? "text-white" : "text-[#191c1d]"}`}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Travel limit */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Travel limit</h2>
          <p className="text-[16px] text-[#3e494a]">We&apos;ll only compare stores within this limit.</p>
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[2, 5, 10, 15].map(d => (
              <button
                key={d}
                onClick={() => setDistance(d)}
                aria-pressed={distance === d}
                className={`h-12 rounded-xl border px-2 text-[14px] font-bold ${
                  distance === d ? "border-[#087f5b] bg-[#087f5b] text-white" : "border-[#dce5e0] bg-white text-[#405149]"
                }`}
              >
                {d}km
              </button>
            ))}
          </div>
        </div>

        {/* Remember preferences */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)]">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">SARA planning <span className="text-sm font-normal text-[#53635c]">(optional)</span></h2>
            <p className="text-sm text-[#3e494a] mt-1">You do not need to share your income or eligibility.</p>
          </div>
          <label className="flex items-start gap-3 text-[16px] text-[#191c1d]">
            <input type="checkbox" checked={saraOnly} onChange={event => setSaraOnly(event.target.checked)} className="mt-1 w-5 h-5 accent-[#00535b]" />
            <span>Show only stores verified as SARA partners</span>
          </label>
          <label htmlFor="sara-credit" className="text-sm font-medium text-[#191c1d]">SARA credit available for this shop (RM)</label>
          <input
            id="sara-credit"
            type="number"
            min="0"
            step="1"
            value={saraCredit}
            onChange={event => setSaraCredit(Math.max(0, Number(event.target.value)))}
            className="h-14 w-full rounded-xl border border-[#dce5e0] bg-[#f7f9f8] px-3 text-[16px]"
          />
          <p className="text-xs text-[#6f797a]">Estimates use only items and stores marked as verified. Confirm acceptance at the store.</p>
        </div>

        {/* Remember preferences */}
        <button
          onClick={() => setRemember(!remember)}
          aria-pressed={remember}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#dce5e0] bg-white px-4 py-3 text-left"
        >
          <div className={`w-[22px] h-[22px] rounded-[2px] flex items-center justify-center shrink-0 border ${remember ? "bg-[#00535b] border-[#00535b]" : "bg-white border-[#bec8ca]"}`}>
            {remember && <IcoCheckbox />}
          </div>
          <span className="text-[16px] text-[#191c1d] leading-6">Remember my travel preferences on this device (No account required)</span>
        </button>
      </div>

      {/* Fixed bottom actions */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe7e2] bg-white/96 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(16,35,29,0.10)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-[712px] gap-3">
          <button onClick={onBack} className="h-14 flex-[0.8] rounded-2xl border border-[#cbd8d1] bg-white text-[14px] font-bold text-[#087f5b]">
            Back to Basket
          </button>
          <button onClick={handleCompare} className="h-14 flex-1 rounded-2xl bg-[#087f5b] text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(8,127,91,0.25)]">
            Compare Prices
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Screen 3: Compare Stores ──────────────────────────────────────────────────
function CompareScreen({ basket, preferences, onBack }: { basket: BasketItem[]; preferences: TravelPreferences; onBack: () => void }) {
  const [breakdown, setBreakdown] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const reachableStores = useMemo(
    () => STORES.filter(store => store.distanceKm <= preferences.distanceKm && (!preferences.saraOnly || store.saraPartner === true)),
    [preferences.distanceKm, preferences.saraOnly],
  );
  const visibleStores = showAll ? reachableStores : reachableStores.slice(0, 5);
  const recommendedStore = reachableStores[0];
  const savings = recommendedStore ? recommendedStore.avg - recommendedStore.total : 0;
  const verifiedSaraSubtotal = basket.reduce((total, item) => {
    if (item.saraEligible !== true || !recommendedStore) return total;
    const itemPrice = recommendedStore.items[item.id as keyof typeof recommendedStore.items];
    return total + (itemPrice ?? 0) * item.qty;
  }, 0);
  const creditUse = Math.min(preferences.saraCredit, verifiedSaraSubtotal);
  const cashRequired = Math.max(0, (recommendedStore?.total ?? 0) - creditUse);

  return (
    <div className="screen-enter pb-8">
      <div className="flex flex-col gap-6 px-4 pb-6 pt-5 sm:gap-8 sm:px-6 sm:pt-8">
        <div className="flex flex-col gap-4">
          <button onClick={onBack} className="flex min-h-11 items-center gap-2 self-start text-[14px] font-bold text-[#087f5b]">
            <IcoArrowBack /> Back to travel preferences
          </button>
          <ProgressIndicator step={4} />
        </div>

        {/* Header section */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-[#087f5b]">Complete basket matches</p>
          <h1 className="text-[30px] font-extrabold leading-[36px] tracking-[-0.8px] text-[#10231d] sm:text-[36px] sm:leading-[42px]">
            Best reachable stores
          </h1>
          <p className="text-[15px] leading-6 text-[#53635c]">
            Comparing {reachableStores.length} reachable premises within {preferences.distanceKm} km of {preferences.location} by {TRANSPORT_OPTS.find(option => option.id === preferences.transport)?.label.toLowerCase()}.
          </p>
          {preferences.saraOnly && <p className="text-sm font-medium text-[#166534]">Filter applied: verified SARA partner stores only.</p>}
        </div>

        {/* Savings banner */}
        {recommendedStore && <div className="flex gap-3 rounded-2xl border border-[#b9e0d1] bg-[#e7f7f0] p-4 sm:gap-4 sm:p-5">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white"><IcoSavings /></div>
          <div className="flex flex-col gap-2">
            <p className="text-[20px] font-extrabold leading-7 text-[#175f4b]">Save about RM{savings.toFixed(2)}</p>
            <p className="text-[14px] leading-5 text-[#286d67]">
              {recommendedStore.name} is the lowest-priced complete basket among stores inside your travel limit, at RM{savings.toFixed(2)} below the average.
            </p>
          </div>
        </div>}

        {recommendedStore?.saraPartner === true && preferences.saraCredit > 0 && (
          <div className="rounded-2xl border border-[#e2e9e5] bg-white p-4 shadow-[0_4px_18px_rgba(16,35,29,0.05)]">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="text-[20px] font-semibold text-[#191c1d]">Estimated payment plan</h2>
              <span className="bg-[#e5f5ed] text-[#166534] text-xs font-semibold px-2 py-1 rounded-[2px]">Verified SARA partner</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-[#f3faf7] p-3 rounded-[4px]"><p className="text-sm text-[#3e494a]">SARA credit</p><p className="text-xl font-bold text-[#166534]">RM{creditUse.toFixed(2)}</p></div>
              <div className="bg-[#f8f9fa] p-3 rounded-[4px]"><p className="text-sm text-[#3e494a]">Cash required</p><p className="text-xl font-bold text-[#191c1d]">RM{cashRequired.toFixed(2)}</p></div>
            </div>
            <p className="text-xs text-[#6f797a] mt-3">Estimate only. Unverified items are treated as cash, not as ineligible. Confirm the final amount at checkout.</p>
          </div>
        )}

        {/* Full basket section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Full basket available</h2>
            <span className="text-sm font-medium text-[#718078]">Cheapest first</span>
          </div>
          <div className="flex flex-col gap-3">
            {visibleStores.map((store, index) => (
              <article key={store.id} className={`relative overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(16,35,29,0.06)] ${index === 0 ? "border-2 border-[#087f5b]" : "border-[#e2e9e5]"}`}>
                {index === 0 && (
                  <div className="bg-[#087f5b] px-3 py-2 text-center">
                    <span className="text-[13px] font-extrabold leading-5 text-white">Best match · lowest complete price</span>
                  </div>
                )}
                <div className="flex flex-col gap-2 px-4 pb-5 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf3ef]">
                      <IcoStore />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[18px] font-extrabold leading-6 text-[#10231d] sm:text-[20px] sm:leading-7">{store.name}</p>
                      <div className="flex items-center gap-1">
                        <IcoPriceCatcher />
                        <span className="text-[14px] font-medium leading-5 text-[#3e494a] tracking-[0.14px]">PriceCatcher</span>
                      </div>
                      <p className="mt-1 text-[14px] font-medium text-[#53635c]">{store.distanceKm} km · about {store.travelMinutes} min</p>
                      {store.saraPartner === true ? (
                        <span className="inline-flex mt-1 bg-[#e5f5ed] text-[#166534] px-2 py-0.5 rounded-[2px] text-xs font-medium">Verified SARA partner</span>
                      ) : (
                        <span className="inline-flex mt-1 bg-[#f3f4f5] text-[#5f6368] px-2 py-0.5 rounded-[2px] text-xs font-medium">SARA status not verified</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end justify-between pt-2">
                    <span className="text-[16px] text-[#3e494a]">Total</span>
                    <span className={`text-[24px] font-extrabold leading-7 ${index === 0 ? "text-[#087f5b]" : "text-[#10231d]"}`}>
                      RM{store.total.toFixed(2)}
                    </span>
                  </div>
                  {index === 0 && (
                    <div className="inline-block self-start bg-[#dcfce7] px-2 py-1 rounded-[2px]">
                      <span className="text-[14px] font-medium leading-5 text-[#166534] tracking-[0.14px]">
                        Save RM{savings.toFixed(2)} vs average
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ece9] bg-[#fafbf9] px-4 py-2">
                  <span className="text-[12px] font-medium leading-5 text-[#617069]">Price observed: {store.updated}</span>
                  <button onClick={() => setBreakdown(true)} className="min-h-11 px-2 text-[14px] font-extrabold leading-5 text-[#087f5b]">
                    View breakdown
                  </button>
                </div>
              </article>
            ))}
            {reachableStores.length > 5 && (
              <button onClick={() => setShowAll(value => !value)} className="h-12 w-full rounded-xl border border-[#087f5b] bg-white text-sm font-bold text-[#087f5b]">
                {showAll ? "Show first 5" : `See more (+${reachableStores.length - 5})`}
              </button>
            )}
            {reachableStores.length === 0 && (
              <div className="bg-white border border-[#bec8ca] rounded-[8px] p-5 text-center">
                <p className="font-semibold text-[#191c1d]">No verified partner stores found inside this travel limit.</p>
                <button onClick={onBack} className="mt-3 text-[#00535b] font-medium">Change travel or SARA preferences</button>
              </div>
            )}
          </div>
        </div>

        {/* Partial basket section */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[20px] font-extrabold leading-7 text-[#10231d]">Partial basket</h2>
            <p className="mt-1 text-sm text-[#3e494a]">These stores do not list every item in your basket.</p>
          </div>
          {PARTIAL_STORES.map(store => (
            <div key={store.id} className="bg-white rounded-[8px] overflow-hidden opacity-80 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.05)] border border-[#bec8ca]">
              <div className="flex flex-col gap-4 pb-8 pt-4 px-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#e7e8e9] rounded-xl flex items-center justify-center shrink-0">
                      <IcoStore />
                    </div>
                    <div>
                      <p className="text-[20px] font-semibold leading-7 text-[#191c1d]">{store.name}</p>
                      <div className="flex items-center gap-1">
                        <IcoPriceCatcher />
                        <span className="text-[14px] font-medium leading-5 text-[#3e494a] tracking-[0.14px]">PriceCatcher</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#ffdad6] flex items-center gap-1 px-2 py-1 rounded-[2px]">
                    <IcoWarn />
                    <span className="text-[14px] font-medium text-[#93000a] leading-5 tracking-[0.14px] whitespace-nowrap">Missing {store.missing} items</span>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-[16px] text-[#3e494a]">Partial Total</span>
                  <span className="text-[22px] font-bold leading-7 text-[#191c1d]">RM{store.total.toFixed(2)}</span>
                </div>
              </div>
              <div className="border-t border-[#bec8ca] bg-[#f8f9fa] px-4 py-3">
                <span className="text-[14px] font-medium leading-5 text-[#3e494a] tracking-[0.14px]">Updated: {store.updated}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="border-t border-[#bec8ca] pt-[17px]">
          <p className="text-[14px] font-medium leading-5 text-[#3e494a] text-center tracking-[0.14px]">
            Prices may differ from in-store prices. Data sourced from PriceCatcher, last refreshed 18 Aug 2026 10:30.
          </p>
        </div>
      </div>

      {/* Breakdown modal */}
      {breakdown && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50">
          <div role="dialog" aria-modal="true" aria-labelledby="breakdown-title" className="screen-enter flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#bec8ca]">
              <h2 id="breakdown-title" className="text-[20px] font-bold text-[#191c1d]">Basket Price Breakdown</h2>
              <button aria-label="Close price breakdown" onClick={() => setBreakdown(false)} className="flex h-11 w-11 items-center justify-center text-lg font-medium text-[#3e494a]">✕</button>
            </div>
            <div className="overflow-auto flex-1 scroll-x">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="bg-[#f8f9fa] text-left border-b border-[#bec8ca]">
                    <th className="px-4 py-3 text-xs font-semibold text-[#6f797a] sticky left-0 bg-[#f8f9fa] min-w-[110px]">Item</th>
                    <th className="px-3 py-3 text-xs font-semibold text-[#6f797a] text-center">Qty</th>
                    {visibleStores.map(s => (
                      <th key={s.id} className="px-3 py-3 text-xs font-semibold text-[#6f797a] text-right min-w-[110px]">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {basket.map((item, idx) => {
                    const prices = visibleStores.map(s => {
                      const p = s.items[item.id as keyof typeof s.items];
                      return p != null ? p * item.qty : null;
                    });
                    const min = Math.min(...(prices.filter(p => p != null) as number[]));
                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}>
                        <td className={`px-4 py-3 font-medium text-[#191c1d] sticky left-0 ${idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}`}>{item.name}</td>
                        <td className="px-3 py-3 text-center text-[#3e494a]">{item.qty}</td>
                        {prices.map((p, i) => (
                          <td key={i} className="px-3 py-3 text-right">
                            {p != null ? (
                              <span className={p === min ? "font-bold text-[#286d67]" : "text-[#191c1d]"}>RM{p.toFixed(2)}</span>
                            ) : <span className="text-[#bec8ca]">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr className="bg-[#f8f9fa] border-t-2 border-[#bec8ca] font-bold">
                    <td className="px-4 py-3 text-[#191c1d] sticky left-0 bg-[#f8f9fa]">Total</td>
                    <td className="px-3 py-3" />
                    {visibleStores.map(s => (
                      <td key={s.id} className="px-3 py-3 text-right text-[#191c1d]">RM{s.total.toFixed(2)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-[#6f797a] px-4 py-3">Bold green = cheapest for that item. — = Not available.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("shop");
  const [basket, setBasket] = useState<BasketItem[]>(INIT_BASKET);
  const [preferences, setPreferences] = useState<TravelPreferences>({
    location: "Kota Bharu, Kelantan",
    transport: "moto",
    distanceKm: 5,
    saraOnly: false,
    saraCredit: 20,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    const savedPreferences = window.localStorage.getItem("smartcart-travel-preferences");
    if (!savedPreferences) return;
    try {
      setPreferences(JSON.parse(savedPreferences) as TravelPreferences);
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
