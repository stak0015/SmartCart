import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { createPlanShoppingChecklist, createShoppingChecklist, setChecklistTollCost } from "@/lib/shopping-checklist";
import { buildTripRecord } from "@/lib/trip-history";
import { ShoppingChecklistScreen } from "./shopping-checklist";
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
