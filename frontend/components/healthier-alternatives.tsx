"use client";

import type { ReactNode } from "react";
import { UIIcon } from "./ui-icon";

import type {
  CatalogueItemSummary,
  HealthierAlternative,
  HealthierAlternativesResult,
} from "@/lib/api";
import type { AppCopy } from "@/lib/i18n";
import {
  alternativeCards,
  alternativesStatus,
  insightRows,
  tradeOffRows,
  type AlternativeCard,
  type ComparisonReasonKind,
  type InsightRow,
} from "@/lib/nutrition";
import { CatalogueItemImage } from "./catalogue-item-image";

// Epic 7 (US 7.1/7.3) — the "Healthier alternatives" section inside the item
// dialog, plus the inline "Why this alternative?" comparison. It sits below
// the item details and never blocks the item's own quantity or Add controls.

const REASON_COPY: Record<ComparisonReasonKind, "healthierReasonLowerFat" | "healthierReasonHigherFibre" | "healthierReasonHigherProtein" | "healthierReasonLowerSaturatedFat" | "healthierReasonLowerSodium" | "healthierReasonLowerSugar" | "healthierReasonLowerEnergy" | null> = {
  lower_fat: "healthierReasonLowerFat",
  higher_fibre: "healthierReasonHigherFibre",
  higher_protein: "healthierReasonHigherProtein",
  lower_saturated_fat: "healthierReasonLowerSaturatedFat",
  lower_sodium: "healthierReasonLowerSodium",
  lower_sugar: "healthierReasonLowerSugar",
  lower_energy: "healthierReasonLowerEnergy",
  other: null,
};

export function reasonText(card: AlternativeCard, copy: AppCopy): string {
  const key = REASON_COPY[card.reason];
  if (!key) return card.alternative.headline;
  return copy[key];
}

function basisText(alternative: HealthierAlternative, copy: AppCopy): string {
  const label =
    alternative.original_source.basis === "per_100ml"
      ? copy.insightBasisPer100ml
      : copy.insightBasisPer100g;
  return copy.insightBasis(label);
}

// AC 7.3.9 / 7.3.11: an absent or incompatible value is labelled, never zero.
function statusText(row: InsightRow, copy: AppCopy): string | null {
  if (row.status === "comparable") return null;
  if (row.status === "non_comparable") return copy.insightNonComparable;
  return copy.insightUnavailable;
}

function valueText(row: InsightRow, value: string | null, copy: AppCopy): string {
  return value ?? statusText(row, copy) ?? copy.insightUnavailable;
}

