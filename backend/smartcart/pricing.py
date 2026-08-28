"""Store-level basket prices used by the recommendation engine."""

from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from .catalogue import display_package_size
from .database import database_cursor
from .models import BasketItemPrice, BasketLineRequest


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def get_basket_prices_for_premises(
    *,
    premise_ids: list[str],
    basket: list[BasketLineRequest],
) -> dict[str, list[BasketItemPrice]]:
    """Return every requested basket line for every premise.

    A missing ``current_status`` row is represented by a line with null price
    fields. This keeps the UI honest while allowing ranking to ignore prices
    that are unavailable at a particular store.
    """
    if not premise_ids or not basket:
        return {premise_id: [] for premise_id in premise_ids}

    item_ids = [line.item_id for line in basket]
    quantities = [line.quantity for line in basket]
    with database_cursor() as cursor:
        cursor.execute(
            """
            WITH basket AS (
                SELECT item_id, quantity, position
                FROM unnest(%s::BIGINT[], %s::INTEGER[])
                    WITH ORDINALITY AS requested(item_id, quantity, position)
            ), requested_premise AS (
                SELECT premise_id
                FROM unnest(%s::BIGINT[]) AS requested(premise_id)
            )
            SELECT
                requested_premise.premise_id,
                item.item_id,
                item.item_name,
                item.unit,
                basket.quantity,
                current_status.current_price,
                current_status.price_observed_date
            FROM requested_premise
            CROSS JOIN basket
            JOIN item ON item.item_id = basket.item_id
            LEFT JOIN current_status
                ON current_status.premise_id = requested_premise.premise_id
               AND current_status.item_id = basket.item_id
            ORDER BY requested_premise.premise_id, basket.position
            """,
            (item_ids, quantities, [int(value) for value in premise_ids]),
        )
        rows = cursor.fetchall()

    result: dict[str, list[BasketItemPrice]] = defaultdict(list)
    for row in rows:
        unit_price = Decimal(row[5]) if row[5] is not None else None
        quantity = int(row[4])
        result[str(row[0])].append(
            BasketItemPrice(
                item_id=str(row[1]),
                item_name=(row[2] or "").strip() or "Unnamed item",
                package_size=display_package_size(row[2], row[3]),
                quantity=quantity,
                unit_price_rm=_money(unit_price) if unit_price is not None else None,
                line_total_rm=(
                    _money(unit_price * quantity) if unit_price is not None else None
                ),
                price_observed_date=row[6],
            )
        )

    return {premise_id: result[premise_id] for premise_id in premise_ids}
