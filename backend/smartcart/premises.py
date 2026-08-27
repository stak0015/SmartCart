"""Premise candidate queries for transport-first recommendations."""

from dataclasses import dataclass

from .database import database_cursor
from .models import SaraFilter, SaraStoreStatus


@dataclass(frozen=True)
class PremiseCandidate:
    premise_id: str
    premise_code: str
    name: str
    address: str | None
    district: str | None
    state: str | None
    google_place_id: str
    straight_line_distance_km: float
    sara_status: SaraStoreStatus


def find_nearest_premises(
    *,
    latitude: float,
    longitude: float,
    sara_filter: SaraFilter,
    maximum_straight_line_km: float | None,
    limit: int,
    maximum_coordinate_age_days: int,
) -> list[PremiseCandidate]:
    with database_cursor() as cursor:
        cursor.execute(
            """
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
                        POWER(SIN(RADIANS(latitude - %s) / 2), 2) +
                        COS(RADIANS(%s)) * COS(RADIANS(latitude)) *
                        POWER(SIN(RADIANS(longitude - %s) / 2), 2)
                    ))) AS straight_line_distance_km
                FROM premise
                WHERE google_place_id IS NOT NULL
                  AND latitude IS NOT NULL
                  AND longitude IS NOT NULL
                  AND location_refreshed_at >=
                      CURRENT_TIMESTAMP - (%s * INTERVAL '1 day')
                  AND (
                    %s = 'any'
                    OR (%s = 'verified' AND sara_partner IS TRUE)
                    OR (
                        %s = 'candidate'
                        AND (sara_partner IS TRUE OR sara_match_candidate IS TRUE)
                    )
                  )
            )
            SELECT *
            FROM located_premise
            WHERE (%s::DOUBLE PRECISION IS NULL OR straight_line_distance_km <= %s)
            ORDER BY straight_line_distance_km ASC, premise_id ASC
            LIMIT %s
            """,
            (
                latitude,
                latitude,
                longitude,
                maximum_coordinate_age_days,
                sara_filter,
                sara_filter,
                sara_filter,
                maximum_straight_line_km,
                maximum_straight_line_km,
                limit,
            ),
        )
        rows = cursor.fetchall()

    candidates = []
    for row in rows:
        sara_status: SaraStoreStatus = (
            "verified" if row[7] is True else "candidate" if row[8] else "unverified"
        )
        candidates.append(
            PremiseCandidate(
                premise_id=str(row[0]),
                premise_code=row[1],
                name=(row[2] or "").strip() or "Unnamed PriceCatcher premise",
                address=row[3],
                district=row[4],
                state=row[5],
                google_place_id=row[6],
                straight_line_distance_km=float(row[9]),
                sara_status=sara_status,
            )
        )
    return candidates


def get_premise_location_coverage(maximum_coordinate_age_days: int) -> tuple[int, int]:
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE google_place_id IS NOT NULL),
                COUNT(*) FILTER (
                    WHERE google_place_id IS NOT NULL
                      AND latitude IS NOT NULL
                      AND longitude IS NOT NULL
                      AND location_refreshed_at >=
                          CURRENT_TIMESTAMP - (%s * INTERVAL '1 day')
                )
            FROM premise
            """,
            (maximum_coordinate_age_days,),
        )
        row = cursor.fetchone()
    return (int(row[0]), int(row[1])) if row else (0, 0)
