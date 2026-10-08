import type {
  CatalogueItemSummary,
  HealthierAlternative,
  HealthierAlternativesResult,
} from "./api";
import { localizedPackageSize } from "./package-size";

// Epic 7 — healthier alternatives (US 7.1): pure view-model helpers so the
// section states and card contents can be unit-tested without a DOM.

export type AlternativesStatus = "loading" | "ready" | "empty" | "unavailable";

// A card reason is derived from the mapped comparison, not from ad-hoc copy.
export type ComparisonReasonKind =
  | "lower_fat"
  | "higher_fibre"
  | "lower_saturated_fat"
  | "lower_sodium"
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
  if (nutrient === "saturated_fat_g" && direction === "lower_is_better")
    return "lower_saturated_fat";
  if (nutrient === "sodium_mg" && direction === "lower_is_better")
    return "lower_sodium";
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
