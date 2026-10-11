import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { PlanDetailView } from "./plan-detail";
import { StorePriceTable } from "./store-basket-row";
import { MultiPlanCard } from "./plan-comparison";
import { mapsPlanRouteUrl } from "@/lib/travel";
import { rankedStorePlanOptions } from "@/lib/multi-store";

function comparisonOptions(cost: number) {
  return [...rankedStorePlanOptions(stores.map(store => ({ ...store, combinedTotalRm: cost }))), { kind: "plan" as const, plan }];
}

describe("store plan details", () => {
  it("shows the complete Google Maps route on the recommendation card", () => {
    const routeUrl = mapsPlanRouteUrl({latitude: 6, longitude: 102}, plan, stores, "car");
    const markup = renderToStaticMarkup(createElement(MultiPlanCard, {
      plan, stores, basket, copy: COPY.en, locale: "en", routeUrl, onSelectPlan: () => {},
    }));
    expect(markup).toContain('class="store-card-route"');
    expect(markup).toContain("waypoints=");
    expect(markup).not.toContain('class="plan-inter-store-fact"');
  });
  it("shows only the active store's image rows while preserving the whole basket total", () => {
    const markup = renderToStaticMarkup(createElement(PlanDetailView, {
      plan, stores, basket, copy: COPY.en, locale: "en", secondStoreLimit: null,
      onSetBasket: () => {}, activeChecklist: null, onCreateChecklist: () => {}, onBack: () => {},
      origin: {latitude: 6, longitude: 102, label: "Home", source: "device"}, transportMode: "car",
    }));
    expect(markup).toContain("store-item-image");
    expect(markup).toContain("rice-product");
    expect(markup).not.toContain("<strong>Milk</strong>");
    expect(markup).toContain("RM65.00");
    expect(markup).toContain("RM68.00");
    expect(markup).toContain("store-summary-travel");
    expect(markup).toContain("<small>From</small>");
    expect(markup).toContain("<strong>Home</strong>");
    expect(markup).toContain('<details class="plan-journey">');
    expect(markup.indexOf('class="plan-journey"')).toBeLessThan(markup.indexOf('class="store-detail-items-heading"'));
    expect(markup).toContain("waypoints=");
    expect(markup).toContain(COPY.en.openInGoogleMaps);
  });

  it("keeps price disclosures in the compact table with labelled estimates", () => {
    const markup = renderToStaticMarkup(createElement(StorePriceTable, {
      prices: plan.assignments.map(line => ({...line, itemName: line.itemName!, packageSize: line.unit})),
      copy: COPY.en, locale: "en",
    }));
    expect(markup).toContain("store-price-table-row");
    expect(markup).toContain(COPY.en.medianPriceEstimate);
    expect(markup).not.toContain("store-item-row");
    expect(markup).not.toContain("<img");
  });

  it("shows transport mode, fuel breakdown and multi-store savings without duplicate return travel", () => {
    const fuel = { fuelCostRm: 1, fuelLitres: 0.4, litresPer100Km: 2.5,
      fuelPricePerLitreRm: 2.5, fuelPriceBasis: "ron95" as const,
      fuelPriceSource: "data.gov.my" as const, fuelPriceEffectiveDate: "2026-10-08",
      tollCostRm: null, tollStatus: "unavailable" as const };
    const markup = renderToStaticMarkup(createElement(PlanDetailView, {
      plan: { ...plan, savingVsSingleRm: 5, legs: plan.legs.map(leg => ({ ...leg, travelCostBreakdown: fuel })) },
      comparisonOptions: comparisonOptions(73),
      stores, basket, copy: COPY.en, locale: "en", secondStoreLimit: null,
      onSetBasket: () => {}, activeChecklist: null, onCreateChecklist: () => {}, onBack: () => {}, transportMode: "motorcycle",
    }));
    expect(markup).toContain(COPY.en.transportMode);
    expect(markup).toContain(COPY.en.motorcycle);
    expect(markup).not.toContain("Items at this store");
    expect(markup).not.toContain(COPY.en.returnTravel);
    expect(markup).toContain("Expected fuel cost");
    expect(markup).toContain("RM3.00");
    expect(markup).toContain("Estimated savings");
    expect(markup).toContain("Estimated RM5.00 savings vs the median plan");
    expect(markup).toContain("Plan choice");
  });

  it.each([
    [null, "A comparable median plan cost is not available yet."],
    [-3, "Estimated RM3.00 above the median plan"],
    [0, "About the same cost as the median plan"],
  ])("discloses unavailable and signed multi-store savings (%s)", (saving, expected) => {
    const markup = renderToStaticMarkup(createElement(PlanDetailView, {
      plan: { ...plan, savingVsSingleRm: saving as number | null },
      comparisonOptions: saving == null ? [] : comparisonOptions(68 + Number(saving)),
      stores, basket, copy: COPY.en, locale: "en", secondStoreLimit: null,
      onSetBasket: () => {}, activeChecklist: null, onCreateChecklist: () => {}, onBack: () => {},
    }));
    expect(markup).toContain(expected);
  });
});
