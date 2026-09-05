"""Load optional English/Malay category labels into PostgreSQL."""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent
CATEGORY_TRANSLATION_PATH = ROOT / "data" / "category_translations.csv"


def read_category_translations(
    path: Path = CATEGORY_TRANSLATION_PATH,
) -> list[tuple[str, str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = csv.DictReader(handle)
        return [
            (
                (row.get("category_name") or "").strip(),
                (row.get("locale") or "").strip().lower(),
                (row.get("translated_name") or "").strip(),
            )
            for row in rows
            if (row.get("category_name") or "").strip()
            and (row.get("locale") or "").strip().lower() in {"en", "ms"}
            and (row.get("translated_name") or "").strip()
        ]


def seed_category_translations(
    connection: psycopg.Connection,
    path: Path = CATEGORY_TRANSLATION_PATH,
) -> int:
    rows = read_category_translations(path)
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS category_translation (
                category_name VARCHAR(255) NOT NULL,
                locale VARCHAR(8) NOT NULL CHECK (locale IN ('en', 'ms')),
                translated_name VARCHAR(255) NOT NULL,
                PRIMARY KEY (category_name, locale)
            )
            """
        )
        for category, locale, translated in rows:
            cursor.execute(
                """
                INSERT INTO category_translation
                    (category_name, locale, translated_name)
                VALUES (%s, %s, %s)
                ON CONFLICT (category_name, locale) DO UPDATE SET
                    translated_name = EXCLUDED.translated_name
                """,
                (category, locale, translated),
            )
    return len(rows)


def main() -> None:
    from ingest_pricecatcher import load_local_env

    load_local_env(ROOT / ".env")
    load_local_env(ROOT.parent / "backend" / ".env")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--category-file", type=Path, default=CATEGORY_TRANSLATION_PATH)
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    with psycopg.connect(args.database_url) as connection:
        print({"category_rows": seed_category_translations(connection, args.category_file)})


if __name__ == "__main__":
    main()
