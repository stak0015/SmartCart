"""Backfill cached cross-store median prices for existing SmartCart databases.

Fresh databases add and refresh ``item.median_price_rm`` during ingestion. This
repeatable migration upgrades an existing database and computes the cache from
all positive latest item-premise prices already stored in ``current_status``;
it does not download PriceCatcher files.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg

from ingest_pricecatcher import load_local_env


ROOT = Path(__file__).resolve().parent


def backfill_median_prices(connection: psycopg.Connection) -> dict[str, int]:
    """Ensure the cache column exists and recompute it for every item row."""

    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE item
                ADD COLUMN IF NOT EXISTS median_price_rm NUMERIC(12, 2)
            """
        )
        cursor.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'item_median_price_positive'
                      AND conrelid = 'item'::regclass
                ) THEN
                    ALTER TABLE item ADD CONSTRAINT item_median_price_positive
                        CHECK (median_price_rm IS NULL OR median_price_rm > 0);
                END IF;
            END
            $$;
            """
        )
        cursor.execute(
            """
            COMMENT ON COLUMN item.median_price_rm IS
                'Cached continuous median of positive current_status prices across premises for this item, rounded to cents; NULL when no price exists.'
            """
        )
        cursor.execute("UPDATE item SET median_price_rm = NULL")
        cleared_rows = cursor.rowcount
        cursor.execute(
            """
            UPDATE item AS i
            SET median_price_rm = medians.median_price_rm
            FROM (
                SELECT item_id,
                       ROUND(
                           (
                               percentile_cont(0.5)
                               WITHIN GROUP (ORDER BY current_price)
                           )::numeric,
                           2
                       ) AS median_price_rm
                FROM current_status
                WHERE current_price > 0
                GROUP BY item_id
            ) AS medians
            WHERE i.item_id = medians.item_id
            """
        )
        refreshed_rows = cursor.rowcount

    return {
        "item_rows_cleared": cleared_rows,
        "item_rows_with_medians": refreshed_rows,
    }


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

    print("Backfilling cached item median prices")
    with psycopg.connect(database_url, connect_timeout=10) as connection:
        result = backfill_median_prices(connection)
    for key, value in result.items():
        print(f"  {key}: {value:,}")
    print("Median-price migration complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
