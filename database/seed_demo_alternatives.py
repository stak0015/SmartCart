"""Seed deterministic demo data for cheaper and better-value suggestions.

The script targets ``DEMO_DATABASE_URL`` by default so the official
PriceCatcher database is never modified accidentally. Start the demo
PostgreSQL service with ``docker-compose.demo.yml`` before running it.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

import psycopg

from ingest_pricecatcher import load_local_env


ROOT = Path(__file__).resolve().parent
DEMO_PREMISE_CODE = "SMARTCART-DEMO-STORE"
DEMO_OBSERVED_DATE = date(2026, 9, 1)


@dataclass(frozen=True)
class DemoItem:
    item_code: str
    item_name: str
    unit: str
    item_category: str
    quantity_value: Decimal
    quantity_unit: str
    current_price: Decimal


DEMO_ITEMS = (
    # Same package/category/family, lower price: strict cheaper-equivalent
    # recommendations for both 155 g and 425 g source items.
    DemoItem(
        "SMARTCART-DEMO-SARDINE-155-AYAM",
        "SARDIN CAP AYAM (SOS TOMATO)",
        "155 g",
        "IKAN DALAM TIN",
        Decimal("0.155"),
        "KG",
        Decimal("5.00"),
    ),
    DemoItem(
        "SMARTCART-DEMO-SARDINE-155-KING",
        "SARDIN CAP KING CUP (SOS TOMATO)",
        "155 g",
        "IKAN DALAM TIN",
        Decimal("0.155"),
        "KG",
        Decimal("4.50"),
    ),
    DemoItem(
        "SMARTCART-DEMO-SARDINE-425-AYAM",
        "SARDIN CAP AYAM (SOS TOMATO)",
        "425 g",
        "IKAN DALAM TIN",
        Decimal("0.425"),
        "KG",
        Decimal("10.50"),
    ),
    DemoItem(
        "SMARTCART-DEMO-SARDINE-425-KING",
        "SARDIN CAP KING CUP (SOS TOMATO)",
        "425 g",
        "IKAN DALAM TIN",
        Decimal("0.425"),
        "KG",
        Decimal("9.00"),
    ),
    # Different pack sizes make the better-unit-value cards visible. The 850 g
    # pack is the best value at RM19.00/kg.
    DemoItem(
        "SMARTCART-DEMO-SARDINE-850-AYAM",
        "SARDIN CAP AYAM (SOS TOMATO)",
        "850 g",
        "IKAN DALAM TIN",
        Decimal("0.850"),
        "KG",
        Decimal("16.15"),
    ),
    # Repeat the two behaviors for litre-based products as well.
    DemoItem(
        "SMARTCART-DEMO-OIL-1L-MAZOLA",
        "MINYAK JAGUNG CAP MAZOLA",
        "1 litre",
        "MINYAK DAN LEMAK",
        Decimal("1"),
        "L",
        Decimal("14.00"),
    ),
    DemoItem(
        "SMARTCART-DEMO-OIL-1L-DAISY",
        "MINYAK JAGUNG CAP DAISY",
        "1 litre",
        "MINYAK DAN LEMAK",
        Decimal("1"),
        "L",
        Decimal("12.50"),
    ),
    DemoItem(
        "SMARTCART-DEMO-OIL-2L-MAZOLA",
        "MINYAK JAGUNG CAP MAZOLA",
        "2 litre",
        "MINYAK DAN LEMAK",
        Decimal("2"),
        "L",
        Decimal("24.00"),
    ),
    DemoItem(
        "SMARTCART-DEMO-OIL-2L-DAISY",
        "MINYAK JAGUNG CAP DAISY",
        "2 litre",
        "MINYAK DAN LEMAK",
        Decimal("2"),
        "L",
        Decimal("20.00"),
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        help="Demo PostgreSQL URL; defaults to DEMO_DATABASE_URL from the environment or .env files",
    )
    return parser.parse_args()


def seed_demo_data(connection: psycopg.Connection) -> int:
    """Replace only rows owned by this fixture and return the premise ID."""

    with connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE item
                ADD COLUMN IF NOT EXISTS quantity_value NUMERIC(12, 4),
                ADD COLUMN IF NOT EXISTS quantity_unit VARCHAR(8)
            """
        )
        # Keep the operation repeatable without touching official/non-demo rows
        # if someone points the script at a database that already has data.
        cursor.execute(
            """
            DELETE FROM current_status
            WHERE item_id IN (
                SELECT item_id FROM item
                WHERE item_code LIKE 'SMARTCART-DEMO-%%'
            )
               OR premise_id IN (
                SELECT premise_id FROM premise
                WHERE premise_code = %s
            )
            """,
            (DEMO_PREMISE_CODE,),
        )
        cursor.execute(
            "DELETE FROM item WHERE item_code LIKE 'SMARTCART-DEMO-%%'"
        )
        cursor.execute(
            "DELETE FROM premise WHERE premise_code = %s",
            (DEMO_PREMISE_CODE,),
        )

        cursor.execute(
            """
            INSERT INTO premise (
                premise_code, premise_name, address, district, state,
                google_place_id, latitude, longitude, location_provider,
                location_refreshed_at
            )
            VALUES (
                %s, 'SmartCart Demo Market', 'Demo Street, Kuala Lumpur',
                'Kuala Lumpur', 'WILAYAH PERSEKUTUAN KUALA LUMPUR',
                'demo-smartcart-market', 3.1390, 101.6869, 'demo',
                CURRENT_TIMESTAMP
            )
            RETURNING premise_id
            """,
            (DEMO_PREMISE_CODE,),
        )
        premise_id = int(cursor.fetchone()[0])

        for item in DEMO_ITEMS:
            cursor.execute(
                """
                INSERT INTO item (
                    item_code, item_name, unit, item_group, item_category,
                    sara_eligible, quantity_value, quantity_unit
                )
                VALUES (%s, %s, %s, 'SmartCart demo', %s, NULL, %s, %s)
                RETURNING item_id
                """,
                (
                    item.item_code,
                    item.item_name,
                    item.unit,
                    item.item_category,
                    item.quantity_value,
                    item.quantity_unit,
                ),
            )
            item_id = int(cursor.fetchone()[0])
            cursor.execute(
                """
                INSERT INTO current_status (
                    item_id, premise_id, current_price, price_observed_date
                )
                VALUES (%s, %s, %s, %s)
                """,
                (item_id, premise_id, item.current_price, DEMO_OBSERVED_DATE),
            )

    return premise_id


def main() -> int:
    # Load the database-local .env first, then the backend .env for its
    # DEMO_DATABASE_URL when the caller has not supplied process environment
    # values. Existing process variables always win.
    load_local_env(ROOT / ".env")
    load_local_env(ROOT.parent / "backend" / ".env")
    args = parse_args()
    database_url = args.database_url or os.getenv("DEMO_DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DEMO_DATABASE_URL is not set. Start the demo database or pass "
            "--database-url explicitly."
        )

    print("Seeding SmartCart demo alternatives")
    with psycopg.connect(database_url, connect_timeout=10) as connection:
        premise_id = seed_demo_data(connection)
    print(f"  premise_id: {premise_id}")
    print(f"  item_rows_seeded: {len(DEMO_ITEMS):,}")
    print("Demo seed complete.")
    print("Cheaper-equivalent cases: sardine and corn-oil same-pack swaps.")
    print("Best unit-value cases: 850 g sardine and 2 litre corn-oil packs.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1) from error
