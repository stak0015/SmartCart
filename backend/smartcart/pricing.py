"""Per-store basket price aggregation for the recommendation engine.

Every reachable store is priced independently for the whole basket (no
mixing items across stores). Only valid positive prices enter the subtotal
(AC 2.3.1): lines without a valid price are excluded from the amount and
reported as missing, so an incomplete store shows a partial total — never
implied to be the full basket cost (AC 2.3.3). Money math uses Decimal with
ROUND_HALF_UP so displayed totals always reconcile to the cent.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from .database import database_cursor
from .models import BasketLineRequest
from .sara import is_sara_credit_line

# AC 2.3.5: a store whose oldest basket-line price is more than this many
# days old gets the "Prices updated [X] days ago" warning tag.
PRICE_FRESHNESS_THRESHOLD_DAYS = 7


@dataclass(frozen=True)
class BasketLinePrice:
    """Priced detail of one basket line at one store (AC 2.3.9); the price
    fields are None when the store has no valid price for the line."""

    item_id: str
    item_name: str | None
    unit: str | None
    quantity: int
    unit_price_rm: float | None
    line_total_rm: float | None
    observed_date: str | None


@dataclass(frozen=True)
class StoreBasketSummary:
    """Priced-basket subtotal for one store with its SARA Credit / Cash
    Needed split (credit + cash always equals the subtotal). subtotal_rm is
    None when no basket line is priced at that store. priced_count /
    basket_line_count give the coverage ("X of N items priced").
    price_observed_days_ago is the age of the store's oldest priced line."""

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
    """One row per (premise, basket line): premise_id, item_id, quantity,
    item_name, unit, current_price, sara_eligible, item_category,
    price_observed_date. item fields / current_price / price_observed_date
    are None when the item id is unknown / the store has no recorded price
    for the line."""
    if not premise_ids or not basket:
        return []
    item_ids = [int(line.item_id) for line in basket]
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
    """Fold raw rows into per-store subtotals. Only lines with a valid
    positive price enter the subtotal; unpriced lines stay visible via
    missing_items and the per-line detail, never as RM0. The SARA split is
    derived as credit + cash = subtotal exactly to the cent.
    price_observed_days_ago measures the oldest priced line against today
    (injectable for tests)."""
    if today is None:
        today = date.today()
    totals: dict[str, Decimal] = {}
    credits: dict[str, Decimal] = {}
    priced_counts: dict[str, int] = {}
    oldest_observed: dict[str, date] = {}
    missing: dict[str, list[str]] = {}
    lines_by_store: dict[str, list[BasketLinePrice]] = {}
    for premise_id, item_id, quantity, item_name, unit, current_price, sara_eligible, item_category, observed in rows:
        key = str(premise_id)
        priced = item_name is not None and current_price is not None and current_price > 0
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
        if observed is not None and (key not in oldest_observed or observed < oldest_observed[key]):
            oldest_observed[key] = observed

    def days_ago(key: str) -> int | None:
        oldest = oldest_observed.get(key)
        return (today - oldest).days if oldest is not None else None

    summaries: dict[str, StoreBasketSummary] = {}
    for key in {str(row[0]) for row in rows}:
        lines = tuple(lines_by_store.get(key, ()))
        basket_line_count = len(lines)
        priced_count = priced_counts.get(key, 0)
        if priced_count == 0:
            summaries[key] = StoreBasketSummary(
                subtotal_rm=None,
                priced_count=0,
                basket_line_count=basket_line_count,
                missing_items=missing.get(key, []),
                price_observed_days_ago=None,
                lines=lines,
            )
            continue
        # Cash is derived as subtotal - credit so the identity
        # credit + cash = subtotal holds exactly to the cent.
        subtotal = Decimal(str(_money(totals[key])))
        credit = Decimal(str(_money(credits.get(key, Decimal("0")))))
        summaries[key] = StoreBasketSummary(
            subtotal_rm=float(subtotal),
            priced_count=priced_count,
            basket_line_count=basket_line_count,
            missing_items=missing.get(key, []),
            sara_credit_rm=float(credit),
            cash_needed_rm=float(subtotal - credit),
            price_observed_days_ago=days_ago(key),
            lines=lines,
        )
    return summaries


def get_basket_pricing(
    premise_ids: list[str], basket: list[BasketLineRequest]
) -> dict[str, StoreBasketSummary]:
    return summarize_basket_prices(fetch_basket_price_rows(premise_ids, basket))
