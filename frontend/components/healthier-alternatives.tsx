"use client";

import { useState } from "react";

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

const REASON_COPY: Record<ComparisonReasonKind, "healthierReasonLowerFat" | "healthierReasonHigherFibre" | "healthierReasonLowerSaturatedFat" | "healthierReasonLowerSodium" | null> = {
  lower_fat: "healthierReasonLowerFat",
  higher_fibre: "healthierReasonHigherFibre",
  lower_saturated_fat: "healthierReasonLowerSaturatedFat",
  lower_sodium: "healthierReasonLowerSodium",
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

function InsightPanel({
  alternative,
  originalName,
  alternativeName,
  copy,
}: {
  alternative: HealthierAlternative;
  originalName: string;
  alternativeName: string;
  copy: AppCopy;
}) {
  const rows = insightRows(alternative);
  // AC 7.3.6: another tracked nutrient may be worse for the alternative.
  const tradeOffs = tradeOffRows(alternative);
  const hasComparable = rows.some((row) => row.status === "comparable");

  return (
    <div className="healthier-insight">
      <p className="healthier-insight-pair">
        <strong>{originalName}</strong> → <strong>{alternativeName}</strong>
      </p>
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
      {alternative.generic_mapping && (
        <p className="healthier-insight-generic">{copy.insightGenericMapping}</p>
      )}
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
}: {
  loading: boolean;
  result: HealthierAlternativesResult | null;
  error: unknown;
  locale: "en" | "ms";
  copy: AppCopy;
  // Name of the item currently open, used to identify both sides (AC 7.3.3).
  originalName: string;
  onOpenItem?: (item: CatalogueItemSummary) => void;
}) {
  const status = alternativesStatus(loading, result, error);
  const cards = result ? alternativeCards(result, locale) : [];
  // AC 7.3.1/7.3.7: which alternative's insight is open, if any.
  const [openInsight, setOpenInsight] = useState<string | null>(null);
  const openCard = cards.find((card) => card.itemCode === openInsight) ?? null;

  return (
    <section className="healthier-alternatives" aria-labelledby="healthier-alternatives-title">
      <h3 id="healthier-alternatives-title">{copy.healthierAlternativesTitle}</h3>
      {status === "loading" && <p role="status">{copy.healthierAlternativesLoading}</p>}
      {status === "empty" && <p>{copy.healthierAlternativesEmpty}</p>}
      {status === "unavailable" && (
        <p role="alert">{copy.healthierAlternativesUnavailable}</p>
      )}
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
                    {card.packageSize && <small>{card.packageSize}</small>}
                    <em>{reasonText(card, copy)}</em>
                  </span>
                </button>
                <button
                  type="button"
                  className="healthier-insight-toggle"
                  aria-expanded={openInsight === card.itemCode}
                  onClick={() =>
                    setOpenInsight((current) =>
                      current === card.itemCode ? null : card.itemCode,
                    )
                  }
                >
                  {copy.whyThisAlternative}
                </button>
              </li>
            ))}
          </ul>
          {openCard && (
            <div className="healthier-insight-wrap">
              <InsightPanel
                alternative={openCard.alternative}
                originalName={originalName}
                alternativeName={openCard.name}
                copy={copy}
              />
              <button
                type="button"
                className="healthier-insight-close"
                onClick={() => setOpenInsight(null)}
              >
                {copy.closeInsights}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
