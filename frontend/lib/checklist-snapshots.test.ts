import { describe, expect, it } from "vitest";
import { basket, plan, stores } from "../tests/fixtures/store-plan";
import { planDetailRows } from "./plan-detail-edits";
import { createPlanShoppingChecklist, createShoppingChecklist, parseShoppingChecklist, serializeShoppingChecklist, setChecklistTollCost } from "./shopping-checklist";
import { buildTripRecord, parseTripHistory, serializeTripHistory, tripPaymentBreakdown } from "./trip-history";
import { addNextTripItem, nextTripBasket, parseNextTrip, saveForNextTrip, serializeNextTrip } from "./next-trip";
import { parseTollCost, tripTravelTotalRm } from "./trip-travel-cost";
import type { TravelCostBreakdown } from "./contracts";

const fuel: TravelCostBreakdown = { fuelCostRm: 1, fuelLitres: 0.4, litresPer100Km: 2.5,
  fuelPricePerLitreRm: 2.5, fuelPriceBasis: "ron95", fuelPriceSource: "data.gov.my",
  fuelPriceEffectiveDate: "2026-10-08", tollCostRm: null, tollStatus: "unavailable" };

describe("checklist and history cost snapshots", () => {
  it("preserves SARA flags for single-store detail and fallback rows", () => {
    const single = { ...stores[0], basketPrices: stores[0].basketPrices.map(price => ({ ...price, saraEligible: true, saraCategoryCandidate: true })) };
    for (const checklist of [createShoppingChecklist(single), createShoppingChecklist(single, planDetailRows(plan, single, basket))]) {
      const loaded = parseShoppingChecklist(serializeShoppingChecklist(checklist))!;
      expect(loaded.items[0]).toMatchObject({ saraEligible: true, saraCategoryCandidate: true });
      const record = buildTripRecord({ ...loaded, items: loaded.items.map(item => ({ ...item, status: "bought" })) });
      expect(parseTripHistory(serializeTripHistory([record]))[0].lines[0]).toMatchObject({ saraEligible: true, saraCategoryCandidate: true });
      expect(record.store.saraStatus).toBe("verified");
    }
  });

  it("freezes multi-store fuel and recorded tolls without changing the plan estimate", () => {
    const priced = { ...plan, legs: plan.legs.map(leg => ({ ...leg, travelCostBreakdown: { ...fuel } })) };
    const checklist = setChecklistTollCost(createPlanShoppingChecklist(priced, stores, basket), 7.5);
    const loaded = parseShoppingChecklist(serializeShoppingChecklist(checklist))!;
    expect(loaded.estimatedRoundTripCostRm).toBe(3);
    expect(loaded.plannedCombinedTotalRm).toBe(68);
    expect(tripTravelTotalRm(loaded)).toBe(10.5);
    const record = buildTripRecord({ ...loaded, items: loaded.items.map(item => ({ ...item, status: "bought" })) });
    const saved = parseTripHistory(serializeTripHistory([record]))[0];
    expect(saved.actualTollCostRm).toBe(7.5);
    expect(saved.travelCostBreakdowns).toHaveLength(3);
    expect(saved.lines[0].saraEligible).toBe(true);
    loaded.travelCostBreakdowns![0].fuelCostRm = 99;
    expect(record.travelCostBreakdowns![0].fuelCostRm).toBe(1);
    expect(setChecklistTollCost(checklist, 0).actualTollCostRm).toBe(0);
    expect(setChecklistTollCost(checklist, null).actualTollCostRm).toBeNull();
    expect(setChecklistTollCost(checklist, -1)).toBe(checklist);
    expect(parseShoppingChecklist(JSON.stringify({ ...checklist, actualTollCostRm: -1 }))).toBeNull();
    expect(parseTripHistory(serializeTripHistory([{ ...saved, travelCostBreakdowns: [{ ...fuel, fuelCostRm: -1 }] }]))).toEqual([]);
  });

  it("uses bought quantities and edited prices for SARA/cash, and excludes unbought items", () => {
    const checklist = createPlanShoppingChecklist(plan, stores, basket);
    const record = buildTripRecord({ ...checklist, items: checklist.items.map((item, index) => ({ ...item,
      status: "bought", saraEligible: index === 0, saraCategoryCandidate: false })) });
    expect(tripPaymentBreakdown(record.lines)).toEqual({ saraCreditRm: 60, cashNeededRm: 5 });
    const edited = record.lines.map((line, index) => index === 0 ? { ...line, actualQuantity: 1, actualPriceRm: 25 } : line);
    expect(tripPaymentBreakdown(edited)).toEqual({ saraCreditRm: 25, cashNeededRm: 5 });
    expect(tripPaymentBreakdown(edited.map(line => line.itemName === "Milk" ? { ...line, status: "not_bought" } : line))).toEqual({ saraCreditRm: 25, cashNeededRm: 0 });
    const legacy = record.lines.map(line => ({ ...line, saraEligible: undefined, saraCategoryCandidate: undefined }));
    expect(tripPaymentBreakdown(legacy)).toEqual({ saraCreditRm: null, cashNeededRm: null });
    expect(parseTripHistory(serializeTripHistory([{ ...record, lines: legacy }]))).toHaveLength(1);
  });

  it("keeps SARA when an item is planned again or restored", () => {
    const checklist = createPlanShoppingChecklist(plan, stores, basket);
    const saved = parseNextTrip(serializeNextTrip(saveForNextTrip([], checklist.items[0])));
    expect(saved[0].saraEligible).toBe(true);
    expect(nextTripBasket([], saved)[0].saraEligible).toBe(true);
    const restored = addNextTripItem({ ...checklist, items: [] }, saved[0]);
    expect(restored.items[0].saraEligible).toBe(true);
    expect(addNextTripItem({ ...checklist, items: [] }, saved[0], { unitPriceRm: 30, observedDate: null, saraEligible: false, saraCategoryCandidate: false }).items[0].saraEligible).toBe(false);
  });

  it.each([["", null], ["0", 0], ["7.50", 7.5], ["-1", undefined], ["1.234", undefined], ["abc", undefined]])("validates toll entry %s", (input, expected) => {
    expect(parseTollCost(String(input))).toBe(expected);
  });
});
