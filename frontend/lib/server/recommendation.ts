import type {
  SaraStoreStatus,
  StoreRecommendation,
  TravelLimitType,
} from "@/lib/contracts";
import type { RouteMatrixResult } from "./maps/types";
import type { PremiseCandidate } from "./premises";
import { estimateRoundTripCostRm, type TravelCostRate } from "./travel-cost";

export interface RankedRouteInput {
  premiseId: string;
  premiseCode: string;
  name: string;
  address: string | null;
  district: string | null;
  state: string | null;
  straightLineDistanceKm: number;
  saraStatus: SaraStoreStatus;
  distanceMeters: number;
  durationSeconds: number;
}

export function mergeRouteResults(
  candidates: PremiseCandidate[],
  routeResults: RouteMatrixResult[],
): RankedRouteInput[] {
  return routeResults.flatMap(route => {
    const premise = candidates[route.destinationIndex];
    if (!premise) return [];
    return [{
      premiseId: premise.premiseId,
      premiseCode: premise.premiseCode,
      name: premise.name,
      address: premise.address,
      district: premise.district,
      state: premise.state,
      straightLineDistanceKm: premise.straightLineDistanceKm,
      saraStatus: premise.saraStatus,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
    }];
  });
}

export function rankReachableStores(options: {
  routes: RankedRouteInput[];
  limitType: TravelLimitType;
  limitValue: number;
  costRate: TravelCostRate;
}): StoreRecommendation[] {
  return options.routes
    .filter(route => options.limitType === "distance"
      ? route.distanceMeters <= options.limitValue * 1000
      : route.durationSeconds <= options.limitValue * 60)
    .map(route => ({
      premiseId: route.premiseId,
      premiseCode: route.premiseCode,
      name: route.name,
      address: route.address,
      district: route.district,
      state: route.state,
      straightLineDistanceKm: round(route.straightLineDistanceKm, 2),
      routeDistanceKm: round(route.distanceMeters / 1000, 2),
      estimatedTravelMinutes: Math.max(1, Math.ceil(route.durationSeconds / 60)),
      estimatedRoundTripCostRm: estimateRoundTripCostRm(route.distanceMeters, options.costRate),
      saraStatus: route.saraStatus,
    }))
    .sort((left, right) =>
      left.estimatedRoundTripCostRm - right.estimatedRoundTripCostRm ||
      left.estimatedTravelMinutes - right.estimatedTravelMinutes ||
      left.routeDistanceKm - right.routeDistanceKm ||
      left.name.localeCompare(right.name) ||
      Number(left.premiseId) - Number(right.premiseId));
}

function round(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
