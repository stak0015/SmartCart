"use client";

import type { ItemNutritionResult } from "@/lib/api";

const NUTRIENT_LABELS: Record<string, { en: string; ms: string; unit: string }> = {
  energy_kcal: { en: "Energy", ms: "Tenaga", unit: "kcal" },
  protein_g: { en: "Protein", ms: "Protein", unit: "g" },
  fat_g: { en: "Total fat", ms: "Jumlah lemak", unit: "g" },
  saturated_fat_g: { en: "Saturated fat", ms: "Lemak tepu", unit: "g" },
  carbohydrate_g: { en: "Carbohydrate", ms: "Karbohidrat", unit: "g" },
  fibre_g: { en: "Fibre", ms: "Serat", unit: "g" },
  sugars_g: { en: "Sugars", ms: "Gula", unit: "g" },
  monounsaturated_fat_g: { en: "Monounsaturated fat", ms: "Lemak monotaktepu", unit: "g" },
  polyunsaturated_fat_g: { en: "Polyunsaturated fat", ms: "Lemak politaktepu", unit: "g" },
  sodium_mg: { en: "Sodium", ms: "Natrium", unit: "mg" },
  calcium_mg: { en: "Calcium", ms: "Kalsium", unit: "mg" },
  iron_mg: { en: "Iron", ms: "Zat besi", unit: "mg" },
  phosphorus_mg: { en: "Phosphorus", ms: "Fosforus", unit: "mg" },
  potassium_mg: { en: "Potassium", ms: "Kalium", unit: "mg" },
};

const NUTRIENT_ORDER = Object.keys(NUTRIENT_LABELS);

export function nutritionBasisLabel(basis: string | null | undefined, locale: "en" | "ms"): string {
  const normalized = (basis ?? "").toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("100ml")) return locale === "en" ? "Per 100 mL" : "Setiap 100 mL";
  return locale === "en" ? "Per 100 g" : "Setiap 100 g";
}

export function nutritionValueLabel(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "-";
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}

function nutrientLabel(key: string, locale: "en" | "ms"): { label: string; unit: string } {
  const known = NUTRIENT_LABELS[key];
  if (known) return { label: known[locale], unit: known.unit };
  return { label: key.replace(/_/g, " "), unit: "" };
}

export function ItemNutritionSection({
  loading,
  result,
  error,
  locale,
}: {
  loading: boolean;
  result: ItemNutritionResult | null;
  error: unknown;
  locale: "en" | "ms";
}) {
  const english = locale === "en";
  const hasError = Boolean(error);
  return (
    <section className="item-nutrition" aria-label={english ? "Nutrition information" : "Maklumat pemakanan"}>
      {loading && <p role="status">{english ? "Loading nutrition information…" : "Memuatkan maklumat pemakanan…"}</p>}
      {!loading && hasError && <p role="alert">{english ? "Nutrition information is unavailable right now." : "Maklumat pemakanan tidak tersedia buat masa ini."}</p>}
      {!loading && !hasError && result && !result.available && (
        <p>{english ? "No reviewed nutrition match is available for this item." : "Tiada padanan pemakanan yang disemak untuk item ini."}</p>
      )}
      {!loading && !hasError && result?.available && result.food && (
        <>
          <p className="item-nutrition-basis">{nutritionBasisLabel(result.food.basis, locale)}</p>
          {result.match_type === "generic" && (
            <p className="item-nutrition-disclosure">
              {english
                ? "Generic food reference — values may differ from this exact product."
                : "Rujukan makanan generik — nilai mungkin berbeza daripada produk sebenar ini."}
            </p>
          )}
          <dl className="item-nutrition-values">
            {[...NUTRIENT_ORDER, ...Object.keys(result.food.nutrients).filter(key => !NUTRIENT_ORDER.includes(key))].map(key => {
              const { label, unit } = nutrientLabel(key, locale);
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{nutritionValueLabel(result.food!.nutrients[key], unit)}</dd>
                </div>
              );
            })}
          </dl>
          {result.rationale && <p className="item-nutrition-rationale">{result.rationale}</p>}
          <dl className="item-nutrition-source">
            <dt>{english ? "Reference food" : "Makanan rujukan"}</dt>
            <dd>
              <a href={result.food.url || result.source?.url || undefined} target="_blank" rel="noreferrer">
                {result.food.description}
              </a>
              {result.food.source_code && <span> · {english ? "record" : "rekod"} {result.food.source_code}</span>}
              {result.food.source_edition && <span> · {result.food.source_edition}</span>}
            </dd>
            <dt>{english ? "Source" : "Sumber"}</dt>
            <dd>
              <a href={result.source?.url} target="_blank" rel="noreferrer">{result.source?.name}</a>
              {result.source?.license && <span> · {result.source.license}</span>}
            </dd>
          </dl>
          {(result.food.carbohydrate_definition || result.source?.carbohydrate_definition) && (
            <dl className="item-nutrition-definition">
              <dt>{english ? "Data definitions" : "Takrif data"}</dt>
              {(result.food.carbohydrate_definition || result.source?.carbohydrate_definition) && (
                <dd>{english ? "Carbohydrate: " : "Karbohidrat: "}
                  {result.food.carbohydrate_definition || result.source?.carbohydrate_definition}
                </dd>
              )}
            </dl>
          )}
        </>
      )}
    </section>
  );
}