export function HealthierInsightPanel({
  alternative,
  originalName,
  alternativeName,
  locale,
  copy,
  reason,
}: {
  reason: string;
  alternative: HealthierAlternative;
  originalName: string;
  alternativeName: string;
  locale: "en" | "ms";
  copy: AppCopy;
}) {
  const allRows = insightRows(alternative);
  const rows = allRows.filter(row => row.nutrient === alternative.comparison_nutrient);
  // AC 7.3.6: another tracked nutrient may be worse for the alternative.
  const tradeOffs = tradeOffRows(alternative).slice(0, 2);
  rows.push(...tradeOffs.filter(row => !rows.some(primary => primary.nutrient === row.nutrient)));
  const hasComparable = rows.some((row) => row.status === "comparable");

  return (
    <div className="healthier-insight">
      <p className="healthier-insight-pair">
        <strong>{originalName}</strong> → <strong>{alternativeName}</strong>
      </p>
      <p className="healthier-insight-reason">{reason}</p>
      <p className="healthier-insight-basis">{basisText(alternative, copy)}</p>

      {!hasComparable && <p>{copy.insightNoComparableValues}</p>}
      {hasComparable && (
        <table className="healthier-insight-table">
          <thead>
            <tr>
              <th scope="col">&nbsp;</th>
              <th scope="col">{copy.insightOriginalLabel}</th>
              <th scope="col">{copy.insightAlternativeLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.nutrient} data-status={row.status}>
                <th scope="row">{row.label}</th>
                <td>{valueText(row, row.originalText, copy)}</td>
                <td>{valueText(row, row.alternativeText, copy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tradeOffs.length > 0 && (
        <p className="healthier-insight-tradeoff">
          {copy.insightTradeOff(tradeOffs.map((row) => row.label).join(", "))}
        </p>
      )}
      {alternative.generic_mapping && <p className="healthier-insight-generic">{locale === "en" ? "Generic references; actual products may differ." : "Rujukan generik; produk sebenar mungkin berbeza."}</p>}
      <details className="healthier-insight-more"><summary>{locale === "en" ? "Usage & sources" : "Penggunaan & sumber"}</summary>
      {!!alternative.missing_guard_nutrients?.length && <p>{locale === 'en' ? 'Some secondary nutrient comparisons are unavailable.' : 'Sesetengah perbandingan nutrien sekunder tidak tersedia.'}</p>}
      <p>{copy.healthierIntention(alternative.intention[locale])}</p>
      <p>{alternative.usage_note[locale]}</p>
      <p>{copy.insightReferenceComparison}</p>
      <dl className="healthier-insight-sources">
        <dt>{copy.insightSources}</dt>
        <dd>
          {alternative.original_source.dataset_name} ·{" "}
          {alternative.original_source.record_code} ·{" "}
          {alternative.original_source.description}
        </dd>
        <dd>
          {alternative.alternative_source.dataset_name} ·{" "}
          {alternative.alternative_source.record_code} ·{" "}
          {alternative.alternative_source.description}
        </dd>
      </dl>
      </details>
    </div>
  );
}

export function HealthierAlternativesSection({
  loading,
  result,
  error,
  locale,
  copy,
  originalName,
  onOpenItem,
  onOpenInsights,
}: {
  loading: boolean;
  result: HealthierAlternativesResult | null;
  error: unknown;
  locale: "en" | "ms";
  copy: AppCopy;
  // Name of the item currently open, used to identify both sides (AC 7.3.3).
  originalName: string;
  onOpenItem?: (item: CatalogueItemSummary) => void;
  onOpenInsights?: (panel: ReactNode) => void;
}) {
  const status = alternativesStatus(loading, result, error);
  const cards = result ? alternativeCards(result, locale) : [];
  if (status !== 'ready' || cards.length === 0) return null;

  return (
    <section className="healthier-alternatives" aria-labelledby="healthier-alternatives-title">
      <h3 id="healthier-alternatives-title">{copy.healthierAlternativesTitle}</h3>
      {status === "ready" && (
        <>
          <ul className="healthier-alternatives-list">
            {cards.map((card) => (
              <li key={card.itemCode} className="healthier-alternative-card">
                <button
                  type="button"
                  className="healthier-alternative-main"
                  onClick={() => onOpenItem?.(card.alternative.item)}
                >
                  <span className="healthier-alternative-visual" aria-hidden="true">
                    <CatalogueItemImage imageUrl={card.alternative.item.image_url} fallbackSize={32} />
                  </span>
                  <span className="healthier-alternative-text">
                    <strong>{card.name}</strong>
                    <em>{reasonText(card, copy)}</em>
                  </span>
                </button>
                <button
                  type="button"
                  className="healthier-insight-toggle"
                  aria-label={`${copy.whyThisAlternative}: ${card.name}`}
                  title={copy.whyThisAlternative}
                  aria-controls="catalogue-alternative-insights"
                  onClick={() => onOpenInsights?.(<HealthierInsightPanel alternative={card.alternative} originalName={originalName} alternativeName={card.name} locale={locale} copy={copy} reason={reasonText(card, copy)}/>)}
                >
                  <UIIcon name="lightbulb" size={20}/>

                </button>
              </li>
            ))}
          </ul>

        </>
      )}
    </section>
  );
}
