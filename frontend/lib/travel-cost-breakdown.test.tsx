import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TravelCostDetails } from "../components/travel-cost-breakdown";
import type { TravelCostBreakdown } from "./contracts";

const fuel: TravelCostBreakdown = {
  fuelCostRm: 3.64, fuelLitres: 1.4, litresPer100Km: 7,
  fuelPricePerLitreRm: 2.6, fuelPriceBasis: "ron95",
  fuelPriceSource: "data.gov.my", fuelPriceEffectiveDate: "2026-10-08",
  tollCostRm: null, tollStatus: "unavailable",
};

describe("recommendation fuel breakdown", () => {
  it("shows fuel assumptions and excludes unavailable tolls", () => {
    const html = renderToStaticMarkup(<TravelCostDetails breakdowns={[fuel]} locale="en" roundTrip/>);
    for (const text of ["RM3.64", "1.400 L", "RM2.60/L", "7 L/100 km", "general market", "2026-10-08", "Unavailable", "excluded", "same distance"]) expect(html).toContain(text);
    expect(html).not.toContain("Unavailable · excluded");
    expect(html).toContain('aria-label="How fuel cost is estimated"');
    expect(html).toContain('aria-label="About toll costs"');
    expect(html.match(/role="tooltip"/g)).toHaveLength(2);
    expect(html).toContain('class="travel-cost-row"');
    for (const label of ["Fuel type", "Consumption", "Price source", "Calculation", "Availability"]) expect(html).toContain(`<b>${label}</b>`);
    expect(html.match(/class="travel-cost-tooltip-line"/g)).toHaveLength(5);
  });
  it("sums rounded journey legs and labels subsidy and fallback in Malay", () => {
    const leg = { ...fuel, fuelCostRm: 0.91, fuelLitres: 0.35, fuelPriceBasis: "ron95_budi95" as const, fuelPriceSource: "fallback" as const };
    const html = renderToStaticMarkup(<TravelCostDetails breakdowns={[leg, leg, leg]} locale="ms" roundTrip/>);
    for (const text of ["RM2.73", "1.050 L", "BUDI95", "harga sandaran", "Tidak tersedia"]) expect(html).toContain(text);
  });
  it("hides fuel breakdowns for older snapshots and non-petrol modes", () => {
    expect(renderToStaticMarkup(<TravelCostDetails breakdowns={[null]} locale="en" roundTrip/>)).toBe("");
    expect(renderToStaticMarkup(<TravelCostDetails breakdowns={[]} locale="en" roundTrip/>)).toBe("");
  });
});
