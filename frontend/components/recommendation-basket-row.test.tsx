import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { planDetailRows } from "@/lib/plan-detail-edits";
import type { BasketAlternativeLine } from "@/lib/contracts";
import { RecommendationBasketRow, RecommendationItemOptions } from "./recommendation-basket-row";
import { StoreChainLogo } from "./store-chain-logo";

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
    expect(markup).toContain('class="alternative-image"');
    expect(markup).toContain('class="dropdown-summary pack-comparison-summary"');
    // Optionally export this exact component with production CSS for browser layout checks.
    if (locale === "en" && process.env.ALTERNATIVES_PREVIEW_PATH) {
      const css = ["globals.css", "ui-layout.css"].map(file => readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8")).join("\n");
      const rowMarkup = renderToStaticMarkup(createElement(RecommendationBasketRow, { row, basket, copy: COPY.en, locale, ...handlers, onChangeQuantity: () => {} })).replace("</li>", `${markup}</li>`);
      const logo = renderToStaticMarkup(createElement(StoreChainLogo, { name: "Local Store" }));
      writeFileSync(process.env.ALTERNATIVES_PREVIEW_PATH, `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}
/* Tailwind preflight for the standalone preview. */
body { font-family: Inter, Arial, sans-serif; } p { margin: 0; } ul { list-style: none; margin: 0; padding: 0; }</style></head><body style="padding:16px"><main style="max-width:900px;margin:auto"><div class="store-symbol">${logo}</div><ul class="store-item-list">${rowMarkup}</ul></main></body></html>`);
    }
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
