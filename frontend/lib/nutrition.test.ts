import { describe, expect, it } from "vitest";

import type { HealthierAlternative, HealthierAlternativesResult } from "./api";
import {
  alternativeCards,
  betterSide,
  improvedRows,
  insightRows,
  nutrientPreference,
  tradeOffRows,
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
    intention: { en: "a milk drink", ms: "minuman susu" },
    usage_note: { en: "Prepare according to the pack instructions.", ms: "Sediakan mengikut arahan pada pek." },
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
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "protein_g", comparison_direction: "higher_is_better" }))).toBe("higher_protein");
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "saturated_fat_g" }))).toBe("lower_saturated_fat");
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "sodium_mg" }))).toBe("lower_sodium");
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "sugars_g" }))).toBe("lower_sugar");
    expect(comparisonReasonKind(alternative({ comparison_nutrient: "energy_kcal" }))).toBe("lower_energy");
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


function withNutrients(rows: HealthierAlternative["nutrients"]): HealthierAlternative {
  return alternative({ nutrients: rows, comparison_nutrient: "fat_g" });
}

const ROW = (nutrient: string, label: string, unit: string, o: number | null, a: number | null, status: HealthierAlternative["nutrients"][number]["status"] = "comparable") =>
  ({ nutrient, label, unit, original_value: o, alternative_value: a, status });

describe("nutrientPreference", () => {
  it("compares total sugars as lower-is-better while carbohydrate stays neutral", () => {
    expect(nutrientPreference("sugars_g")).toBe("lower_is_better");
    expect(nutrientPreference("carbohydrate_g")).toBe("neutral");
    expect(betterSide(ROW("sugars_g", "Total sugars", "g", 4.54, 0))).toBe("alternative");
    expect(betterSide(ROW("sugars_g", "Total sugars", "g", 4.54, null, "unavailable"))).toBeNull();
  });
  it("treats fat, saturated fat, sodium and energy as lower-is-better", () => {
    for (const n of ["fat_g", "saturated_fat_g", "sodium_mg", "energy_kcal"]) {
      expect(nutrientPreference(n)).toBe("lower_is_better");
    }
  });

  it("treats fibre, protein and calcium as higher-is-better", () => {
    for (const n of ["fibre_g", "protein_g", "calcium_mg"]) {
      expect(nutrientPreference(n)).toBe("higher_is_better");
    }
  });

  it("marks nutrients without a defensible direction as neutral", () => {
    expect(nutrientPreference("carbohydrate_g")).toBe("neutral");
    expect(nutrientPreference("unknown_nutrient")).toBe("neutral");
  });
});

describe("betterSide", () => {
  it("credits the alternative when a lower-is-better nutrient is lower", () => {
    expect(betterSide(ROW("fat_g", "Total fat", "g", 8.9, 2.6))).toBe("alternative");
  });

  it("credits the original when the alternative is worse (AC 7.3.6)", () => {
    expect(betterSide(ROW("fat_g", "Total fat", "g", 8.9, 12.4))).toBe("original");
  });

  it("credits the alternative when a higher-is-better nutrient is higher", () => {
    expect(betterSide(ROW("fibre_g", "Dietary fibre", "g", 0.2, 0.4))).toBe("alternative");
  });

  it("makes no claim for neutral, unavailable, non-comparable or equal values", () => {
    expect(betterSide(ROW("carbohydrate_g", "Carbohydrate", "g", 52, 57))).toBeNull();
    expect(betterSide(ROW("fat_g", "Total fat", "g", null, 2.6, "unavailable"))).toBeNull();
    expect(betterSide(ROW("fat_g", "Total fat", "g", 8.9, 2.6, "non_comparable"))).toBeNull();
    expect(betterSide(ROW("fat_g", "Total fat", "g", 2.6, 2.6))).toBeNull();
  });
});

describe("insightRows", () => {
  it("exposes labelled values with units on the shared basis", () => {
    const rows = insightRows(withNutrients([ROW("fat_g", "Total fat", "g", 8.9, 2.6)]));
    expect(rows).toHaveLength(1);
    expect(rows[0].originalText).toBe("8.9 g");
    expect(rows[0].alternativeText).toBe("2.6 g");
    expect(rows[0].better).toBe("alternative");
  });

  it("keeps an unavailable value null instead of zero (AC 7.3.11)", () => {
    const rows = insightRows(withNutrients([ROW("saturated_fat_g", "Saturated fat", "g", null, 13.4, "unavailable")]));
    expect(rows[0].status).toBe("unavailable");
    expect(rows[0].originalText).toBeNull();
    expect(rows[0].originalText).not.toBe("0 g");
  });

  it("carries the non-comparable status through (AC 7.3.9)", () => {
    const rows = insightRows(withNutrients([ROW("fat_g", "Total fat", "g", 1, 2, "non_comparable")]));
    expect(rows[0].status).toBe("non_comparable");
    expect(rows[0].better).toBeNull();
  });
});

describe("tradeOffRows and improvedRows", () => {
  const rows = [
    ROW("fat_g", "Total fat", "g", 8.9, 2.6),
    ROW("saturated_fat_g", "Saturated fat", "g", 1.0, 2.0),
    ROW("carbohydrate_g", "Carbohydrate", "g", 50, 60),
  ];

  it("surfaces nutrients where the alternative is worse (AC 7.3.6)", () => {
    const tradeOffs = tradeOffRows(withNutrients(rows));
    expect(tradeOffs.map((r) => r.nutrient)).toEqual(["saturated_fat_g"]);
  });

  it("lists the nutrients the recommendation actually improves", () => {
    const improved = improvedRows(withNutrients(rows));
    expect(improved.map((r) => r.nutrient)).toEqual(["fat_g"]);
  });
});
