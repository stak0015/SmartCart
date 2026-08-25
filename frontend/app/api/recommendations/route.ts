import { NextResponse } from "next/server";
import type { RecommendationResponse, TransportMode } from "@/lib/contracts";
import { AppError } from "@/lib/server/errors";
import { apiErrorResponse } from "@/lib/server/http";
import { getMapsProvider } from "@/lib/server/maps/google";
import { findNearestPremises, getPremiseLocationCoverage } from "@/lib/server/premises";
import { mergeRouteResults, rankReachableStores } from "@/lib/server/recommendation";
import { getTravelCostModel } from "@/lib/server/travel-cost";
import { parseRecommendationRequest } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

const ROUTE_WARNING_MODES = new Set<TransportMode>(["walk", "motorcycle"]);

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = parseRecommendationRequest(await request.json().catch(() => null));
    const candidateLimit = boundedInteger(process.env.ROUTE_MATRIX_CANDIDATE_LIMIT, 25, 5, 49);
    const maximumCoordinateAgeDays = boundedInteger(process.env.PREMISE_LOCATION_MAX_AGE_DAYS, 29, 1, 30);
    const maximumStraightLineKm = payload.travel.limit.type === "distance"
      ? payload.travel.limit.value
      : null;

    const candidates = await findNearestPremises({
      latitude: payload.travel.origin.latitude,
      longitude: payload.travel.origin.longitude,
      saraFilter: payload.travel.saraFilter,
      maximumStraightLineKm,
      limit: candidateLimit,
      maximumCoordinateAgeDays,
    });

    if (candidates.length === 0) {
      const coverage = await getPremiseLocationCoverage(maximumCoordinateAgeDays);
      if (coverage.routablePremises > 0 && coverage.freshCoordinates === 0) {
        throw new AppError(
          "PREMISE_LOCATIONS_NOT_READY",
          "Store locations need to be prepared before recommendations can run.",
          503,
        );
      }
    }

    const routeResults = await getMapsProvider().computeRouteMatrix(
      {
        latitude: payload.travel.origin.latitude,
        longitude: payload.travel.origin.longitude,
      },
      candidates.map(candidate => ({ placeId: candidate.googlePlaceId })),
      payload.travel.transportMode,
    );

    const costModel = getTravelCostModel();
    const recommendations = rankReachableStores({
      routes: mergeRouteResults(candidates, routeResults),
      limitType: payload.travel.limit.type,
      limitValue: payload.travel.limit.value,
      costRate: costModel[payload.travel.transportMode],
    });

    const response: RecommendationResponse = {
      recommendations,
      totalCandidatesEvaluated: candidates.length,
      totalReachable: recommendations.length,
      generatedAt: new Date().toISOString(),
      routeProvider: "google",
      rankingMethod: "Lowest estimated return transport cost, then shortest travel time and route distance.",
      costAssumptions: Object.fromEntries(
        Object.entries(costModel).map(([mode, rate]) => [mode, rate.description]),
      ) as Record<TransportMode, string>,
      routeWarning: ROUTE_WARNING_MODES.has(payload.travel.transportMode)
        ? "Walking and motorcycle routes are beta estimates and may omit suitable paths or road restrictions. Check the route before travelling."
        : null,
    };

    return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
