"""Pack-size ratio comparison at the selected store (US 3.2, AC 3.2.1).

For every basket line that belongs to a product family with multiple pack
sizes, list every pack size priced at the selected premise together with its
pack price and its price per unit (RM per kg or per litre).

Grouping reuses the shipped normalisers from ``alternatives``:
``product_family`` decides "same product" (brand markers and size tokens
stripped) and ``package_basis`` decides "different pack size". Quantities come
from the ingest-time columns ``item.quantity_value`` / ``item.quantity_unit``
(D3.2-A); rows without a parsed quantity are not comparable and silently stay
out of the comparison. KG and L families never mix.

All money maths uses Decimal: comparisons and the best-value pick (batch 2)
run on full precision, only display values are rounded to cents.
"""

from dataclasses import dataclass, replace
from datetime import date
from decimal import Decimal

from .alternatives import _money, package_basis, product_family
from .catalogue import display_package_size
from .database import database_cursor
from .models import BasketLineRequest


@dataclass(frozen=True)
class PackSizeOption:
    item_id: str
    item_name: str | None
    package_size: str | None
    total_price_rm: float | None
    price_per_unit_rm: float | None
    unit_kind: str | None
    observed_date: date | None
    # Full-precision ratio kept server-side for ordering and best-value picks;
    # never serialised (display uses the rounded price_per_unit_rm).
    _ratio: Decimal | None = None
    is_best_value: bool = False


def _source_rows(item_ids: list[int]) -> list[tuple]:
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT item_id, item_name, unit, quantity_value, quantity_unit
            FROM item
            WHERE item_id = ANY(%s::BIGINT[])
            """,
            (item_ids,),
        )
        return cursor.fetchall()


def _premise_pack_rows(premise_id: str) -> list[tuple]:
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT item.item_id, item.item_name, item.unit,
                   item.quantity_value, item.quantity_unit,
                   current_status.current_price,
                   current_status.price_observed_date
            FROM item
            JOIN current_status
              ON current_status.item_id = item.item_id
             AND current_status.premise_id = %s
            WHERE current_status.current_price > 0
              AND item.quantity_value IS NOT NULL
              AND item.quantity_unit IS NOT NULL
            """,
            (int(premise_id),),
        )
        return cursor.fetchall()


def _option_from_row(row: tuple) -> PackSizeOption:
    item_id, item_name, unit, quantity_value, quantity_unit, price, observed = row
    ratio = Decimal(price) / Decimal(quantity_value)
    return PackSizeOption(
        item_id=str(item_id),
        item_name=item_name,
        package_size=display_package_size(item_name, unit),
        total_price_rm=_money(Decimal(price)),
        price_per_unit_rm=_money(ratio),
        unit_kind=quantity_unit,
        observed_date=observed,
        _ratio=ratio,
    )


def get_pack_options(
    premise_id: str,
    basket: list[BasketLineRequest],
) -> dict[str, list[PackSizeOption]]:
    """Map each basket line's item id to its comparable pack-size options.

    A line maps to a non-empty list only when its product family has at least
    two distinct pack sizes priced at the selected premise within the same
    unit kind. Lines that fail any precondition map to an empty list, which
    the client renders as "no pack comparison" without any error state.
    """

    options: dict[str, list[PackSizeOption]] = {
        str(line.item_id): [] for line in basket
    }
    if not basket:
        return options

    sources = {
        str(row[0]): row for row in _source_rows([line.item_id for line in basket])
    }

    by_family: dict[str, list[tuple]] = {}
    for row in _premise_pack_rows(premise_id):
        family = product_family(row[1])
        if family:
            by_family.setdefault(family, []).append(row)

    for item_id, source in sources.items():
        _sid, source_name, source_unit, source_qty, source_kind = source
        if source_qty is None or source_kind is None:
            continue
        family = product_family(source_name)
        if not family:
            continue
        members = [
            row
            for row in by_family.get(family, [])
            if row[4] == source_kind
        ]
        distinct_bases = {package_basis(row[1], row[2]) for row in members}
        if len(distinct_bases) < 2:
            continue
        ranked = sorted(
            (_option_from_row(row) for row in members),
            key=lambda option: (
                option._ratio,
                -(option.observed_date.toordinal() if option.observed_date else 0),
                option.item_name or "",
                int(option.item_id),
            ),
        )
        # AC 3.2.2: exactly one "Best value" per comparison — the cheapest
        # unit price at full precision; ties break on the newest observed
        # price, then name, then item id (the ranking is already in that
        # order, so the head of the list is the pick).
        ranked[0] = replace(ranked[0], is_best_value=True)
        options[item_id] = ranked
    return options
