"""Seed reviewed English names on the canonical PriceCatcher item rows.

``data/item_name_en.csv`` is keyed by stable ``item_code`` rather than the
database identity. A blank official source name remains NULL. Translation
changes are reviewed in the CSV; this script never generates translations.
"""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent
ITEM_NAME_PATH = ROOT / "data" / "item_name_en.csv"


def read_name_seeds(path: Path = ITEM_NAME_PATH) -> dict[str, str | None]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = csv.DictReader(handle)
        if rows.fieldnames != ["item_code", "item_name_original", "item_name_en"]:
            raise ValueError("item_name_en.csv has unexpected columns")
        seeds: dict[str, str | None] = {}
        for row in rows:
            code = (row.get("item_code") or "").strip()
            if not code:
                raise ValueError("item_name_en.csv contains a blank item_code")
            if code in seeds:
                raise ValueError(f"item_name_en.csv contains duplicate item_code {code}")
            value = (row.get("item_name_en") or "").strip()
            seeds[code] = value or None
    return seeds


def seed_item_names(
    connection: psycopg.Connection, path: Path = ITEM_NAME_PATH
) -> dict[str, int]:
    """Apply reviewed labels without fabricating missing English text."""

    seeds = read_name_seeds(path)
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            "ALTER TABLE item ADD COLUMN IF NOT EXISTS item_name_en VARCHAR(500)"
        )
        matched_rows = 0
        for code, name in seeds.items():
            cursor.execute(
                "UPDATE item SET item_name_en = %s WHERE item_code = %s",
                (name, code),
            )
            matched_rows += cursor.rowcount
        cursor.execute(
            """
            SELECT COUNT(*) FROM item
            WHERE NULLIF(BTRIM(item_name), '') IS NOT NULL
              AND NULLIF(BTRIM(item_name_en), '') IS NOT NULL
            """
        )
        labelled_rows = int(cursor.fetchone()[0])
        cursor.execute("SELECT COUNT(*) FROM item")
        item_rows = int(cursor.fetchone()[0])
    return {
        "seed_rows": len(seeds),
        "matched_rows": matched_rows,
        "labelled_rows": labelled_rows,
        "item_rows": item_rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--item-file", type=Path, default=ITEM_NAME_PATH)
    return parser.parse_args()


def main() -> None:
    from ingest_pricecatcher import load_local_env

    load_local_env(ROOT / ".env")
    load_local_env(ROOT.parent / "backend" / ".env")
    args = parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    with psycopg.connect(args.database_url) as connection:
        print(seed_item_names(connection, args.item_file))


if __name__ == "__main__":
    main()
