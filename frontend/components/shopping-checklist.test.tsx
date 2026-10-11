import { readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/i18n";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { createPlanShoppingChecklist, createShoppingChecklist, setChecklistTollCost } from "@/lib/shopping-checklist";
import { buildTripRecord } from "@/lib/trip-history";
import { ShoppingChecklistScreen } from "./shopping-checklist";
import { ReceiptHistoryScreen } from "./shopping-history";
import { ShoppingStepNav } from "./shopping-step-nav";

const fuel = { fuelCostRm: 1, fuelLitres: 0.4, litresPer100Km: 2.5, fuelPricePerLitreRm: 2.5,
  fuelPriceBasis: "ron95" as const, fuelPriceSource: "data.gov.my" as const,
  fuelPriceEffectiveDate: "2026-10-08", tollCostRm: null, tollStatus: "unavailable" as const };
const handlers = { onToggleStatus: () => {}, onAddManual: () => {}, onEditItem: () => {}, onRevertItem: () => {},
  onRestoreSavedItem: () => {}, onRemoveSavedItem: () => {}, onDeleteItem: () => {}, onDeleteChecklist: () => {},
  onRecordTrip: () => {}, onSetTollCost: () => {} };

describe("checklist layout and saved travel", () => {
  it.each(["single", "multi"])("shows Maps beside %s store rows and gives recording its own primary action", kind => {
    const checklist = kind === "single"
      ? createShoppingChecklist({ ...stores[0], travelCostBreakdown: fuel, basketPrices: stores[0].basketPrices.map(price => ({ ...price, saraEligible: true, saraCategoryCandidate: true })) })
      : createPlanShoppingChecklist({ ...plan, legs: plan.legs.map(leg => ({ ...leg, travelCostBreakdown: fuel })) }, stores, basket);
    const html = renderToStaticMarkup(<ShoppingChecklistScreen checklist={checklist} copy={COPY.en} locale="en" savedItems={[]} alreadyRecorded={false} {...handlers}/>);
    expect(html).toContain('class="store-detail-route checklist-map-route"');
    expect(html.indexOf('class="checklist-overview-stores"')).toBeLessThan(html.indexOf('class="store-detail-route checklist-map-route"'));
    expect(html).toContain('class="checklist-record-panel"');
    expect(html.indexOf('checklist-add-button')).toBeLessThan(html.indexOf('class="checklist-workspace"'));
    expect(html).toContain('class="primary-button checklist-record-button"');
    expect(html).toContain('aria-label="Recorded toll cost (RM)"');
    expect(html).toContain("Expected fuel cost");
    expect(html).toContain(COPY.en.saraCategory);
    expect(html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.some(button => button.includes("→"))).toBe(false);
    expect(html.indexOf('class="checklist-filter-bar checklist-workspace-filters"')).toBeLessThan(html.indexOf('class="checklist-workspace"'));
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
    if (process.env.CHECKLIST_PREVIEW_DIR) {
      const css = ["globals.css", "ui-layout.css"].map(file => readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8")).join("\n");
      const page = (body: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody {font-family:Inter,Arial,sans-serif} p,h1,h2,h3 {margin:0} ul,ol {list-style:none;margin:0;padding:0} .active-checklist > div:first-child {padding-inline:24px;display:flex;flex-direction:column} .checklist-table {overflow:hidden;border:1px solid #e2e8ed;border-radius:8px;background:white} .checklist-items-heading {padding:12px;border-bottom:1px solid #e2e8ed} .checklist-item-copy {display:grid;gap:4px} .checklist-secondary-actions button {border:1px solid #e2e8ed} .primary-button:disabled{opacity:.45}</style></head><body>${body}</body></html>`;
      const steps = renderToStaticMarkup(<ShoppingStepNav current="checklist" locale="en" available={["location", "shop", "basket", "compare", "checklist"]} onNavigate={() => {}}/>);
      writeFileSync(`${process.env.CHECKLIST_PREVIEW_DIR}/checklist.html`, page(steps + renderToStaticMarkup(<ShoppingChecklistScreen checklist={checklist} copy={COPY.en} locale="en" savedItems={[]} alreadyRecorded={false} {...handlers}/>)));
      writeFileSync(`${process.env.CHECKLIST_PREVIEW_DIR}/history.html`, page(html));
    }
  });
});
