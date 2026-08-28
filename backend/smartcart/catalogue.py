"""Epic 1 catalogue database queries."""

from typing import Any

from .database import database_cursor


def count_items() -> int:
    with database_cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM item")
        row = cursor.fetchone()
    return int(row[0] if row else 0)


def search_catalogue(query: str, limit: int) -> list[dict[str, Any]]:
    keyword = f"%{query.strip()}%"
    with database_cursor() as cursor:
        # AC-1.1.2: Strictly match only official item_name (case-insensitive partial match).
        # Removed category matching to prevent false positives from category names.
        cursor.execute(
            """
            SELECT i.item_id, i.item_code, i.item_name, i.unit, i.item_group,
                   i.item_category, MIN(cs.current_price) AS price
            FROM item i
            LEFT JOIN current_status cs ON cs.item_id = i.item_id
            WHERE i.item_name ILIKE %s
            GROUP BY i.item_id, i.item_code, i.item_name, i.unit,
                     i.item_group, i.item_category
            ORDER BY i.item_name
            LIMIT %s
            """,
            (keyword, limit),
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