import type {
  CatalogueItemSummary,
  HealthierAlternative,
  HealthierAlternativesResult,
  NutrientComparison,
} from "./api";
import { localizedPackageSize } from "./package-size";

// Epic 7 — healthier alternatives (US 7.1): pure view-model helpers so the
// section states and card contents can be unit-tested without a DOM.

export type AlternativesStatus = "loading" | "ready" | "empty" | "unavailable";

// A card reason is derived from the mapped comparison, not from ad-hoc copy.
export type ComparisonReasonKind =
  | "lower_fat"
  | "higher_fibre"
  | "higher_protein"
  | "lower_saturated_fat"
  | "lower_sodium"
  | "lower_sugar"
  | "lower_energy"
  | "other";

export interface AlternativeCard {
  itemCode: string;
  name: string;
  packageSize: string | null;
  reason: ComparisonReasonKind;
  alternative: HealthierAlternative;
}

export function localizedAlternativeName(
  item: CatalogueItemSummary,
  locale: "en" | "ms",
): string {
  const localized =
    (locale === "ms" ? item.item_name_ms : item.item_name_en) || item.item_name;
  return localized.toLocaleUpperCase(locale === "ms" ? "ms-MY" : "en-MY");
}

export function comparisonReasonKind(
  alternative: HealthierAlternative,
): ComparisonReasonKind {
  const { comparison_nutrient: nutrient, comparison_direction: direction } =
    alternative;
  if (nutrient === "fat_g" && direction === "lower_is_better") return "lower_fat";
  if (nutrient === "fibre_g" && direction === "higher_is_better")
    return "higher_fibre";
  if (nutrient === "protein_g" && direction === "higher_is_better")
    return "higher_protein";
  if (nutrient === "saturated_fat_g" && direction === "lower_is_better")
    return "lower_saturated_fat";
  if (nutrient === "sodium_mg" && direction === "lower_is_better")
    return "lower_sodium";
  if (nutrient === "sugars_g" && direction === "lower_is_better")
    return "lower_sugar";
  if (nutrient === "energy_kcal" && direction === "lower_is_better")
    return "lower_energy";
  return "other";
}

export function alternativeCards(
  result: HealthierAlternativesResult,
  locale: "en" | "ms",
): AlternativeCard[] {
  return result.alternatives.map((alternative) => ({
    itemCode: alternative.item.item_code,
    name: localizedAlternativeName(alternative.item, locale),
    packageSize: localizedPackageSize(alternative.item.package_size, locale),
    reason: comparisonReasonKind(alternative),
    alternative,
  }));
}

/**
 * AC 7.1.4 / 7.1.5: no alternatives and a failed request are different
 * states, and both leave the item details and Add control usable.
 */
export function alternativesStatus(
  loading: boolean,
  result: HealthierAlternativesResult | null,
  error: unknown,
): AlternativesStatus {
  if (loading) return "loading";
  if (error) return "unavailable";
  if (!result || result.count === 0 || result.alternatives.length === 0)
    return "empty";
  return "ready";
}

// AC 7.3.9 / 7.3.11: unavailable values are never rendered as zero.
export function formatNutrientValue(value: number | null, unit: string): string | null {
  if (value === null || value === undefined) return null;
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}

// ---------------------------------------------------------------------------
// US 7.3 — "Why this alternative?" nutrient comparison.
// ---------------------------------------------------------------------------

export type NutrientPreference = "lower_is_better" | "higher_is_better" | "neutral";

// Which direction counts as better for each tracked nutrient. Nutrients
// without a defensible direction are marked neutral and never used to
// claim an improvement (AC 7.3.6).
const NUTRIENT_PREFERENCE: Record<string, NutrientPreference> = {
  energy_kcal: "lower_is_better",
  protein_g: "higher_is_better",
  fat_g: "lower_is_better",
  saturated_fat_g: "lower_is_better",
  carbohydrate_g: "neutral",
  sugars_g: "lower_is_better",
  fibre_g: "higher_is_better",
  sodium_mg: "lower_is_better",
  calcium_mg: "higher_is_better",
};

export type BetterSide = "original" | "alternative" | null;

export interface InsightRow {
  nutrient: string;
  label: string;
  unit: string;
  status: NutrientComparison["status"];
  originalText: string | null;
  alternativeText: string | null;
  better: BetterSide;
}

export function nutrientPreference(nutrient: string): NutrientPreference {
  return NUTRIENT_PREFERENCE[nutrient] ?? "neutral";
}

/** Which side is better on this row, or null when it cannot be claimed. */
export function betterSide(row: NutrientComparison): BetterSide {
  if (row.status !== "comparable") return null;
  if (row.original_value === null || row.alternative_value === null) return null;
  const preference = nutrientPreference(row.nutrient);
  if (preference === "neutral") return null;
  if (row.original_value === row.alternative_value) return null;
  const alternativeIsLower = row.alternative_value < row.original_value;
  if (preference === "lower_is_better") {
    return alternativeIsLower ? "alternative" : "original";
  }
  return alternativeIsLower ? "original" : "alternative";
}

/** Display rows for the inline comparison (AC 7.3.3/7.3.4/7.3.11). */
export function insightRows(alternative: HealthierAlternative): InsightRow[] {
  return alternative.nutrients.map((row) => ({
    nutrient: row.nutrient,
    label: row.label,
    unit: row.unit,
    status: row.status,
    originalText: formatNutrientValue(row.original_value, row.unit),
    alternativeText: formatNutrientValue(row.alternative_value, row.unit),
    better: betterSide(row),
  }));
}

/**
 * Nutrients where the alternative is worse than the original (AC 7.3.6).
 * The comparison must never imply the alternative improves everything.
 */
export function tradeOffRows(alternative: HealthierAlternative): InsightRow[] {
  return insightRows(alternative).filter((row) => row.better === "original");
}

/** Rows the recommendation actually improves, for the supporting summary. */
export function improvedRows(alternative: HealthierAlternative): InsightRow[] {
  return insightRows(alternative).filter((row) => row.better === "alternative");
}
