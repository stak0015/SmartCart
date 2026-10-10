import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { HealthierAlternative } from "@/lib/api";
import { COPY } from "@/lib/i18n";
import { HealthierAlternativesSection, HealthierInsightPanel } from "./healthier-alternatives";

const alternative: HealthierAlternative = {
  item: {
    item_id: 1476, item_code: "1476", item_name: "IKAN KEMBUNG",
    item_name_en: "Indian mackerel", item_name_ms: "Ikan kembung",
    unit: "1 kg", item_category: null, package_size: "1 kg", image_url: null,
    sara_eligible: null, sara_category_candidate: false, category: null, source_category: null,
  },
  rule: "H8", headline: "Lower total fat per 100 g",
  intention: { en: "the main protein in a cooked meal", ms: "protein utama dalam hidangan yang dimasak" },
  usage_note: { en: "Cook fish instead of the meat course; adjust cooking time.", ms: "Masak ikan sebagai ganti lauk daging; sesuaikan masa memasak." },
  comparison_nutrient: "fat_g", comparison_direction: "lower_is_better",
  original_source: { dataset: "USDA-FDC", dataset_name: "USDA", record_code: "171776", description: "Beef", basis: "per_100g" },
  alternative_source: { dataset: "MyFCD-1997", dataset_name: "MyFCD", record_code: "110053", description: "Indian mackerel", basis: "per_100g" },
  generic_mapping: true, nutrients: [],
};

describe("intention-based alternatives", () => {
  it.each(["en", "ms"] as const)("localises the peanut protein reason in %s", (locale) => {
    const markup = renderToStaticMarkup(createElement(HealthierAlternativesSection, {
      loading: false,
      result: { item_code: "9", count: 1, alternatives: [{ ...alternative, comparison_nutrient: "protein_g", comparison_direction: "higher_is_better" }] },
      error: null, locale, copy: COPY[locale], originalName: "Original",
    }));
    expect(markup).toContain(COPY[locale].healthierReasonHigherProtein);
  });
  it.each(["en", "ms"] as const)("localises sugar and energy reasons in %s", (locale) => {
    for (const [nutrient, expected] of [
      ["sugars_g", COPY[locale].healthierReasonLowerSugar],
      ["energy_kcal", COPY[locale].healthierReasonLowerEnergy],
    ]) {
      const markup = renderToStaticMarkup(createElement(HealthierAlternativesSection, {
        loading: false,
        result: { item_code: "9", count: 1, alternatives: [{ ...alternative, comparison_nutrient: nutrient }] },
        error: null, locale, copy: COPY[locale], originalName: "Original",
      }));
      expect(markup).toContain(expected);
    }
  });
  it.each(["en", "ms"] as const)("keeps cards minimal with labelled insight controls in %s", (locale) => {
    const markup = renderToStaticMarkup(createElement(HealthierAlternativesSection, {
      loading: false, result: { item_code: "9", count: 1, alternatives: [alternative] },
      error: null, locale, copy: COPY[locale], originalName: "Beef",
    }));
    expect(markup).not.toContain(COPY[locale].healthierIntention(alternative.intention[locale]));
    expect(markup).not.toContain(alternative.usage_note[locale]);
    expect(markup).toContain(COPY[locale].healthierReasonLowerFat);
    expect(markup).toContain(COPY[locale].whyThisAlternative);
    expect(markup).toContain(locale === "en" ? "INDIAN MACKEREL" : "IKAN KEMBUNG");
  });
});


it("shows only the main comparison and important trade-offs in insights", () => {
  const nutrients = [
    { nutrient: "fat_g", label: "Total fat", unit: "g", original_value: 20, alternative_value: 5, status: "comparable" as const },
    { nutrient: "sodium_mg", label: "Sodium", unit: "mg", original_value: 20, alternative_value: 30, status: "comparable" as const },
    { nutrient: "calcium_mg", label: "Calcium", unit: "mg", original_value: 20, alternative_value: 40, status: "comparable" as const },
  ];
  const markup = renderToStaticMarkup(createElement(HealthierInsightPanel, {
    alternative: { ...alternative, nutrients }, originalName: "Beef", alternativeName: "Fish", locale: "en", copy: COPY.en, reason: "Lower fat",
  }));
  expect(markup).toContain("20 g");
  expect(markup).toContain("5 g");
  expect(markup).toContain("Sodium");
  expect(markup).not.toContain("Calcium");
  expect(markup).toContain("<details");
  expect(markup).toContain("Usage &amp; sources");
});


it("hides alternatives while loading, unavailable or empty", () => {
  for (const state of [{ loading: true, result: null, error: null }, { loading: false, result: null, error: true }, { loading: false, result: { item_code: "9", count: 0, alternatives: [] }, error: null }]) {
    expect(renderToStaticMarkup(createElement(HealthierAlternativesSection, { ...state, locale: "en", copy: COPY.en, originalName: "Original" }))).toBe("");
  }
});
