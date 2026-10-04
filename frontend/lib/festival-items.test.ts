import { describe, expect, it } from "vitest";

import { festivalTopItemToBasketItem, sortFestivalItems } from "./festival-items";

const base = {
  item_code: "A",
  item_name: "A",
  unit: "1kg",
  source_category: "",
  broad_category_id: "other",
  broad_category_label_en: "Other",
  broad_category_label_ms: "Other",
  quality_label: { en: "", ms: "", zh: "" },
  baseline_price: null,
  peak_price: null,
  price_range: null,
  history_start: null,
  history_end: null,
  observation_count: 0,
  observed_days: 0,
  sample_status: "full",
} as const;

describe("festival item sorting", () => {
  it("sorts high to low and places unavailable items last", () => {
    const items = [
      { ...base, item_code: "A", item_name: "A", data_quality: "measured" as const, rise_pct: "10" },
      { ...base, item_code: "B", item_name: "B", data_quality: "measured" as const, rise_pct: "20" },
      { ...base, item_code: "C", item_name: "C", data_quality: "unavailable" as const, rise_pct: null },
    ];
    expect(sortFestivalItems(items, "rise_desc").map(item => item.item_code)).toEqual(["B", "A", "C"]);
  });

  it("sorts low to high", () => {
    const items = [
      { ...base, item_code: "A", item_name: "A", data_quality: "measured" as const, rise_pct: "10" },
      { ...base, item_code: "B", item_name: "B", data_quality: "measured" as const, rise_pct: "20" },
    ];
    expect(sortFestivalItems(items, "rise_asc").map(item => item.item_code)).toEqual(["A", "B"]);
  });
});

describe("festival top item basket conversion", () => {
  it("maps catalogue fields into the existing basket line", () => {
    const item = {
      item_id: "101",
      item_code: "A",
      item_name: "Item A",
      item_name_en: "Item A",
      item_name_ms: "Item A",
      unit: "1kg",
      package_size: "1kg",
      category: { id: "protein" as const, labelEn: "Protein", labelMs: "Protein", spendingClass: "essential" as const },
      source_category: { id: "AYAM", labelEn: "AYAM", labelMs: "AYAM" },
      image_url: null,
      sara_eligible: true,
      sara_category_candidate: false,
      current_price_rm: 10,
      historical_rise_pct: "20.00",
      historical_price_range: { min: "10.00", max: "12.00" },
      history_start: "2026-01-01",
      history_end: "2026-01-10",
      observation_count: 120,
      observed_days: 10,
      sample_status: "full",
      is_specialty: true,
      specialty_id: "new-year-favourite",
      specialty_name_en: "New year favourite",
      specialty_name_zh: "新年特色商品",
    };
    expect(festivalTopItemToBasketItem(item)).toMatchObject({
      id: "db-101",
      name: "Item A",
      size: "1kg",
      qty: 1,
      saraEligible: true,
      category: { id: "protein" },
    });
  });

  it("refuses recommendations without a catalogue id", () => {
    expect(() => festivalTopItemToBasketItem({ item_id: null, item_name: "Item A" } as never)).toThrow();
  });
});
