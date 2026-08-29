"""Epic 1 catalogue database queries."""

import re
from typing import Any

from .database import database_cursor

# Query-time parsing of brand and package size from item_name (the item table
# has no dedicated columns). Anything that cannot be parsed confidently is
# returned as None so the frontend can show "—" instead of an invented value.
_BRAND_MARKER = re.compile(r"\b(?:CAP|JENAMA)\s+(.+?)\s*(?:\(|$)", re.IGNORECASE)
_PACKAGE_SIZE = re.compile(
    r"(\d+\s?[Xx]\s?\d+(?:\.\d+)?\s?(?:KG|G|GM|ML|L)\b"  # multipack, e.g. 5X79G
    r"|\d+(?:\.\d+)?\s?(?:KG|G|GM|ML|L|LITER|LITRE|CM)\b"  # e.g. 850G, 15CM
    r"|\d+\s?(?:PADS|SHEETS|LOZENGES)\b"  # e.g. 8 PADS
    r"|\d+S\b)",  # count pack, e.g. 10S
    re.IGNORECASE,
)
_WEIGHT_RANGE = re.compile(r"BERAT\s+[\d.]+\s?GM\s+HINGGA", re.IGNORECASE)

# Conservative category-level candidates derived from the official SARA 2026
# categories and examples. This is intentionally not item-level verification:
# shoppers must still confirm the SARA shelf label or barcode in MyKasih.
SARA_CATEGORY_SOURCE = {
    "url": "https://sara.gov.my/en/home.html",
    "programmeYear": 2026,
    "reviewedAt": "2026-08-28",
}
SARA_CATEGORY_CANDIDATES = frozenset(
    {
        "ALAT TULIS DAN BAHAN BACAAN",
        "BAHAN-BAHAN MINUMAN",
        "BERAS",
        "BERUS GIGI",
        "BIHUN",
        "BISKUT",
        "CILI KERING",
        "COKLAT",
        "ESEN DAN RAGI",
        "GULA",
        "IKAN DALAM TIN",
        "KELAPA",
        "KICAP DAN SOS",
        "KRIMER DAN SUSU TEPUNG",
        "LAMPIN PAKAI BUANG",
        "MEE / BIHUN / KUEY TEOW",
        "MEE/KUETIAU",
        "MENTEGA",
        "MI SEGERA",
        "MINUMAN",
        "MINYAK DAN LEMAK",
        "MOUTH WASH",
        "PENJAGAAN DIRI",
        "PENJAGAAN RUMAH",
        "REMPAH RATUS (BERBUNGKUS)",
        "REMPAH RATUS (TIDAK BERBUNGKUS)",
        "ROTI",
        "SABUN BADAN",
        "SANTAN (KOTAK)",
        "SAPUAN (SPREADS)",
        "SUSU BAYI",
        "SYAMPU",
        "TELUR",
        "TEPUNG",
        "TERSEDIA MINUM",
        "TUALA WANITA",
        "UBAT GIGI",
        "UBAT-UBATAN",
    }
)


def parse_brand(item_name: str | None) -> str | None:
    """Extract the brand after a CAP/JENAMA marker; None when unbranded."""
    if not item_name:
        return None
    if "PELBAGAI JENAMA" in item_name.upper():
        return None  # sold under various brands; no single brand to show
    match = _BRAND_MARKER.search(item_name)
    if not match:
        return None
    brand = match.group(1).strip(" '\"-")
    return brand or None


def parse_package_size(item_name: str | None) -> str | None:
    """Extract an explicit package size from the name; None when absent."""
    if not item_name:
        return None
    if _WEIGHT_RANGE.search(item_name):
        return None  # grade weight range (e.g. egg grades), not a package size
    match = _PACKAGE_SIZE.search(item_name)
    return match.group(1).strip() if match else None


def display_package_size(item_name: str | None, unit: str | None) -> str | None:
    """Merged quantity/pricing-basis column: the parsed package size when the
    name states one, otherwise the pricing unit (e.g. "1kg" for fresh goods).
    None only when neither exists."""
    return parse_package_size(item_name) or (unit.strip() if unit and unit.strip() else None)


def is_sara_category_candidate(item_category: str | None) -> bool:
    return bool(item_category and item_category.strip() in SARA_CATEGORY_CANDIDATES)


def count_items() -> int:
    with database_cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM item")
        row = cursor.fetchone()
    return int(row[0] if row else 0)


def search_catalogue(
    query: str,
    page: int,
    page_size: int,
    categories: list[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    # 1. Preprocess parameters
    selected_categories = [
        category.strip() for category in categories or [] if category.strip()
    ]
    offset = (page - 1) * page_size
    
    # 2. Dynamically build SQL and parameters
    # If query is empty, we skip the item_name filter condition
    has_query = bool(query and query.strip())
    keyword = f"%{query.strip()}%" if has_query else None

    with database_cursor() as cursor:
        # --- Step 1: Get total count (COUNT) ---
        if has_query:
            # With keyword: filter by both name and category
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM item i
                WHERE i.item_name ILIKE %s
                  AND (cardinality(%s::text[]) = 0 OR i.item_category = ANY(%s::text[]))
                """,
                (keyword, selected_categories, selected_categories),
            )
        else:
            # Without keyword: filter by category only (if selected)
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM item i
                WHERE (cardinality(%s::text[]) = 0 OR i.item_category = ANY(%s::text[]))
                """,
                (selected_categories, selected_categories),
            )
        
        total_row = cursor.fetchone()
        total = int(total_row[0] if total_row else 0)

        # --- Step 2: Get data list (SELECT) ---
        if has_query:
            # With keyword: filter by both name and category
            cursor.execute(
                """
                SELECT i.item_id, i.item_name, i.unit, i.item_category,
                       i.sara_eligible
                FROM item i
                WHERE i.item_name ILIKE %s
                  AND (cardinality(%s::text[]) = 0 OR i.item_category = ANY(%s::text[]))
                ORDER BY i.item_name
                LIMIT %s
                OFFSET %s
                """,
                (keyword, selected_categories, selected_categories, page_size, offset),
            )
        else:
            # Without keyword: filter by category only (if selected)
            cursor.execute(
                """
                SELECT i.item_id, i.item_name, i.unit, i.item_category,
                       i.sara_eligible
                FROM item i
                WHERE (cardinality(%s::text[]) = 0 OR i.item_category = ANY(%s::text[]))
                ORDER BY i.item_name
                LIMIT %s
                OFFSET %s
                """,
                (selected_categories, selected_categories, page_size, offset),
            )

        columns = [
            "item_id",
            "item_name",
            "unit",
            "item_category",
            "sara_eligible",
        ]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

    # 3. Post-processing: add parsed fields (unchanged)
    for row in rows:
        row["package_size"] = display_package_size(row["item_name"], row["unit"])
        row["sara_category_candidate"] = is_sara_category_candidate(
            row["item_category"]
        )
        
    return rows, total


def list_catalogue_categories() -> list[str]:
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT item_category
            FROM item
            WHERE item_category IS NOT NULL AND item_category <> ''
            ORDER BY item_category
            """
        )
        return [row[0] for row in cursor.fetchall()]
