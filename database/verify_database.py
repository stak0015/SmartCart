"""Run post-ingestion integrity and freshness checks for SmartCart PostgreSQL."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg

from ingest_pricecatcher import load_local_env


ROOT = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        help="PostgreSQL URL; defaults to DATABASE_URL from the environment or .env",
    )
    return parser.parse_args()


def main() -> int:
    load_local_env(ROOT / ".env")
    args = parse_args()
    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env or pass "
            "--database-url."
        )

    with psycopg.connect(
        database_url, connect_timeout=10
    ) as connection, connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM item")
        item_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM premise")
        premise_count = cursor.fetchone()[0]
        cursor.execute(
            """
            SELECT
                COUNT(*),
                MIN(price_observed_date),
                MAX(price_observed_date),
                COUNT(*) FILTER (WHERE current_price <= 0)
            FROM current_status
            """
        )
        status_count, min_date, max_date, invalid_prices = cursor.fetchone()
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM current_status AS cs
            LEFT JOIN item AS i ON i.item_id = cs.item_id
            LEFT JOIN premise AS p ON p.premise_id = cs.premise_id
            WHERE i.item_id IS NULL OR p.premise_id IS NULL
            """
        )
        orphan_count = cursor.fetchone()[0]
        cursor.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE google_place_id IS NOT NULL),
                COUNT(*) FILTER (WHERE sara_match_candidate IS TRUE),
                COUNT(*) FILTER (WHERE sara_partner IS TRUE),
                COUNT(*) FILTER (WHERE sara_partner IS FALSE)
            FROM premise
            """
        )
        (
            place_id_count,
            sara_candidate_count,
            sara_partner_count,
            explicit_nonpartner_count,
        ) = cursor.fetchone()

    print(f"item rows: {item_count:,}")
    print(f"premise rows: {premise_count:,}")
    print(f"current_status rows: {status_count:,}")
    print(f"price observation range: {min_date} to {max_date}")
    print(f"invalid non-positive prices: {invalid_prices:,}")
    print(f"orphan current_status rows: {orphan_count:,}")
    print(f"premises with a candidate/retained Place ID: {place_id_count:,}")
    print(f"one-to-one SARA candidates requiring review: {sara_candidate_count:,}")
    print(f"verified SARA partner premises: {sara_partner_count:,}")

    failures = []
    if not item_count or not premise_count or not status_count:
        failures.append("one or more required tables are empty")
    if invalid_prices:
        failures.append("current_status contains non-positive prices")
    if orphan_count:
        failures.append("current_status contains orphan foreign keys")
    if explicit_nonpartner_count:
        failures.append(
            "premises are marked as non-partners; unknown SARA status must be NULL"
        )
    if failures:
        print("Verification failed: " + "; ".join(failures), file=sys.stderr)
        return 1
    print("Verification passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
