import { describe, expect, it } from "vitest";

import type { HealthierAlternative, HealthierAlternativesResult } from "./api";
import {
  alternativeCards,
  alternativesStatus,
  comparisonReasonKind,
  formatNutrientValue,
  localizedAlternativeName,
} from "./nutrition";

function alternative(overrides: Partial<HealthierAlternative> = {}): HealthierAlternative {
  return {
    item: {
      item_id: 345,
      item_code: "345",
      item_name: "SUSU TEPUNG ISIAN KURANG LEMAK",
      item_name_en: "Low-fat milk powder",
      item_name_ms: "Susu tepung kurang lemak",
      unit: "600 g",
      item_category: "KRIMER DAN SUSU TEPUNG",
      package_size: "600 g",
      image_url: null,
      sara_eligible: null,
      sara_category_candidate: false,
      category: null,
      source_category: null,
    },
    rule: "H1",
    headline: "Lower total fat per 100 g",
    comparison_nutrient: "fat_g",
    comparison_direction: "lower_is_better",
    original_source: { dataset: "MyFCD-1997", dataset_name: "MyFCD 1997", record_code: "111015", description: "Condensed milk", basis: "per_100g" },
    alternative_source: { dataset: "MyFCD-1997", dataset_name: "MyFCD 1997", record_code: "111013", description: "Skim milk powder", basis: "per_100g" },
    generic_mapping: false,
    nutrients: [],
    ...overrides,
  };
}

function result(alternatives: HealthierAlternative[]): HealthierAlternativesResult {
  return { item_code: "883", count: alternatives.length, alternatives };
}

describe("alternativesStatus", () => {
  it("reports loading while the request is in flight", () => {
    expect(alternativesStatus(true, null, null)).toBe("loading");
  });

  it("reports unavailable when the request fails (AC 7.1.5)", () => {
    expect(alternativesStatus(false, null, new Error("boom"))).toBe("unavailable");
  });

  it("reports empty when no approved alternative exists (AC 7.1.4)", () => {
    expect(alternativesStatus(false, result([]), null)).toBe("empty");
    expect(alternativesStatus(false, null, null)).toBe("empty");
  });

  it("reports ready when alternatives are returned", () => {
    expect(alternativesStatus(false, result([alternative()]), null)).toBe("ready");
  });
});

describe("comparisonReasonKind", () => {
  it("maps the headline comparison to a localisable reason", () => {
    expect(comparisonReasonKind(alternative())).toBe("lower_fat");
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "fibre_g", comparison_direction: "higher_is_better" }))).toBe("higher_fibre");
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "saturated_fat_g" }))).toBe("lower_saturated_fat");
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "sodium_mg" }))).toBe("lower_sodium");
  });

  it("falls back to other for an unmapped nutrient", () => {
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "calcium_mg", comparison_direction: "higher_is_better" }))).toBe("other");
  });
});

describe("alternativeCards", () => {
  it("uses the localised name and package size", () => {
    const [english] = alternativeCards(result([alternative()]), "en");
    expect(english.name).toBe("LOW-FAT MILK POWDER");
    expect(english.packageSize).toBe("600 g");
    expect(english.itemCode).toBe("345");
    expect(english.reason).toBe("lower_fat");
  });

  it("prefers the Malay name for the ms locale", () => {
    const [malay] = alternativeCards(result([alternative()]), "ms");
    expect(malay.name).toBe("SUSU TEPUNG KURANG LEMAK".toLocaleUpperCase("ms-MY"));
  });

  it("falls back to the original catalogue name when no translation exists", () => {
    const item = { ...alternative().item, item_name_en: null, item_name_ms: null };
    const [card] = alternativeCards(result([alternative({ item })]), "en");
    expect(card.name).toBe(item.item_name.toLocaleUpperCase("en-MY"));
  });
});

describe("localizedAlternativeName", () => {
  it("keeps the catalogue name when translations are missing", () => {
    const name = localizedAlternativeName({ ...alternative().item, item_name_en: null }, "en");
    expect(name).toBe("SUSU TEPUNG ISIAN KURANG LEMAK");
  });
});

describe("formatNutrientValue", () => {
  it("returns null for an unavailable value so it is never shown as zero (AC 7.3.11)", () => {
    expect(formatNutrientValue(null, "g")).toBeNull();
  });

  it("renders a real zero as zero", () => {
    expect(formatNutrientValue(0, "g")).toBe("0 g");
  });

  it("labels the unit and rounds to two decimals", () => {
    expect(formatNutrientValue(2.555, "mg")).toBe("2.56 mg");
  });
});
