"use client";

import type { CatalogueItemSummary, HealthierAlternativesResult } from "@/lib/api";
import type { AppCopy } from "@/lib/i18n";
import {
  alternativeCards,
  alternativesStatus,
  type AlternativeCard,
  type ComparisonReasonKind,
} from "@/lib/nutrition";
import { CatalogueItemImage } from "./catalogue-item-image";

// Epic 7 (US 7.1) — the "Healthier alternatives" section inside the item
// dialog. It sits below the item details and never blocks the item's own
// quantity or Add controls (AC 7.1.4 / 7.1.5).

const REASON_COPY: Record<ComparisonReasonKind, keyof AppCopy | null> = {
  lower_fat: "healthierReasonLowerFat",
  higher_fibre: "healthierReasonHigherFibre",
  lower_saturated_fat: "healthierReasonLowerSaturatedFat",
  lower_sodium: "healthierReasonLowerSodium",
  other: null,
};

function reasonText(card: AlternativeCard, copy: AppCopy): string {
  const key = REASON_COPY[card.reason];
  if (!key) return card.alternative.headline;
  const value = copy[key];
  return typeof value === "string" ? value : card.alternative.headline;
}

export function HealthierAlternativesSection({
  loading,
  result,
  error,
  locale,
  copy,
  onOpenItem,
}: {
  loading: boolean;
  result: HealthierAlternativesResult | null;
  error: unknown;
  locale: "en" | "ms";
  copy: AppCopy;
  onOpenItem?: (item: CatalogueItemSummary) => void;
}) {
  const status = alternativesStatus(loading, result, error);
  const cards = result ? alternativeCards(result, locale) : [];

  return (
    <section className="healthier-alternatives" aria-labelledby="healthier-alternatives-title">
      <h3 id="healthier-alternatives-title">{copy.healthierAlternativesTitle}</h3>
      {status === "loading" && <p role="status">{copy.healthierAlternativesLoading}</p>}
      {status === "empty" && <p>{copy.healthierAlternativesEmpty}</p>}
      {status === "unavailable" && (
        <p role="alert">{copy.healthierAlternativesUnavailable}</p>
      )}
      {status === "ready" && (
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
