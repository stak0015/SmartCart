"""Backfill normalized pack quantities for existing SmartCart databases.

Fresh databases populate these columns during PriceCatcher ingestion. This
one-off, repeatable migration upgrades older databases without downloading
the source files again.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import psycopg

from ingest_pricecatcher import load_local_env, parse_pack_quantity


ROOT = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        help="PostgreSQL URL; defaults to DATABASE_URL from the environment or .env",
    )
    return parser.parse_args()


def backfill_pack_quantities(connection: psycopg.Connection) -> dict[str, int]:
    """Ensure pack columns exist and recompute them for every item row."""

    with connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE item
                ADD COLUMN IF NOT EXISTS quantity_value NUMERIC(12, 4),
                ADD COLUMN IF NOT EXISTS quantity_unit VARCHAR(8)
            """
        )
        cursor.execute("SELECT item_id, item_name, unit FROM item ORDER BY item_id")
        rows = cursor.fetchall()

        updates: list[tuple[float | None, str | None, int]] = []
        parsed = 0
        for item_id, item_name, unit in rows:
            quantity = parse_pack_quantity(item_name, unit)
            if quantity is None:
                updates.append((None, None, item_id))
                continue
            updates.append((quantity[0], quantity[1], item_id))
            parsed += 1

        if updates:
            cursor.executemany(
                """
                UPDATE item
                   SET quantity_value = %s,
                       quantity_unit = %s
                 WHERE item_id = %s
                """,
                updates,
            )

    return {
        "item_rows_total": len(rows),
        "item_rows_parsed": parsed,
        "item_rows_unparseable": len(rows) - parsed,
    }


def main() -> int:
    load_local_env(ROOT / ".env")
    args = parse_args()
    database_url = args.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env or pass "
            "--database-url."
        )

    print("Backfilling normalized item pack quantities")
    with psycopg.connect(database_url, connect_timeout=10) as connection:
        result = backfill_pack_quantities(connection)
    for key, value in result.items():
        print(f"  {key}: {value:,}")
    print("Pack-quantity migration complete.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
