"""National price ranges shown beside median estimates (AC 2.4.10, 2.5.5).

A store with no price for an item is priced at the item's national median.
The shopper also sees the range that estimate comes from: the middle 95% of
current prices across all stores, which leaves out extreme highs and lows.
Totals still use the median; the range is for display only.

Owners: Shun
"""

from typing import Any, Iterable

from pydantic import BaseModel

from .database import database_cursor

LOW_PERCENTILE = 0.025
HIGH_PERCENTILE = 0.975


def national_price_ranges(item_ids: Iterable[int]) -> dict[int, tuple[float, float]]:
    """(low, high) of the middle 95% of current prices for each item."""
    ids = sorted({int(item_id) for item_id in item_ids})
    if not ids:
        return {}
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT item_id,
                   ROUND((percentile_cont(%s) WITHIN GROUP (ORDER BY current_price))::numeric, 2),
                   ROUND((percentile_cont(%s) WITHIN GROUP (ORDER BY current_price))::numeric, 2)
            FROM current_status
            WHERE item_id = ANY(%s::bigint[])
              AND current_price > 0
            GROUP BY item_id
            """,
            (LOW_PERCENTILE, HIGH_PERCENTILE, ids),
        )
        return {
            int(item_id): (float(low), float(high))
            for item_id, low, high in cursor.fetchall()
            if low is not None and high is not None
        }


def _median_lines(value: Any, found: list[BaseModel]) -> None:
    if isinstance(value, BaseModel):
        if getattr(value, "price_source", None) == "median" and "estimate_low_rm" in type(value).model_fields:
            found.append(value)
        for name in type(value).model_fields:
            _median_lines(getattr(value, name), found)
    elif isinstance(value, (list, tuple)):
        for entry in value:
            _median_lines(entry, found)
    elif isinstance(value, dict):
        for entry in value.values():
            _median_lines(entry, found)


def attach_estimate_ranges(response: BaseModel) -> BaseModel:
    """Fill estimate_low_rm/estimate_high_rm on every median-priced line in a response.

    A failed lookup leaves the fields empty: the estimate itself is still shown.
    """
    lines: list[BaseModel] = []
    _median_lines(response, lines)
    ids = {int(line.item_id) for line in lines if str(getattr(line, "item_id", "")).isdigit()}
    if not ids:
        return response
    try:
        ranges = national_price_ranges(ids)
    except Exception:  # noqa: BLE001 - display-only extra; never block pricing
        return response
    for line in lines:
        band = ranges.get(int(line.item_id)) if str(line.item_id).isdigit() else None
        if band:
            line.estimate_low_rm, line.estimate_high_rm = band
    return response
