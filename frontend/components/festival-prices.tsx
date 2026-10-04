"use client";

import { useEffect, useMemo, useState } from "react";

import { getFestivalDetail, getFestivalItems, getFestivalTopItems, listFestivals } from "@/lib/festival-api";
import { buildChartData, chartGeometry, type FestivalChartMode } from "@/lib/festival-chart";
import type {
  FestivalDetailResponse,
  FestivalItemsResponse,
  FestivalSummary,
  FestivalTopItem,
  FestivalTopItemsResponse,
} from "@/lib/festival-contracts";
import { formatRm } from "@/lib/format-rm";
import { sortFestivalItems, type FestivalItemSort } from "@/lib/festival-items";
import type { Locale } from "@/lib/i18n";

const TEXT = {
  en: {
    eyebrow: "Festive price evidence",
    title: "Festive Prices",
    description: "See which festivals have significant price movement and review the evidence behind each alert.",
    significant: "Significant price movement",
    notSignificant: "Not significant",
    states: "states",
    selectState: "State",
    loading: "Loading festival price data…",
    error: "Festival price data is temporarily unavailable.",
    retry: "Try again",
    noFestivals: "No festival price data is available yet.",
    keyWindows: "Key time windows",
    riseWindow: "Pre-festival price change window",
    recoveryWindow: "Post-festival recovery window",
    priceChart: "Price movement around the festival",
    price: "Price",
    percent: "Percentage change",
    source: "Source",
    sampleItems: "Sample items",
    period: "Statistics period",
    method: "Method",
    unavailable: "—",
    festival: "Festival date",
    insufficient: "This festival has a limited sample and should be treated as indicative only.",
    itemsTitle: "Expected price rises",
    itemsDescription: "Every item with price data is shown with its own historical or derived estimate.",
    sortHigh: "Highest rise first",
    sortLow: "Lowest rise first",
    priceRange: "Expected price range",
    history: "History window",
    samples: "samples",
    days: "days",
    measured: "Measured",
    derived: "Estimated",
    loadingItems: "Loading item estimates…",
    noItems: "No item price estimates are available.",
    topTitle: "Top 10 historical rises",
    topDescription: "Item-level recommendations ranked by their own festival-window price change.",
    specialty: "Festival-specific item",
    currentPrice: "Current price",
    add: "Add to basket",
    added: "Added",
    addUnavailable: "Price unavailable",
    loadingTop: "Loading recommendations…",
  },
  ms: {
    eyebrow: "Bukti harga perayaan",
    title: "Harga Perayaan",
    description: "Lihat perayaan yang menunjukkan perubahan harga signifikan dan bukti di sebalik setiap amaran.",
    significant: "Perubahan harga signifikan",
    notSignificant: "Tidak signifikan",
    states: "negeri",
    selectState: "Negeri",
    loading: "Memuatkan data harga perayaan…",
    error: "Data harga perayaan tidak tersedia buat sementara.",
    retry: "Cuba lagi",
    noFestivals: "Belum ada data harga perayaan.",
    keyWindows: "Tetingkap masa utama",
    riseWindow: "Tetingkap perubahan harga sebelum perayaan",
    recoveryWindow: "Tetingkap pemulihan selepas perayaan",
    priceChart: "Pergerakan harga sekitar perayaan",
    price: "Harga",
    percent: "Perubahan peratus",
    source: "Sumber",
    sampleItems: "Item sampel",
    period: "Tempoh statistik",
    method: "Kaedah",
    unavailable: "—",
    festival: "Tarikh perayaan",
    insufficient: "Perayaan ini mempunyai sampel terhad dan hanya boleh dijadikan indikatif.",
    itemsTitle: "Anggaran kenaikan harga",
    itemsDescription: "Setiap item dengan data harga dipaparkan dengan anggaran sejarah atau terbitannya.",
    sortHigh: "Kenaikan tertinggi dahulu",
    sortLow: "Kenaikan terendah dahulu",
    priceRange: "Julat harga dijangka",
    history: "Tetingkap sejarah",
    samples: "sampel",
    days: "hari",
    measured: "Diukur",
    derived: "Dianggarkan",
    loadingItems: "Memuatkan anggaran item…",
    noItems: "Tiada anggaran harga item tersedia.",
    topTitle: "10 kenaikan sejarah tertinggi",
    topDescription: "Cadangan item disusun mengikut perubahan harga item itu sendiri dalam tetingkap perayaan.",
    specialty: "Item khusus perayaan",
    currentPrice: "Harga semasa",
    add: "Tambah ke bakul",
    added: "Ditambah",
    addUnavailable: "Harga tidak tersedia",
    loadingTop: "Memuatkan cadangan…",
  },
} as const;

