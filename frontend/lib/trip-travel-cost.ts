// Owner: Shun
import type { TravelCostBreakdown } from "./contracts";

/** Fuel stays a frozen estimate; tolls are a separate shopper-recorded expense. */
export interface TripTravelSnapshot {
  estimatedRoundTripCostRm: number | null;
  travelCostBreakdowns?: TravelCostBreakdown[];
  actualTollCostRm?: number | null;
}

/**
 * Parse a toll amount typed by the shopper: blank means none (null), invalid input returns
 * undefined.
 */
export function parseTollCost(value: string): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return undefined;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function tripTravelTotalRm(snapshot: TripTravelSnapshot): number | null {
  if (snapshot.estimatedRoundTripCostRm == null) return null;
  return Math.round((snapshot.estimatedRoundTripCostRm + (snapshot.actualTollCostRm ?? 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Runtime validation of frozen travel costs: fuel breakdowns must be complete and tolls are always
 * 'unavailable' in estimates.
 */
export function isTripTravelSnapshot(value: Record<string, unknown>): boolean {
  if (value.actualTollCostRm !== undefined && value.actualTollCostRm !== null
    && !(typeof value.actualTollCostRm === "number" && Number.isFinite(value.actualTollCostRm) && value.actualTollCostRm >= 0)) return false;
  if (value.travelCostBreakdowns === undefined) return true;
  return Array.isArray(value.travelCostBreakdowns) && value.travelCostBreakdowns.every(entry => {
    if (!entry || typeof entry !== "object") return false;
    const cost = entry as Record<string, unknown>;
    return ["fuelCostRm", "fuelLitres", "litresPer100Km", "fuelPricePerLitreRm"].every(key => typeof cost[key] === "number" && Number.isFinite(cost[key]) && cost[key] >= 0)
      && (cost.fuelPriceBasis === "ron95" || cost.fuelPriceBasis === "ron95_budi95")
      && ["data.gov.my", "cached", "fallback"].includes(String(cost.fuelPriceSource))
      && (cost.fuelPriceEffectiveDate === null || typeof cost.fuelPriceEffectiveDate === "string")
      && cost.tollCostRm === null && cost.tollStatus === "unavailable";
  });
}
