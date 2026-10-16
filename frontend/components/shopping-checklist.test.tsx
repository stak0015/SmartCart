import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { createPlanShoppingChecklist, createShoppingChecklist, effectiveChecklistLineTotal, setChecklistTollCost } from "@/lib/shopping-checklist";
import { formatRm } from "@/lib/format-rm";
import { buildTripRecord } from "@/lib/trip-history";
import { NextTripList, ShoppingChecklistScreen } from "./shopping-checklist";
import type { NextTripItem } from "@/lib/next-trip";
import { ReceiptHistoryScreen } from "./shopping-history";

const fuel = { fuelCostRm: 1, fuelLitres: 0.4, litresPer100Km: 2.5, fuelPricePerLitreRm: 2.5,
  fuelPriceBasis: "ron95" as const, fuelPriceSource: "data.gov.my" as const,
  fuelPriceEffectiveDate: "2026-10-08", tollCostRm: null, tollStatus: "unavailable" as const };
const handlers = { onToggleStatus: () => {}, onAddManual: () => {}, onEditItem: () => {}, onRevertItem: () => {},
  onRestoreSavedItem: () => {}, onRemoveSavedItem: () => {}, onDeleteItem: () => {}, onDeleteChecklist: () => {},
  onRecordTrip: () => {}, onSetTollCost: () => {} };

describe("checklist and saved travel", () => {
  it.each(["single", "multi"])("shows toll entry, fuel estimate and SARA labels for %s-store checklists", kind => {
    const checklist = kind === "single"
      ? createShoppingChecklist({ ...stores[0], travelCostBreakdown: fuel, basketPrices: stores[0].basketPrices.map(price => ({ ...price, saraEligible: true, saraCategoryCandidate: true })) })
      : createPlanShoppingChecklist({ ...plan, legs: plan.legs.map(leg => ({ ...leg, travelCostBreakdown: fuel })) }, stores, basket);
    const html = renderToStaticMarkup(<ShoppingChecklistScreen checklist={checklist} copy={COPY.en} locale="en" savedItems={[]} alreadyRecorded={false} {...handlers}/>);
    expect(html).toContain('aria-label="Recorded toll cost (RM)"');
    expect(html).toContain("Expected fuel cost");
    expect(html).toContain(COPY.en.saraCategory);
  });

  it("bases the item list and Basket summary totals on bought items once any are bought", () => {
    const planned = createPlanShoppingChecklist(plan, stores, basket);
    const plannedHtml = renderToStaticMarkup(<ShoppingChecklistScreen checklist={planned} copy={COPY.en} locale="en" savedItems={[]} alreadyRecorded={false} {...handlers}/>);
    expect(plannedHtml).toContain("Planned totals for all items.");

    const checklist = { ...planned, items: planned.items.map((item, index) => index === 0 ? { ...item, status: "bought" as const } : item) };
    const boughtTotal = effectiveChecklistLineTotal(checklist.items[0])!;
    const html = renderToStaticMarkup(<ShoppingChecklistScreen checklist={checklist} copy={COPY.en} locale="en" savedItems={[]} alreadyRecorded={false} {...handlers}/>);
    expect(html).toMatch(new RegExp(`<span>(Estimated bought total|Bought total)</span><strong>${formatRm(boughtTotal)}</strong>`));
    expect(html).toContain(`<dd>${formatRm(boughtTotal)}</dd>`);
    expect(html).toContain(`Totals include the 1 of ${checklist.items.length} items marked bought.`);
  });

  it("renders recorded tolls, the saved fuel estimate and SARA/cash in history", () => {
    const checklist = setChecklistTollCost(createPlanShoppingChecklist({ ...plan, legs: plan.legs.map(leg => ({ ...leg, travelCostBreakdown: fuel })) }, stores, basket), 7.5);
    const record = buildTripRecord({ ...checklist, items: checklist.items.map((item, index) => ({ ...item, status: "bought", saraEligible: index === 0, saraCategoryCandidate: false })) });
    const html = renderToStaticMarkup(<ReceiptHistoryScreen history={[record]} locale="en" onDeleteTrip={() => {}}/>);
    expect(html).toContain("Expected fuel cost");
    expect(html).toContain("RM3.00");
    expect(html).toContain("RM7.50");
    expect(html).toContain("RM75.50");
    expect(html).toContain(COPY.en.saraCreditLabel);
    expect(html).toContain(COPY.en.cashNeededLabel);
    expect(html).toContain("RM60.00");
    expect(html).toContain("RM5.00");
    expect(html).toContain(COPY.en.verifiedSara);
  });
});

describe("item details and planned items while shopping", () => {
  const planned: NextTripItem[] = [
    { id: "catalogue:7", source: "catalogue", catalogueItemId: "7", itemName: "Rice", itemNameEn: "Rice", itemNameMs: "Beras", category: null, sourceCategory: null, imageUrl: null, packageSize: "5 kg", quantity: 2, plannedWeek: "2026-10-12" },
    { id: "manual:1", source: "manual", catalogueItemId: null, itemName: "Candles", itemNameEn: null, itemNameMs: null, category: null, sourceCategory: null, imageUrl: null, packageSize: null, quantity: 1, plannedWeek: "2026-10-12" },
  ];

  it("lets catalogue planned items open details and be added to the basket, but not manual items (AC 4.8.3, 4.8.4, 4.9.1, 4.9.2)", () => {
    const html = renderToStaticMarkup(<NextTripList items={planned} locale="en" copy={COPY.en} onRemove={() => {}} onOpenItem={() => {}} onAddToBasket={() => {}}/>);
    expect(html).toContain('aria-label="View item details: Rice"');
    expect(html).not.toContain("View item details: Candles");
    expect(html).toContain('aria-label="Add to basket: Rice"');
    expect(html).not.toContain("Add to basket: Candles");
  });

  it("opens checklist item details from the item name (AC 5.9.1)", () => {
    const checklist = createShoppingChecklist(stores[0]);
    const html = renderToStaticMarkup(<ShoppingChecklistScreen checklist={checklist} copy={COPY.en} locale="en" savedItems={[]} alreadyRecorded={false} {...handlers} onOpenItem={() => {}}/>);
    expect(html).toContain("View item details:");
  });
});
