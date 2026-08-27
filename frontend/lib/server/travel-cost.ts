import type { TransportMode } from "@/lib/contracts";

export interface TravelCostRate {
  baseFarePerLegRm: number;
  perKilometreRm: number;
  description: string;
}

export type TravelCostModel = Record<TransportMode, TravelCostRate>;

function nonNegativeNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getTravelCostModel(env: NodeJS.ProcessEnv = process.env): TravelCostModel {
  const publicTransportBase = nonNegativeNumber(env.TRAVEL_COST_PUBLIC_TRANSPORT_BASE_PER_LEG_RM, 1);
  const publicTransportRate = nonNegativeNumber(env.TRAVEL_COST_PUBLIC_TRANSPORT_PER_KM_RM, 0.08);
  const motorcycleRate = nonNegativeNumber(env.TRAVEL_COST_MOTORCYCLE_PER_KM_RM, 0.12);
  const carRate = nonNegativeNumber(env.TRAVEL_COST_CAR_PER_KM_RM, 0.45);

  return {
    walk: {
      baseFarePerLegRm: 0,
      perKilometreRm: 0,
      description: "RM0 direct monetary cost; accessibility and effort are not represented.",
    },
    public_transport: {
      baseFarePerLegRm: publicTransportBase,
      perKilometreRm: publicTransportRate,
      description: `Planning estimate: RM${publicTransportBase.toFixed(2)} base per leg plus RM${publicTransportRate.toFixed(2)}/km. Actual fares may differ.`,
    },
    motorcycle: {
      baseFarePerLegRm: 0,
      perKilometreRm: motorcycleRate,
      description: `Planning estimate: RM${motorcycleRate.toFixed(2)}/km. Parking, tolls and ownership costs are excluded.`,
    },
    car: {
      baseFarePerLegRm: 0,
      perKilometreRm: carRate,
      description: `Planning estimate: RM${carRate.toFixed(2)}/km. Parking, tolls and ownership costs are excluded.`,
    },
  };
}

export function estimateRoundTripCostRm(
  oneWayDistanceMeters: number,
  rate: TravelCostRate,
): number {
  const returnDistanceKm = Math.max(0, oneWayDistanceMeters) * 2 / 1000;
  const value = rate.baseFarePerLegRm * 2 + returnDistanceKm * rate.perKilometreRm;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
