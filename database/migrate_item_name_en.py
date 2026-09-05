"""Migrate English item labels out of the retired translation table.

The PriceCatcher lookup is represented by the ``item`` table in SmartCart.
English labels therefore live on that row, keyed by the stable item code.  The
migration is safe to rerun: it only fills an empty label from an existing
English ``item_translation`` row, then removes that obsolete table.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent


def migrate_item_name_en(connection: psycopg.Connection) -> dict[str, int]:
    """Add the canonical column and migrate legacy English rows once."""

    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE item
                ADD COLUMN IF NOT EXISTS item_name_en VARCHAR(500)
            """
        )
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = 'item_translation'
            )
            """
        )
        legacy_exists = bool(cursor.fetchone()[0])
        migrated_rows = 0
        dropped_legacy = 0
        if legacy_exists:
            cursor.execute(
                """
                UPDATE item AS i
                SET item_name_en = NULLIF(BTRIM(t.item_name), '')
                FROM item_translation AS t
                WHERE t.item_id = i.item_id
                  AND t.locale = 'en'
                  AND NULLIF(BTRIM(t.item_name), '') IS NOT NULL
                  AND NULLIF(BTRIM(i.item_name_en), '') IS NULL
                """
            )
            migrated_rows = cursor.rowcount
            cursor.execute("DROP TABLE item_translation")
            dropped_legacy = 1
        cursor.execute(
            """
            SELECT COUNT(*) FROM item
            WHERE NULLIF(BTRIM(item_name), '') IS NOT NULL
              AND NULLIF(BTRIM(item_name_en), '') IS NOT NULL
            """
        )
        labelled_rows = int(cursor.fetchone()[0])
    return {
        "legacy_rows_migrated": migrated_rows,
        "labelled_rows": labelled_rows,
        "legacy_table_dropped": dropped_legacy,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    return parser.parse_args()


def main() -> None:
    from ingest_pricecatcher import load_local_env

    load_local_env(ROOT / ".env")
    load_local_env(ROOT.parent / "backend" / ".env")
    args = parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    with psycopg.connect(args.database_url) as connection:
        print(migrate_item_name_en(connection))


if __name__ == "__main__":
    main()
