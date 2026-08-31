"""Per-store basket pricing for recommendation and store-detail views.

Every reachable store is priced independently for the whole basket. Missing
or non-positive prices stay visible but do not contribute to totals. Decimal
money arithmetic keeps the basket subtotal, SARA credit and cash split
reconciled to the cent.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .catalogue import display_package_size
from .database import database_cursor
from .models import BasketItemPrice, BasketLineRequest
from .sara import is_sara_credit_line

PRICE_FRESHNESS_THRESHOLD_DAYS = 7


@dataclass(frozen=True)
class BasketLinePrice:
    """One basket line at one store, including an explicit unpriced state."""

    item_id: str
    item_name: str | None
    unit: str | None
    quantity: int
    unit_price_rm: float | None
    line_total_rm: float | None
    observed_date: str | None


@dataclass(frozen=True)
class StoreBasketSummary:
    """A store subtotal, coverage, SARA/cash split and per-line detail."""

    subtotal_rm: float | None
    priced_count: int
    basket_line_count: int
    missing_items: list[str] = field(default_factory=list)
    sara_credit_rm: float | None = None
    cash_needed_rm: float | None = None
    price_observed_days_ago: int | None = None
    lines: tuple[BasketLinePrice, ...] = ()

    @property
    def is_complete(self) -> bool:
        return self.priced_count == self.basket_line_count


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def fetch_basket_price_rows(
    premise_ids: list[str], basket: list[BasketLineRequest]
) -> list[tuple]:
    """Return one row for each requested premise and basket line."""
    if not premise_ids or not basket:
        return []

    item_ids = [line.item_id for line in basket]
    quantities = [line.quantity for line in basket]
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT requested.premise_id, lines.item_id, lines.quantity,
                   item.item_name, item.unit, current_status.current_price,
                   item.sara_eligible, item.item_category,
                   current_status.price_observed_date
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


def summarize_basket_prices(
    rows: list[tuple], today: date | None = None
) -> dict[str, StoreBasketSummary]:
    """Fold raw price rows into per-store totals and item-level details."""
    if today is None:
        today = date.today()

    totals: dict[str, Decimal] = {}
    credits: dict[str, Decimal] = {}
    priced_counts: dict[str, int] = {}
    oldest_observed: dict[str, date] = {}
    missing: dict[str, list[str]] = {}
    lines_by_store: dict[str, list[BasketLinePrice]] = {}

    for (
        premise_id,
        item_id,
        quantity,
        item_name,
        unit,
        current_price,
        sara_eligible,
        item_category,
        observed,
    ) in rows:
        key = str(premise_id)
        priced = (
            item_name is not None
            and current_price is not None
            and current_price > 0
        )
        line_total = Decimal(current_price) * quantity if priced else None
        lines_by_store.setdefault(key, []).append(
            BasketLinePrice(
                item_id=str(item_id),
                item_name=item_name,
                unit=unit,
                quantity=quantity,
                unit_price_rm=_money(Decimal(current_price)) if priced else None,
                line_total_rm=_money(line_total) if priced else None,
                observed_date=observed.isoformat() if priced and observed else None,
            )
        )

        if not priced:
            missing.setdefault(key, []).append(item_name or f"Unknown item {item_id}")
            continue

        totals[key] = totals.get(key, Decimal("0")) + line_total
        priced_counts[key] = priced_counts.get(key, 0) + 1
        if is_sara_credit_line(sara_eligible, item_category):
            credits[key] = credits.get(key, Decimal("0")) + line_total
        if observed is not None and (
            key not in oldest_observed or observed < oldest_observed[key]
        ):
            oldest_observed[key] = observed

    summaries: dict[str, StoreBasketSummary] = {}
    for key in {str(row[0]) for row in rows}:
        lines = tuple(lines_by_store.get(key, ()))
        priced_count = priced_counts.get(key, 0)
        oldest = oldest_observed.get(key)
        days_ago = (today - oldest).days if oldest is not None else None

        if priced_count == 0:
            summaries[key] = StoreBasketSummary(
                subtotal_rm=None,
                priced_count=0,
                basket_line_count=len(lines),
                missing_items=missing.get(key, []),
                lines=lines,
            )
            continue

        subtotal = Decimal(str(_money(totals[key])))
        credit = Decimal(str(_money(credits.get(key, Decimal("0")))))
        summaries[key] = StoreBasketSummary(
            subtotal_rm=float(subtotal),
            priced_count=priced_count,
            basket_line_count=len(lines),
            missing_items=missing.get(key, []),
            sara_credit_rm=float(credit),
            cash_needed_rm=float(subtotal - credit),
            price_observed_days_ago=days_ago,
            lines=lines,
        )
    return summaries


def get_basket_pricing(
    premise_ids: list[str], basket: list[BasketLineRequest]
) -> dict[str, StoreBasketSummary]:
    return summarize_basket_prices(fetch_basket_price_rows(premise_ids, basket))


def get_basket_prices_for_premises(
    *,
    premise_ids: list[str],
    basket: list[BasketLineRequest],
) -> dict[str, list[BasketItemPrice]]:
    """Preserve the original E2 item-price API for existing callers."""
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
