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


def count_items() -> int:
    with database_cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM item")
        row = cursor.fetchone()
    return int(row[0] if row else 0)


def search_catalogue(query: str, limit: int) -> list[dict[str, Any]]:
    keyword = f"%{query.strip()}%"
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT i.item_id, i.item_code, i.item_name, i.unit, i.item_group,
                   i.item_category, MIN(cs.current_price) AS price
            FROM item i
            LEFT JOIN current_status cs ON cs.item_id = i.item_id
            WHERE i.item_name ILIKE %s OR i.item_category ILIKE %s
            GROUP BY i.item_id, i.item_code, i.item_name, i.unit,
                     i.item_group, i.item_category
            ORDER BY (MIN(cs.current_price) IS NULL), i.item_name
            LIMIT %s
            """,
            (keyword, keyword, limit),
        )
        columns = [
            "item_id",
            "item_code",
            "item_name",
            "unit",
            "item_group",
            "item_category",
            "price",
        ]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        item_ids = [row["item_id"] for row in rows]
        prices_by_item: dict[int, list[dict[str, object]]] = {
            item_id: [] for item_id in item_ids
        }
        if item_ids:
            cursor.execute(
                """
                SELECT cs.item_id, p.premise_name, cs.current_price
                FROM current_status cs
                JOIN premise p ON p.premise_id = cs.premise_id
                WHERE cs.item_id = ANY(%s)
                ORDER BY cs.current_price ASC, p.premise_name ASC
                """,
                (item_ids,),
            )
            for item_id, premise_name, price in cursor.fetchall():
                prices_by_item[item_id].append(
                    {"premise_name": premise_name, "price": float(price)}
                )

    for row in rows:
        row["price"] = float(row["price"]) if row["price"] is not None else None
        row["brand"] = parse_brand(row["item_name"])
        row["package_size"] = parse_package_size(row["item_name"])
        row["prices"] = prices_by_item.get(row["item_id"], [])
    return rows


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
