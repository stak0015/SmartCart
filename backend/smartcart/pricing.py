"""Per-store basket price aggregation for the recommendation engine.

Every reachable store is priced independently for the whole basket (no
mixing items across stores). Money math uses Decimal with ROUND_HALF_UP
so displayed totals always reconcile to the cent (AC 2.3.1).
"""

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP

from .database import database_cursor
from .models import BasketLineRequest


@dataclass(frozen=True)
class StoreBasketSummary:
    """Total basket price for one store; None when any line is unpriced."""

    total_rm: float | None
    missing_items: list[str] = field(default_factory=list)


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def fetch_basket_price_rows(
    premise_ids: list[str], basket: list[BasketLineRequest]
) -> list[tuple]:
    """One row per (premise, basket line): premise_id, item_id, quantity,
    item_name, current_price. item_name/current_price are None when the
    item id is unknown / the store has no recorded price for the line."""
    if not premise_ids or not basket:
        return []
    item_ids = [int(line.item_id) for line in basket]
    quantities = [line.quantity for line in basket]
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT requested.premise_id, lines.item_id, lines.quantity,
                   item.item_name, current_status.current_price
            FROM unnest(%s::bigint[]) AS requested(premise_id)
            CROSS JOIN unnest(%s::bigint[], %s::integer[])
                WITH ORDINALITY AS lines(item_id, quantity, position)
            LEFT JOIN item ON item.item_id = lines.item_id
            LEFT JOIN current_status
                ON current_status.premise_id = requested.premise_id
               AND current_status.item_id = lines.item_id
            ORDER BY requested.premise_id, lines.position
            """,
            ([int(premise_id) for premise_id in premise_ids], item_ids, quantities),
        )
        return cursor.fetchall()


def summarize_basket_prices(rows: list[tuple]) -> dict[str, StoreBasketSummary]:
    """Fold raw rows into per-store totals; a store with any unpriced or
    unknown line gets total_rm=None and the unpriced line names listed."""
    totals: dict[str, Decimal] = {}
    missing: dict[str, list[str]] = {}
    for premise_id, item_id, quantity, item_name, current_price in rows:
        key = str(premise_id)
        if item_name is None or current_price is None:
            missing.setdefault(key, []).append(item_name or f"Unknown item {item_id}")
            continue
        totals[key] = totals.get(key, Decimal("0")) + Decimal(current_price) * quantity
    return {
        key: StoreBasketSummary(
            total_rm=None if key in missing else _money(totals.get(key, Decimal("0"))),
            missing_items=missing.get(key, []),
        )
        for key in {str(row[0]) for row in rows}
    }


def get_basket_pricing(
    premise_ids: list[str], basket: list[BasketLineRequest]
) -> dict[str, StoreBasketSummary]:
    return summarize_basket_prices(fetch_basket_price_rows(premise_ids, basket))
