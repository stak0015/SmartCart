import "server-only";

import type { SaraFilter, SaraStoreStatus } from "@/lib/contracts";
import { getPool } from "./db";

export interface PremiseCandidate {
  premiseId: string;
  premiseCode: string;
  name: string;
  address: string | null;
  district: string | null;
  state: string | null;
  googlePlaceId: string;
  straightLineDistanceKm: number;
  saraStatus: SaraStoreStatus;
}

interface CandidateRow {
  premise_id: string;
  premise_code: string;
  premise_name: string | null;
  address: string | null;
  district: string | null;
  state: string | null;
  google_place_id: string;
  straight_line_distance_km: string;
  sara_partner: boolean | null;
  sara_match_candidate: boolean;
}

export async function findNearestPremises(options: {
  latitude: number;
  longitude: number;
  saraFilter: SaraFilter;
  maximumStraightLineKm: number | null;
  limit: number;
  maximumCoordinateAgeDays: number;
}): Promise<PremiseCandidate[]> {
  const result = await getPool().query<CandidateRow>(
    `
      WITH located_premise AS (
        SELECT
          premise_id,
          premise_code,
          premise_name,
          address,
          district,
          state,
          google_place_id,
          sara_partner,
          sara_match_candidate,
          6371 * 2 * ASIN(SQRT(LEAST(1,
            POWER(SIN(RADIANS(latitude - $1) / 2), 2) +
            COS(RADIANS($1)) * COS(RADIANS(latitude)) *
            POWER(SIN(RADIANS(longitude - $2) / 2), 2)
          ))) AS straight_line_distance_km
        FROM premise
        WHERE google_place_id IS NOT NULL
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND location_refreshed_at >= CURRENT_TIMESTAMP - ($6 * INTERVAL '1 day')
          AND (
            $3 = 'any'
            OR ($3 = 'verified' AND sara_partner IS TRUE)
            OR ($3 = 'candidate' AND (sara_partner IS TRUE OR sara_match_candidate IS TRUE))
          )
      )
      SELECT *
      FROM located_premise
      WHERE ($4::DOUBLE PRECISION IS NULL OR straight_line_distance_km <= $4)
      ORDER BY straight_line_distance_km ASC, premise_id ASC
      LIMIT $5
    `,
    [
      options.latitude,
      options.longitude,
      options.saraFilter,
      options.maximumStraightLineKm,
      options.limit,
      options.maximumCoordinateAgeDays,
    ],
  );

  return result.rows.map(row => ({
    premiseId: row.premise_id,
    premiseCode: row.premise_code,
    name: row.premise_name?.trim() || "Unnamed PriceCatcher premise",
    address: row.address,
    district: row.district,
    state: row.state,
    googlePlaceId: row.google_place_id,
    straightLineDistanceKm: Number(row.straight_line_distance_km),
    saraStatus: row.sara_partner === true
      ? "verified"
      : row.sara_match_candidate
        ? "candidate"
        : "unverified",
  }));
}

export async function getPremiseLocationCoverage(maximumCoordinateAgeDays: number): Promise<{
  routablePremises: number;
  freshCoordinates: number;
}> {
  const result = await getPool().query<{
    routable_premises: string;
    fresh_coordinates: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE google_place_id IS NOT NULL) AS routable_premises,
        COUNT(*) FILTER (
          WHERE google_place_id IS NOT NULL
            AND latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND location_refreshed_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
        ) AS fresh_coordinates
      FROM premise
    `,
    [maximumCoordinateAgeDays],
  );

  return {
    routablePremises: Number(result.rows[0]?.routable_premises ?? 0),
    freshCoordinates: Number(result.rows[0]?.fresh_coordinates ?? 0),
  };
}
