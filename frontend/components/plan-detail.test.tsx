import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { PlanDetailView } from "./plan-detail";
import { StorePriceTable } from "./store-basket-row";
import { MultiPlanCard } from "./plan-comparison";
import { mapsPlanRouteUrl } from "@/lib/travel";

describe("store plan details", () => {
  it("shows the complete Google Maps route on the recommendation card", () => {
    const routeUrl = mapsPlanRouteUrl({latitude: 6, longitude: 102, label: "Home", source: "device"}, plan, stores, "car");
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
      activeChecklist: null, onCreateChecklist: () => {}, onBack: () => {},
      origin: {latitude: 6, longitude: 102, label: "Home", source: "device"}, transportMode: "car",
    }));
    expect(markup).toContain("store-item-image");
    expect(markup).toContain("rice-product");
    expect(markup).not.toContain("<strong>Milk</strong>");
    expect(markup).toContain("RM65.00");
    expect(markup).toContain("RM68.00");
    expect(markup).toContain("store-summary-travel");
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
});