function dateLabel(value: string | null, locale: Locale): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

function formatValue(value: number, mode: FestivalChartMode): string {
  return mode === "percent" ? value.toFixed(2) + "%" : "RM " + value.toFixed(2);
}

export default function FestivalPricesScreen({
  locale,
  onAddToBasket,
}: {
  locale: Locale;
  onAddToBasket: (item: FestivalTopItem) => void;
}) {
  const text = TEXT[locale];
  const [festivals, setFestivals] = useState<FestivalSummary[]>([]);
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [detail, setDetail] = useState<FestivalDetailResponse | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [chartMode, setChartMode] = useState<FestivalChartMode>("price");
  const [reloadToken, setReloadToken] = useState(0);
  // alertState will be handled by banner
  const [items, setItems] = useState<FestivalItemsResponse | null>(null);
  const [itemsStatus, setItemsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [itemSort, setItemSort] = useState<FestivalItemSort>("rise_desc");
  const [topItems, setTopItems] = useState<FestivalTopItemsResponse | null>(null);
  const [topStatus, setTopStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const festivalId = params.get("festival");
    const state = params.get("state");
    if (festivalId) setSelectedFestivalId(festivalId);
    if (state) setSelectedState(state);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setListStatus("loading");
    listFestivals(controller.signal)
      .then(payload => {
        setFestivals(payload.festivals);
        setListStatus("ready");
        const preferred = payload.festivals.find(item => item.significant) ?? payload.festivals[0];
        setSelectedFestivalId(current => current ?? preferred?.festival_id ?? null);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setListStatus("error");
      });
    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    if (!selectedFestivalId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailStatus("loading");
    getFestivalDetail(selectedFestivalId, selectedState, controller.signal)
      .then(payload => {
        setDetail(payload);
        setSelectedState(payload.selected_state);
        setDetailStatus("ready");
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetailStatus("error");
      });
    return () => controller.abort();
  }, [selectedFestivalId, selectedState]);

  useEffect(() => {
    if (!detail) {
      setItems(null);
      return;
    }
    const controller = new AbortController();
    setItemsStatus("loading");
    getFestivalItems(detail.festival_id, detail.selected_state, controller.signal)
      .then(payload => {
        setItems(payload);
        setItemsStatus("ready");
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setItemsStatus("error");
      });
    return () => controller.abort();
  }, [detail]);

  useEffect(() => {
    if (!detail?.selected.significant) {
      setTopItems(null);
      setTopStatus("ready");
      return;
    }
    const controller = new AbortController();
    setTopStatus("loading");
    getFestivalTopItems(detail.festival_id, detail.selected_state, controller.signal)
      .then(payload => {
        setTopItems(payload);
        setTopStatus("ready");
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTopStatus("error");
      });
    return () => controller.abort();
  }, [detail]);

  const chartData = useMemo(() => {
    if (!detail) return [];
    return buildChartData(
      detail.selected.daily_index,
      detail.selected.observance_start,
      detail.selected.baseline_value,
    );
  }, [detail]);
  const geometry = useMemo(
    () => chartGeometry(chartData, chartMode),
    [chartData, chartMode],
  );
  const sortedItems = useMemo(
    () => sortFestivalItems(items?.items ?? [], itemSort),
    [items, itemSort],
  );

  return (
    <div className="screen-enter px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#007d38]">{text.eyebrow}</p>
      <h1 className="mt-1 text-[30px] font-extrabold tracking-[-0.7px] text-[#10152e]">{text.title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-5 text-[#526078]">{text.description}</p>

      {listStatus === "loading" ? (
        <p className="mt-8 rounded-2xl border border-[#dce5e0] bg-white p-6 text-sm text-[#526078]">{text.loading}</p>
      ) : listStatus === "error" ? (
        <div className="mt-8 rounded-2xl border border-[#f1c7c7] bg-[#fff8f8] p-6">
          <p className="text-sm font-bold text-[#93000a]">{text.error}</p>
          <button type="button" className="secondary-button mt-3" onClick={() => setReloadToken(value => value + 1)}>{text.retry}</button>
        </div>
      ) : festivals.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[#becdc6] bg-white p-6 text-sm text-[#526078]">{text.noFestivals}</p>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <section aria-label={text.title} className="space-y-3">
            {festivals.map(festival => (
              <button
                key={festival.festival_id}
                type="button"
                aria-pressed={selectedFestivalId === festival.festival_id}
                onClick={() => {
                  setSelectedFestivalId(festival.festival_id);
                  setSelectedState(null);
                }}
                className={"w-full rounded-2xl border p-4 text-left transition " + (selectedFestivalId === festival.festival_id ? "border-[#007d38] bg-[#f1faf5] shadow-[0_8px_24px_rgba(0,125,56,0.12)]" : "border-[#dce5e0] bg-white hover:border-[#9fcab3]")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold text-[#10152e]">{locale === "en" ? festival.name_en : festival.name_ms}</p>
                    <p className="mt-1 text-xs text-[#526078]">{festival.significant_state_count}/{festival.state_count} {text.states}</p>
                  </div>
                  <span className={"rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide " + (festival.significant ? "bg-[#d9f4e5] text-[#006b31]" : "bg-[#eef1f0] text-[#526078]")}>
                    {festival.significant ? text.significant : text.notSignificant}
                  </span>
                </div>
              </button>
            ))}
          </section>

          <section className="min-w-0 rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_6px_24px_rgba(16,35,29,0.06)] sm:p-6">
            {detailStatus === "loading" ? <p className="text-sm text-[#526078]">{text.loading}</p> : null}
            {detailStatus === "error" ? <p className="text-sm font-bold text-[#93000a]">{text.error}</p> : null}
            {detail && detailStatus === "ready" ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#10152e]">{locale === "en" ? detail.name_en : detail.name_ms}</h2>
                    <p className="mt-1 text-xs text-[#526078]">{detail.dataset.source_label}</p>
                  </div>
                  <span className={"rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide " + (detail.selected.significant ? "bg-[#d9f4e5] text-[#006b31]" : "bg-[#eef1f0] text-[#526078]")}>
                    {detail.selected.significant ? text.significant : text.notSignificant}
                  </span>
                </div>

                <label className="flex flex-wrap items-center gap-3 text-sm font-bold text-[#10152e]">
                  <span>{text.selectState}</span>
                  <select
                    value={selectedState ?? detail.selected_state}
                    onChange={event => setSelectedState(event.target.value)}
                    className="min-h-11 rounded-xl border border-[#cbd8d1] bg-white px-3 text-sm font-semibold text-[#10152e]"
                  >
                    {detail.states.map(state => (
                      <option key={state.state} value={state.state}>{state.state}</option>
                    ))}
                  </select>
                </label>

                {detail.selected.insufficient_sample && detail.selected.sample_notice ? (
                  <div role="status" className="rounded-xl border border-[#f0d39a] bg-[#fff9e9] px-4 py-3 text-sm font-semibold text-[#7a4b00]">
                    {detail.selected.sample_notice[locale]}
                  </div>
                ) : null}

                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#526078]">{text.keyWindows}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#f7faf8] p-3">
                      <p className="text-[11px] font-bold text-[#526078]">{text.riseWindow}</p>
                      <p className="mt-1 text-sm font-extrabold text-[#10152e]">{dateLabel(detail.selected.rise_start, locale)} – {dateLabel(detail.selected.rise_end, locale)}</p>
                    </div>
                    <div className="rounded-xl bg-[#f7faf8] p-3">
                      <p className="text-[11px] font-bold text-[#526078]">{text.recoveryWindow}</p>
                      <p className="mt-1 text-sm font-extrabold text-[#10152e]">{dateLabel(detail.selected.recovery_start, locale)} – {dateLabel(detail.selected.recovery_end, locale)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#526078]">{text.priceChart}</h3>
                    <div className="inline-flex rounded-full border border-[#cbd8d1] bg-white p-1">
                      <button type="button" aria-pressed={chartMode === "price"} onClick={() => setChartMode("price")} className={"rounded-full px-3 py-1.5 text-xs font-bold " + (chartMode === "price" ? "bg-[#007d38] text-white" : "text-[#526078]")}>{text.price}</button>
                      <button type="button" aria-pressed={chartMode === "percent"} onClick={() => setChartMode("percent")} className={"rounded-full px-3 py-1.5 text-xs font-bold " + (chartMode === "percent" ? "bg-[#007d38] text-white" : "text-[#526078]")}>{text.percent}</button>
                    </div>
                  </div>

                  {geometry ? (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-[#edf1ef] bg-[#fbfdfc] p-2">
                      <svg role="img" aria-label={text.priceChart} viewBox="0 0 720 300" className="h-[300px] min-w-[620px] w-full">
                        {geometry.zeroX != null ? <line x1={geometry.zeroX} x2={geometry.zeroX} y1="20" y2="232" stroke="#9aa8a1" strokeDasharray="4 4" /> : null}
                        {geometry.zeroY != null ? <line x1="28" x2="692" y1={geometry.zeroY} y2={geometry.zeroY} stroke="#cbd8d1" strokeDasharray="4 4" /> : null}
                        <polyline points={geometry.points} fill="none" stroke="#007d38" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                        <text x="30" y="18" className="fill-[#526078] text-[11px]">{formatValue(geometry.maxValue, chartMode)}</text>
                        <text x="30" y="244" className="fill-[#526078] text-[11px]">{formatValue(geometry.minValue, chartMode)}</text>
                        <text x="34" y="282" className="fill-[#526078] text-[11px]">{geometry.firstRelativeDay} days</text>
                        <text x="620" y="282" className="fill-[#526078] text-[11px]">+{geometry.lastRelativeDay} days</text>
                      </svg>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-dashed border-[#becdc6] p-4 text-sm text-[#526078]">{text.unavailable}</p>
                  )}
                </div>

                <div className="border-t border-[#edf1ef] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#526078]">{text.itemsTitle}</h3>
                      <p className="mt-1 text-xs text-[#526078]">{text.itemsDescription}</p>
                    </div>
                    <button type="button" className="rounded-full border border-[#cbd8d1] px-3 py-2 text-xs font-bold text-[#007d38]" onClick={() => setItemSort(current => current === "rise_desc" ? "rise_asc" : "rise_desc")}>
                      {itemSort === "rise_desc" ? text.sortHigh : text.sortLow}
                    </button>
                  </div>
                  {itemsStatus === "loading" ? <p className="mt-3 text-sm text-[#526078]">{text.loadingItems}</p> : null}
                  {itemsStatus === "error" ? <p className="mt-3 text-sm font-bold text-[#93000a]">{text.noItems}</p> : null}
                  {itemsStatus === "ready" && sortedItems.length === 0 ? <p className="mt-3 text-sm text-[#526078]">{text.noItems}</p> : null}
                  {itemsStatus === "ready" && sortedItems.length > 0 ? (
                    <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                      {sortedItems.map(item => (
                        <article key={item.item_code} className="rounded-xl border border-[#e4ebe7] bg-[#fbfdfc] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-extrabold text-[#10152e]">{item.item_name}</p>
                              <p className="mt-0.5 text-xs text-[#526078]">{item.unit || "—"}</p>
                            </div>
                            <div className="text-right">
                              <p className={"text-base font-extrabold " + (item.data_quality === "measured" ? "text-[#007d38]" : item.data_quality === "derived" ? "text-[#9b5d00]" : "text-[#93000a]")}>
                                {item.rise_pct == null ? "—" : item.rise_pct + "%"}
                              </p>
                              <span className={"rounded-full px-2 py-1 text-[10px] font-extrabold uppercase " + (item.data_quality === "measured" ? "bg-[#d9f4e5] text-[#006b31]" : item.data_quality === "derived" ? "bg-[#fff0cc] text-[#7a4b00]" : "bg-[#f1e2e2] text-[#93000a]")}>
                                {text[item.data_quality]}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-[#526078] sm:grid-cols-2">
                            <p>{text.priceRange}: {item.price_range == null ? "—" : "RM " + item.price_range.min + " – RM " + item.price_range.max}</p>
                            <p>{text.history}: {dateLabel(item.history_start, locale)} – {dateLabel(item.history_end, locale)}</p>
                            <p>{item.observation_count} {text.samples} · {item.observed_days} {text.days}</p>
                            <p>{item.quality_label[locale]}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
                {detail.selected.significant && topStatus === "ready" && topItems && topItems.items.length > 0 ? (
                  <div className="border-t border-[#edf1ef] pt-4">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wide text-[#526078]">{text.topTitle}</h3>
                      <p className="mt-1 text-xs text-[#526078]">{text.topDescription}</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {topItems.items.map(item => {
                        const added = addedItems.has(item.item_code);
                        const canAdd = item.item_id != null && item.current_price_rm != null;
                        return (
                          <article key={item.item_code} className="rounded-xl border border-[#e4ebe7] bg-[#fbfdfc] p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-extrabold text-[#10152e]">{item.item_name}</p>
                                  {item.is_specialty ? <span className="rounded-full bg-[#e7f1ff] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#245aa8]">{text.specialty}</span> : null}
                                </div>
                                <p className="mt-0.5 text-xs text-[#526078]">{item.unit || "—"} · {text.currentPrice}: {item.current_price_rm == null ? "—" : formatRm(item.current_price_rm)}</p>
                                <p className="mt-1 text-xs text-[#526078]">{dateLabel(item.history_start, locale)} – {dateLabel(item.history_end, locale)} · {item.observation_count} {text.samples} · {item.observed_days} {text.days}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <p className="text-base font-extrabold text-[#007d38]">{item.historical_rise_pct}%</p>
                                <button type="button" disabled={!canAdd || added} onClick={() => { onAddToBasket(item); setAddedItems(current => new Set(current).add(item.item_code)); }} className="rounded-full bg-[#007d38] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-[#cbd8d1]">
                                  {added ? text.added : canAdd ? text.add : text.addUnavailable}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {detail.selected.significant && topStatus === "loading" ? <p className="mt-3 text-sm text-[#526078]">{text.loadingTop}</p> : null}
                <dl className="grid gap-3 border-t border-[#edf1ef] pt-4 text-xs sm:grid-cols-2">
                  <div><dt className="font-bold text-[#526078]">{text.source}</dt><dd className="mt-0.5 text-[#10152e]">{detail.dataset.source_label}</dd></div>
                  <div><dt className="font-bold text-[#526078]">{text.sampleItems}</dt><dd className="mt-0.5 text-[#10152e]">{detail.selected.sample_items}</dd></div>
                  <div><dt className="font-bold text-[#526078]">{text.period}</dt><dd className="mt-0.5 text-[#10152e]">{dateLabel(detail.selected.start, locale)} – {dateLabel(detail.selected.end, locale)}</dd></div>
                  <div><dt className="font-bold text-[#526078]">{text.method}</dt><dd className="mt-0.5 text-[#10152e]">{detail.selected.method_version} / {detail.selected.window_method_version}</dd></div>
                </dl>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
