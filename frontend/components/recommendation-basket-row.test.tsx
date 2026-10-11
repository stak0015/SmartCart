import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { planDetailRows } from "@/lib/plan-detail-edits";
import type { BasketAlternativeLine } from "@/lib/contracts";
import { RecommendationItemOptions } from "./recommendation-basket-row";

const suggestion: BasketAlternativeLine = {
  quantity: 2,
  source: { ...plan.assignments[0], itemName: "Rice", packageSize: "5 kg", priceObservedDaysAgo: 1,
    saraEligible: true, saraCategoryCandidate: true, isSaraCreditCandidate: true, category: null },
  alternative: { itemId: "3", itemName: "Value rice", itemNameEn: "Value rice", itemNameMs: "Beras jimat",
    unit: "5 kg", packageSize: "5 kg", unitPriceRm: 20, lineTotalRm: 40,
    observedDate: "2026-10-08", priceObservedDaysAgo: 1, priceSource: "store",
    saraEligible: false, saraCategoryCandidate: false, isSaraCreditCandidate: false, category: null },
  savingsRm: 20,
  packOptions: [
    { itemId: "1", itemName: "Rice 5 kg", packageSize: "5 kg", totalPriceRm: 30, pricePerUnitRm: 6, unitKind: "KG",
      observedDate: "2026-10-08", saraEligible: true, saraCategoryCandidate: true, isSaraCreditCandidate: true, category: null },
    { itemId: "4", itemName: "Rice 10 kg", itemNameEn: "Rice 10 kg", itemNameMs: "Beras 10 kg", packageSize: "10 kg",
      totalPriceRm: 50, pricePerUnitRm: 5, unitKind: "KG", isBestValue: true,
      observedDate: "2026-10-08", saraEligible: true, saraCategoryCandidate: true, isSaraCreditCandidate: true, category: null },
  ],
};
const row = planDetailRows(plan, stores[0], basket, [suggestion])[0];
const handlers = { onApplyAlternative: () => {}, onApplyPack: () => {}, onUndo: () => {} };

describe("shared store alternatives", () => {
  it.each(["en", "ms"] as const)("shows product names, pack sizes, prices and tradeoffs in %s", locale => {
    const markup = renderToStaticMarkup(createElement(RecommendationItemOptions, { row, basket, copy: COPY[locale], locale, ...handlers }));
    expect(markup).toContain(`class="alternative-name">${locale === "en" ? "RICE 10 KG" : "BERAS 10 KG"}`);
    expect(markup).toContain(COPY[locale].bestUnitValue);
    expect(markup).toContain(COPY[locale].currentPack);
    expect(markup).toContain("RM50.00");
    expect(markup).toContain(COPY[locale].moreNow("RM40.00"));
    expect(markup).toContain(COPY[locale].saveAmount("RM20.00"));
  });

  it("prevents duplicate alternatives and packs", () => {
    const duplicates = [...basket, { ...basket[0], id: "db-3" }, { ...basket[0], id: "db-4" }];
    const markup = renderToStaticMarkup(createElement(RecommendationItemOptions, { row, basket: duplicates, copy: COPY.en, locale: "en", ...handlers }));
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
    expect(markup.match(new RegExp(COPY.en.alreadyInBasket, "g"))).toHaveLength(2);
  });

  it("does not offer swaps or packs against median prices", () => {
    const medianRow = { ...row, current: { ...row.current, priceSource: "median" as const } };
    const markup = renderToStaticMarkup(createElement(RecommendationItemOptions, { row: medianRow, basket, copy: COPY.en, locale: "en", ...handlers }));
    expect(markup).not.toContain("cheaper-option");
    expect(markup).not.toContain("pack-comparison");
  });
});
