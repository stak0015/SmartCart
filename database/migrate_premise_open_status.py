"""Import the maintained premise Place details snapshot.

The default CSV is produced by ``enrich_lookup_premise_postcodes_places.py``.
Its adjacent raw cache contains the selected Place-details coordinates that
are intentionally omitted from the CSV. This repeatable migration performs no
provider requests. It can target local PostgreSQL or Neon by passing the
appropriate ``--database-url``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import psycopg

from ingest_pricecatcher import copy_frame, load_local_env, normalise_code, require_columns


ROOT = Path(__file__).resolve().parent
PREMISE_OPEN_STATUS_PATH = (
    ROOT / "data" / "raw" / "lookup_premise_enriched_postcode_place_id.csv"
)
PREMISE_PLACE_CACHE_PATH = (
    ROOT
    / "data"
    / "raw"
    / "lookup_premise_enriched_postcode_place_id.cache.json"
)
ALLOWED_OPEN_CLOSED_STATUSES = frozenset(
    {"open", "closed_permanently", "closed_temporarily", "unknown"}
)
ALLOWED_PLACE_MATCH_DECISIONS = frozenset(
    {
        "accepted",
        "needs_review",
        "rejected",
        "no_result",
        "error",
        "not_attempted_no_postcode",
        "not_attempted_no_name_or_postcode",
    }
)


def snapshot_generated_at(path: Path) -> pd.Timestamp:
    """Read the enrichment generation time from the adjacent provenance file."""

    provenance_path = path.with_suffix(".provenance.json")
    if not provenance_path.is_file():
        raise FileNotFoundError(
            f"premise status provenance not found: {provenance_path}"
        )
    provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    generated_at = pd.to_datetime(
        provenance.get("generated_at"), errors="raise", utc=True
    )
    if pd.isna(generated_at):
        raise ValueError("premise status provenance has no generated_at value")
    return generated_at


def load_premise_open_status(path: Path) -> pd.DataFrame:
    """Validate and normalize the code-keyed CSV without contacting Google."""

    if not path.is_file():
        raise FileNotFoundError(f"premise status snapshot not found: {path}")
    frame = pd.read_csv(path, dtype="string")
    require_columns(
        frame,
        {"premise_code", "place_id", "open_closed_status"},
        "premise status snapshot",
    )
    frame = frame.loc[
        :, ["premise_code", "place_id", "open_closed_status"]
    ].copy()
    frame["premise_code"] = normalise_code(
        frame["premise_code"], "premise status premise_code"
    )
    frame = frame.dropna(subset=["premise_code"])
    if frame["premise_code"].duplicated().any():
        raise ValueError("premise status snapshot contains duplicate premise_code values")

    for column in ("place_id", "open_closed_status"):
        frame[column] = frame[column].astype("string").str.strip()
        frame.loc[frame[column] == "", column] = pd.NA
    frame["open_closed_status"] = frame["open_closed_status"].str.lower()
    invalid_statuses = sorted(
        set(frame["open_closed_status"].dropna()) - ALLOWED_OPEN_CLOSED_STATUSES
    )
    if invalid_statuses:
        raise ValueError(
            f"premise status snapshot contains invalid statuses: {invalid_statuses}"
        )

    generated_at = snapshot_generated_at(path)
    frame.rename(columns={"place_id": "google_place_id"}, inplace=True)
    frame["place_status_refreshed_at"] = generated_at
    return frame.loc[
        :,
        [
            "premise_code",
            "google_place_id",
            "open_closed_status",
            "place_status_refreshed_at",
        ],
    ]


def load_premise_coordinates(
    path: Path, status_rows: pd.DataFrame
) -> pd.DataFrame:
    """Load selected Place coordinates, never postcode-geocoding coordinates.

    The cache has both ``geocode_*`` fields (used only to discover a postcode)
    and ``place_*`` fields returned for the selected Places search candidate.
    Only the latter can describe the premise represented by ``place_id``. The
    Place ID is cross-checked against the companion CSV before any coordinate
    is prepared for import.

    The cache format has one generation time rather than per-row retrieval
    times. It is the last provider-cache timestamp available for this snapshot
    and remains subject to the normal Google coordinate TTL. Rows without a
    selected Place coordinate are retained with NULL location fields so the
    import clears coordinates left by an older Place match.
    """

    if not path.is_file():
        raise FileNotFoundError(f"premise Place cache not found: {path}")
    try:
        body = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"premise Place cache is not valid JSON: {path}") from error
    if not isinstance(body, dict) or not isinstance(body.get("results"), dict):
        raise ValueError("premise Place cache must contain a results object")

    generated_at = pd.to_datetime(
        body.get("generated_at"), errors="raise", utc=True
    )
    if pd.isna(generated_at):
        raise ValueError("premise Place cache has no generated_at value")

    records: list[dict[str, object]] = []
    for result in body["results"].values():
        if not isinstance(result, dict):
            raise ValueError("premise Place cache contains a non-object result")
        records.append(
            {
                "premise_code": result.get("premise_code"),
                "coordinate_google_place_id": result.get("place_id"),
                "place_match_decision": result.get("place_match_decision"),
                "coordinate_open_closed_status": result.get(
                    "place_open_closed_status"
                ),
                "latitude": result.get("place_latitude"),
                "longitude": result.get("place_longitude"),
            }
        )

    frame = pd.DataFrame.from_records(
        records,
        columns=[
            "premise_code",
            "coordinate_google_place_id",
            "place_match_decision",
            "coordinate_open_closed_status",
            "latitude",
            "longitude",
        ],
    )
    frame["premise_code"] = normalise_code(
        frame["premise_code"].astype("string"), "premise coordinate premise_code"
    )
    frame = frame.dropna(subset=["premise_code"])
    if frame["premise_code"].duplicated().any():
        raise ValueError("premise Place cache contains duplicate premise_code values")

    frame["coordinate_google_place_id"] = (
        frame["coordinate_google_place_id"].astype("string").str.strip()
    )
    frame.loc[
        frame["coordinate_google_place_id"] == "", "coordinate_google_place_id"
    ] = pd.NA
    frame["place_match_decision"] = (
        frame["place_match_decision"].astype("string").str.strip().str.lower()
    )
    frame.loc[frame["place_match_decision"] == "", "place_match_decision"] = pd.NA
    missing_decision = frame["place_match_decision"].isna()
    if missing_decision.any():
        raise ValueError(
            "premise Place cache is missing place_match_decision values"
        )
    invalid_decisions = sorted(
        set(frame["place_match_decision"]) - ALLOWED_PLACE_MATCH_DECISIONS
    )
    if invalid_decisions:
        raise ValueError(
            "premise Place cache contains invalid place_match_decision values: "
            f"{invalid_decisions}"
        )
    frame["coordinate_open_closed_status"] = (
        frame["coordinate_open_closed_status"].astype("string").str.strip().str.lower()
    )
    frame.loc[
        frame["coordinate_open_closed_status"] == "",
        "coordinate_open_closed_status",
    ] = pd.NA

    for column in ("latitude", "longitude"):
        raw_values = frame[column]
        converted = pd.to_numeric(raw_values, errors="coerce")
        malformed = raw_values.notna() & converted.isna()
        if malformed.any():
            raise ValueError(
                f"premise Place cache contains a non-numeric {column}"
            )
        frame[column] = converted

    partial_pairs = frame["latitude"].isna() != frame["longitude"].isna()
    if partial_pairs.any():
        raise ValueError("premise Place cache contains an incomplete coordinate pair")
    coordinates_without_place = (
        frame["latitude"].notna() & frame["coordinate_google_place_id"].isna()
    )
    if coordinates_without_place.any():
        raise ValueError("premise Place cache has coordinates without a selected place_id")
    if (~frame["latitude"].dropna().between(-90, 90)).any():
        raise ValueError("premise Place cache contains latitude outside -90..90")
    if (~frame["longitude"].dropna().between(-180, 180)).any():
        raise ValueError("premise Place cache contains longitude outside -180..180")

    require_columns(
        status_rows,
        {"premise_code", "google_place_id", "open_closed_status"},
        "prepared premise status",
    )
    expected = status_rows.loc[
        :, ["premise_code", "google_place_id", "open_closed_status"]
    ].copy()
    checked = frame.merge(
        expected,
        on="premise_code",
        how="left",
        validate="one_to_one",
        indicator=True,
    )
    if checked["_merge"].ne("both").any():
        raise ValueError(
            "premise Place cache premise codes do not match the companion CSV"
        )
    mismatched_place_ids = (
        checked["coordinate_google_place_id"].fillna("")
        != checked["google_place_id"].fillna("")
    )
    if mismatched_place_ids.any():
        raise ValueError(
            "premise Place cache coordinates do not match the companion CSV place_id"
        )
    mismatched_statuses = (
        checked["coordinate_open_closed_status"].fillna("")
        != checked["open_closed_status"].fillna("")
    )
    if mismatched_statuses.any():
        raise ValueError(
            "premise Place cache business status does not match the companion CSV"
        )

    prepared = checked.loc[
        :,
        [
            "premise_code",
            "coordinate_google_place_id",
            "place_match_decision",
            "open_closed_status",
            "latitude",
            "longitude",
        ],
    ].copy()
    prepared.rename(
        columns={"coordinate_google_place_id": "google_place_id"}, inplace=True
    )
    has_coordinates = prepared["latitude"].notna()
    retain_coordinates = (
        has_coordinates
        & prepared["open_closed_status"].eq("open")
        & prepared["place_match_decision"].ne("rejected")
    )
    prepared.loc[~retain_coordinates, ["latitude", "longitude"]] = pd.NA
    prepared["location_provider"] = pd.Series(
        pd.NA, index=prepared.index, dtype="string"
    )
    prepared.loc[retain_coordinates, "location_provider"] = "google"
    prepared["location_refreshed_at"] = pd.Series(
        [generated_at if retain else pd.NaT for retain in retain_coordinates],
        index=prepared.index,
        dtype="datetime64[ns, UTC]",
    )
    prepared["cache_generated_at"] = generated_at
    return prepared.reset_index(drop=True)


def apply_premise_open_status(
    connection: psycopg.Connection,
    status_rows: pd.DataFrame,
    coordinate_rows: pd.DataFrame,
) -> dict[str, int]:
    """Upgrade the schema and import the Place snapshot by premise code."""

    require_columns(
        status_rows,
        {
            "premise_code",
            "google_place_id",
            "open_closed_status",
            "place_status_refreshed_at",
        },
        "prepared premise status",
    )
    require_columns(
        coordinate_rows,
        {
            "premise_code",
            "google_place_id",
            "place_match_decision",
            "open_closed_status",
            "latitude",
            "longitude",
            "location_provider",
            "location_refreshed_at",
            "cache_generated_at",
        },
        "prepared premise coordinates",
    )
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE premise
                ADD COLUMN IF NOT EXISTS open_closed_status VARCHAR(32),
                ADD COLUMN IF NOT EXISTS place_status_refreshed_at TIMESTAMPTZ;
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'premise_open_closed_status_check'
                      AND conrelid = 'premise'::regclass
                ) THEN
                    ALTER TABLE premise
                        ADD CONSTRAINT premise_open_closed_status_check
                        CHECK (
                            open_closed_status IS NULL
                            OR open_closed_status IN (
                                'open',
                                'closed_permanently',
                                'closed_temporarily',
                                'unknown'
                            )
                        );
                END IF;
            END
            $$;
            COMMENT ON COLUMN premise.open_closed_status IS
                'Last imported Google Places business-state label for the automated Place candidate. Only open is eligible for display; NULL and unknown are not claims that a store is open.';
            COMMENT ON COLUMN premise.place_status_refreshed_at IS
                'Snapshot generation time for open_closed_status; this is not a live opening-hours check.';
            CREATE INDEX IF NOT EXISTS premise_open_closed_status_idx
                ON premise (open_closed_status);
            CREATE TEMP TABLE stage_premise_open_status (
                premise_code TEXT,
                google_place_id TEXT,
                open_closed_status TEXT,
                place_status_refreshed_at TIMESTAMPTZ
            ) ON COMMIT DROP;
            CREATE TEMP TABLE stage_premise_coordinates (
                premise_code TEXT,
                google_place_id TEXT,
                place_match_decision TEXT,
                open_closed_status TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                location_provider TEXT,
                location_refreshed_at TIMESTAMPTZ,
                cache_generated_at TIMESTAMPTZ
            ) ON COMMIT DROP;
            """
        )
        copy_frame(cursor, "stage_premise_open_status", status_rows)
        copy_frame(cursor, "stage_premise_coordinates", coordinate_rows)
        cursor.execute(
            """
            UPDATE premise AS p
            SET
                google_place_id = COALESCE(e.google_place_id, p.google_place_id),
                open_closed_status = e.open_closed_status,
                place_status_refreshed_at = e.place_status_refreshed_at
            FROM stage_premise_open_status AS e
            WHERE p.premise_code = e.premise_code
            """
        )
        updated_rows = cursor.rowcount
        cursor.execute(
            """
            UPDATE premise AS p
            SET place_match_refreshed_at = e.cache_generated_at
            FROM stage_premise_coordinates AS e
            WHERE p.premise_code = e.premise_code
              AND e.google_place_id IS NOT NULL
              AND e.place_match_decision <> 'rejected'
              AND p.google_place_id = e.google_place_id
              AND (
                  p.place_match_refreshed_at IS NULL
                  OR p.place_match_refreshed_at <= e.cache_generated_at
              )
            """
        )
        place_match_timestamps_updated = cursor.rowcount
        cursor.execute(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE p.premise_id IS NOT NULL
                      AND e.latitude IS NOT NULL
                      AND (
                          p.location_refreshed_at IS NULL
                          OR p.location_refreshed_at <= e.cache_generated_at
                      )
                ),
                COUNT(*) FILTER (
                    WHERE p.premise_id IS NOT NULL
                      AND e.latitude IS NOT NULL
                      AND p.location_refreshed_at > e.cache_generated_at
                ),
                COUNT(*) FILTER (
                    WHERE p.premise_id IS NOT NULL
                      AND e.latitude IS NULL
                      AND e.place_match_decision <> 'rejected'
                      AND p.location_provider = 'google'
                      AND (
                          p.location_refreshed_at IS NULL
                          OR p.location_refreshed_at <= e.cache_generated_at
                      )
                      AND (
                          p.latitude IS NOT NULL
                          OR p.longitude IS NOT NULL
                          OR p.location_provider IS NOT NULL
                          OR p.location_refreshed_at IS NOT NULL
                      )
                ),
                COUNT(*) FILTER (
                    WHERE p.premise_id IS NOT NULL
                      AND e.latitude IS NULL
                      AND e.place_match_decision <> 'rejected'
                      AND p.location_provider = 'google'
                      AND p.location_refreshed_at > e.cache_generated_at
                ),
                COUNT(*) FILTER (WHERE p.premise_id IS NULL)
            FROM stage_premise_coordinates AS e
            LEFT JOIN premise AS p ON p.premise_code = e.premise_code
            """
        )
        (
            coordinate_rows_set,
            newer_open_coordinate_rows_preserved,
            google_coordinate_rows_cleared,
            newer_non_open_google_coordinates_preserved,
            coordinate_rows_without_database_premise,
        ) = cursor.fetchone()
        cursor.execute(
            """
            UPDATE premise AS p
            SET
                latitude = e.latitude,
                longitude = e.longitude,
                location_provider = e.location_provider,
                location_refreshed_at = e.location_refreshed_at
            FROM stage_premise_coordinates AS e
            WHERE p.premise_code = e.premise_code
              AND e.latitude IS NOT NULL
              AND (
                  p.location_refreshed_at IS NULL
                  OR p.location_refreshed_at <= e.cache_generated_at
              )
            """
        )
        coordinate_rows_updated = cursor.rowcount
        cursor.execute(
            """
            UPDATE premise AS p
            SET
                latitude = NULL,
                longitude = NULL,
                location_provider = NULL,
                location_refreshed_at = NULL
            FROM stage_premise_coordinates AS e
            WHERE p.premise_code = e.premise_code
              AND e.latitude IS NULL
              AND e.place_match_decision <> 'rejected'
              AND p.location_provider = 'google'
              AND (
                  p.location_refreshed_at IS NULL
                  OR p.location_refreshed_at <= e.cache_generated_at
              )
            """
        )
        cleared_rows_updated = cursor.rowcount
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM stage_premise_coordinates AS e
            JOIN premise AS p ON p.premise_code = e.premise_code
            WHERE e.place_match_decision = 'rejected'
              AND (
                  p.google_place_id IS NOT NULL
                  OR p.open_closed_status IS NOT NULL
                  OR p.place_status_refreshed_at IS NOT NULL
                  OR p.place_match_refreshed_at IS NOT NULL
                  OR p.latitude IS NOT NULL
                  OR p.longitude IS NOT NULL
                  OR p.location_provider IS NOT NULL
                  OR p.location_refreshed_at IS NOT NULL
              )
            """
        )
        rejected_rows_with_existing_data = cursor.fetchone()[0]
        cursor.execute(
            """
            UPDATE premise AS p
            SET
                google_place_id = NULL,
                open_closed_status = NULL,
                place_status_refreshed_at = NULL,
                place_match_refreshed_at = NULL,
                latitude = NULL,
                longitude = NULL,
                location_provider = NULL,
                location_refreshed_at = NULL
            FROM stage_premise_coordinates AS e
            WHERE p.premise_code = e.premise_code
              AND e.place_match_decision = 'rejected'
            """
        )
        rejected_rows_cleared = cursor.rowcount
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM stage_premise_coordinates AS e
            JOIN premise AS p ON p.premise_code = e.premise_code
            WHERE e.place_match_decision = 'rejected'
              AND (
                  p.google_place_id IS NOT NULL
                  OR p.open_closed_status IS NOT NULL
                  OR p.place_status_refreshed_at IS NOT NULL
                  OR p.place_match_refreshed_at IS NOT NULL
                  OR p.latitude IS NOT NULL
                  OR p.longitude IS NOT NULL
                  OR p.location_provider IS NOT NULL
                  OR p.location_refreshed_at IS NOT NULL
              )
            """
        )
        rejected_rows_remaining = cursor.fetchone()[0]
        cursor.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE p.premise_id IS NULL),
                COUNT(*) FILTER (
                    WHERE p.premise_id IS NOT NULL
                      AND e.open_closed_status = 'open'
                      AND c.place_match_decision IS DISTINCT FROM 'rejected'
                ),
                COUNT(*) FILTER (
                    WHERE p.premise_id IS NOT NULL
                      AND e.open_closed_status IS DISTINCT FROM 'open'
                ),
                COUNT(*) FILTER (
                    WHERE p.premise_id IS NOT NULL
                      AND e.open_closed_status = 'open'
                      AND c.place_match_decision = 'rejected'
                )
            FROM stage_premise_open_status AS e
            LEFT JOIN stage_premise_coordinates AS c
                ON c.premise_code = e.premise_code
            LEFT JOIN premise AS p ON p.premise_code = e.premise_code
            """
        )
        (
            missing_rows,
            open_rows,
            excluded_rows,
            open_rejected_rows,
        ) = cursor.fetchone()

    return {
        "premise_rows_updated": updated_rows,
        "open_premise_rows": open_rows,
        "not_open_or_unknown_premise_rows": excluded_rows,
        "open_rejected_premise_rows": open_rejected_rows,
        "snapshot_rows_without_database_premise": missing_rows,
        "place_match_timestamps_updated": place_match_timestamps_updated,
        "coordinate_rows_updated": coordinate_rows_updated,
        "coordinate_rows_set": coordinate_rows_set,
        "google_coordinate_rows_cleared": google_coordinate_rows_cleared,
        "cleared_rows_updated": cleared_rows_updated,
        "rejected_place_match_rows": int(
            coordinate_rows["place_match_decision"].eq("rejected").sum()
        ),
        "rejected_rows_with_existing_data": rejected_rows_with_existing_data,
        "rejected_rows_cleared": rejected_rows_cleared,
        "rejected_rows_remaining": rejected_rows_remaining,
        "newer_open_coordinate_rows_preserved": (
            newer_open_coordinate_rows_preserved
        ),
        "newer_non_open_google_coordinates_preserved": (
            newer_non_open_google_coordinates_preserved
        ),
        "coordinate_rows_without_database_premise": (
            coordinate_rows_without_database_premise
        ),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        help="PostgreSQL URL; defaults to DATABASE_URL from the environment or .env",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=PREMISE_OPEN_STATUS_PATH,
        help="Enriched premise CSV (default: maintained data/raw snapshot)",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=PREMISE_PLACE_CACHE_PATH,
        help="Raw enrichment cache containing selected Place coordinates",
    )
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Validate the snapshot without connecting to PostgreSQL",
    )
    return parser.parse_args()


