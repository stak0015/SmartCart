import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemNutritionSection, nutritionBasisLabel, nutritionValueLabel } from "./item-nutrition";
import type { ItemNutritionResult } from "@/lib/api";

const result: ItemNutritionResult = {
  item_code: "007",
  available: true,
  match_type: "generic",
  rationale: "Matched to a cooked rice reference.",
  source: {
    id: "fdc",
    name: "FoodData Central",
    url: "https://fdc.nal.usda.gov/",
    license: "USDA public data",
  },
  food: {
    id: "fdc-1",
    source_code: "123",
    description: "Generic rice, cooked",
    basis: "per_100g",
    url: "https://fdc.nal.usda.gov/food-details/123",
    carbohydrate_definition: "Available carbohydrate",
    energy_conversion: "publisher kJ divided by 4.184",
    nutrients: { energy_kcal: 130, protein_g: null },
  },
};

describe("item nutrition display", () => {
  it("labels the reference basis, source, generic match and missing values", () => {
    const markup = renderToStaticMarkup(createElement(ItemNutritionSection, {
      loading: false,
      result,
      error: null,
      locale: "en",
    }));

    expect(markup).toContain("Nutrition information");
    expect(markup).toContain("Per 100 g");
    expect(markup).toContain("Generic food reference");
    expect(markup).toContain("130 kcal");
    expect(markup).toContain("<dd>-</dd>");
    expect(markup).not.toContain("Unavailable");
    expect(markup).toContain("FoodData Central");
    expect(markup).toContain("https://fdc.nal.usda.gov/");
    expect(markup).toContain("Generic rice, cooked");
    expect(markup).toContain("record 123");
    expect(markup).toContain("https://fdc.nal.usda.gov/food-details/123");
    expect(markup).toContain("Available carbohydrate");
    expect(markup).not.toContain("publisher kJ divided by 4.184");
  });

  it("keeps an item without a reviewed match visibly unavailable", () => {
    const markup = renderToStaticMarkup(createElement(ItemNutritionSection, {
      loading: false,
      result: { ...result, available: false, food: null, source: null },
      error: null,
      locale: "ms",
    }));
    expect(markup).toContain("Tiada padanan pemakanan yang disemak");
    expect(markup).not.toContain("Tidak tersedia");
  });

  it("supports gram and millilitre bases without treating absent values as zero", () => {
    expect(nutritionBasisLabel("per_100ml", "en")).toBe("Per 100 mL");
    expect(nutritionBasisLabel("per_100g", "ms")).toBe("Setiap 100 g");
    expect(nutritionValueLabel(null, "g")).toBe("-");
    expect(nutritionValueLabel(undefined, "g")).toBe("-");
    expect(nutritionValueLabel(0, "g")).toBe("0 g");
  });
});