def main() -> int:
    load_local_env(ROOT / ".env")
    args = parse_args()
    print(f"Validating premise status snapshot: {args.input}")
    status_rows = load_premise_open_status(args.input)
    print(f"Validating premise Place coordinate cache: {args.cache}")
    coordinate_rows = load_premise_coordinates(args.cache, status_rows)
    print(f"  snapshot_rows: {len(status_rows):,}")
    print(
        "  open_rows: "
        f"{int(status_rows['open_closed_status'].eq('open').sum()):,}"
    )
    print(
        "  retained_open_place_coordinate_rows: "
        f"{int(coordinate_rows['latitude'].notna().sum()):,}"
    )
    print(
        "  rejected_place_match_rows: "
        f"{int(coordinate_rows['place_match_decision'].eq('rejected').sum()):,}"
    )
    print(
        "  rows_without_retained_open_coordinates: "
        f"{int(coordinate_rows['latitude'].isna().sum()):,}"
    )
    if args.prepare_only:
        print("Prepare-only run complete; PostgreSQL was not changed.")
        return 0

    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env or pass "
            "--database-url."
        )
    target = urlparse(database_url)
    print(
        "Database target: "
        f"{target.hostname or '<unknown>'}/{target.path.lstrip('/') or '<unknown>'}"
    )
    print("Applying premise Place snapshot to PostgreSQL")
    with psycopg.connect(database_url, connect_timeout=10) as connection:
        result = apply_premise_open_status(connection, status_rows, coordinate_rows)
    for key, value in result.items():
        print(f"  {key}: {value:,}")
    print("Premise Place migration complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
