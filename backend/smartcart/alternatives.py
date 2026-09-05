"""Selected-store cheaper-equivalent discovery.

Alternatives intentionally stay conservative: a shopper is offered a lower
priced item only when the catalogue gives us the same category, package basis
and a stable product-family name.  PriceCatcher observations are estimates and
do not establish current stock.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re

from .catalogue import display_package_size
from .database import database_cursor
from .models import BasketLineRequest
from .sara import is_sara_credit_line


_BRAND_MARKER = re.compile(r"\b(?:PELBAGAI\s+JENAMA|CAP|JENAMA)\b", re.IGNORECASE)
_PACKAGE_TOKEN = re.compile(
    r"\b\d+(?:\.\d+)?\s?(?:KG|G|GM|ML|L|LITER|LITRE|CM)\b",
    re.IGNORECASE,
)
_MULTIPACK_TOKEN = re.compile(
    r"\b\d+\s?[Xx]\s?\d+(?:\.\d+)?\s?(?:KG|G|GM|ML|L|LITER|LITRE)\b",
    re.IGNORECASE,
)
_SPACE = re.compile(r"\s+")


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _normalise_text(value: str | None) -> str:
    if not value:
        return ""
    return _SPACE.sub(" ", re.sub(r"[^A-Z0-9]+", " ", value.upper())).strip()


def product_family(item_name: str | None) -> str:
    """Return a conservative family key from an official item name.

    PriceCatcher names usually place a brand after ``CAP`` or ``JENAMA``.
    Keeping only the prefix prevents sardines and mackerel from being treated
    as the same family while still grouping different brands of sardines.
    Names without a detectable marker remain exact-name matches.
    """

    value = item_name or ""
    marker = _BRAND_MARKER.search(value)
    if marker:
        value = value[: marker.start()]
    value = _MULTIPACK_TOKEN.sub(" ", value)
    value = _PACKAGE_TOKEN.sub(" ", value)
    return _normalise_text(value)


def package_basis(item_name: str | None, unit: str | None) -> str:
    """Canonicalise a package/unit label for exact-size comparisons."""

    value = display_package_size(item_name, unit) or unit or ""
    value = value.upper().replace("GM", "G").replace("LITER", "L").replace("LITRE", "L")
    value = re.sub(r"\s*([X*])\s*", r"\1", value)
    value = _SPACE.sub(" ", value).strip()
    return value


@dataclass(frozen=True)
class AlternativePriceItem:
    item_id: str
    item_name: str | None
    unit: str | None
    package_size: str | None
    unit_price_rm: float | None
    line_total_rm: float | None
    observed_date: date | None
    price_observed_days_ago: int | None
    sara_eligible: bool | None
    sara_category_candidate: bool
    is_sara_credit_candidate: bool
    item_name_en: str | None = None
    item_name_ms: str | None = None


@dataclass(frozen=True)
class BasketAlternative:
    quantity: int
    source: AlternativePriceItem
    alternative: AlternativePriceItem | None
    savings_rm: float | None


def premise_exists(premise_id: str) -> bool:
    with database_cursor() as cursor:
        cursor.execute("SELECT 1 FROM premise WHERE premise_id = %s", (int(premise_id),))
        return cursor.fetchone() is not None


def _item_from_row(row: tuple, quantity: int, today: date) -> AlternativePriceItem:
    if len(row) == 7:
        item_id, item_name, unit, category, sara_eligible, current_price, observed = row
        item_name_en = None
    else:
        (
            item_id, item_name, item_name_en, unit, category, sara_eligible,
            current_price, observed,
        ) = row
    priced = item_name is not None and current_price is not None and current_price > 0
    unit_price = _money(Decimal(current_price)) if priced else None
    line_total = _money(Decimal(current_price) * quantity) if priced else None
    age = (today - observed).days if priced and observed is not None else None
    category_candidate = bool(category and is_sara_credit_line(False, category))
    return AlternativePriceItem(
        item_id=str(item_id),
        item_name=item_name,
        item_name_en=item_name_en,
        item_name_ms=item_name,
        unit=unit,
        package_size=display_package_size(item_name, unit),
        unit_price_rm=unit_price,
        line_total_rm=line_total,
        observed_date=observed,
        price_observed_days_ago=age,
        sara_eligible=sara_eligible,
        sara_category_candidate=category_candidate,
        is_sara_credit_candidate=is_sara_credit_line(sara_eligible, category),
    )


def get_basket_alternatives(
    premise_id: str,
    basket: list[BasketLineRequest],
    today: date | None = None,
) -> list[BasketAlternative]:
    """Find one cheaper strict equivalent for every requested basket line."""

    if not basket:
        return []
    today = today or date.today()
    item_ids = [line.item_id for line in basket]
    quantities = [line.quantity for line in basket]
    with database_cursor() as cursor:
        cursor.execute(
            """
            WITH requested AS (
                SELECT item_id, quantity, position
                FROM unnest(%s::BIGINT[], %s::INTEGER[])
                    WITH ORDINALITY AS input(item_id, quantity, position)
            )
            SELECT requested.item_id, requested.quantity, item.item_name,
                   item.item_name_en, item.unit, item.item_category,
                   item.sara_eligible,
                   current_status.current_price,
                   current_status.price_observed_date
            FROM requested
            LEFT JOIN item ON item.item_id = requested.item_id
            LEFT JOIN current_status
              ON current_status.item_id = requested.item_id
             AND current_status.premise_id = %s
            ORDER BY requested.position
            """,
            (item_ids, quantities, int(premise_id)),
        )
        source_rows = cursor.fetchall()

        cursor.execute(
            """
            SELECT item.item_id, item.item_name, item.item_name_en, item.unit,
                   item.item_category, item.sara_eligible,
                   current_status.current_price,
                   current_status.price_observed_date
            FROM item
            JOIN current_status
              ON current_status.item_id = item.item_id
             AND current_status.premise_id = %s
            WHERE current_status.current_price > 0
              AND item.item_id <> ALL(%s::BIGINT[])
            """,
            (int(premise_id), item_ids),
        )
        candidate_rows = cursor.fetchall()

    candidates_by_key: dict[tuple[str | None, str], list[tuple]] = {}
    for row in candidate_rows:
        if len(row) == 7:
            key = (row[3], package_basis(row[1], row[2]))
        else:
            key = (row[4], package_basis(row[1], row[3]))
        candidates_by_key.setdefault(key, []).append(row)

    results: list[BasketAlternative] = []
    for source_row, quantity in zip(source_rows, quantities):
        if len(source_row) == 8:
            source_values = (
                source_row[0], source_row[2], None, source_row[3], source_row[4],
                source_row[5], source_row[6], source_row[7],
            )
        else:
            source_values = (
                source_row[0], source_row[2], source_row[3], source_row[4],
                source_row[5], source_row[6], source_row[7], source_row[8],
            )
        source = _item_from_row(source_values, quantity, today)
        alternatives = []
        if len(source_row) == 8:
            source_key = (source_row[4], package_basis(source_row[2], source_row[3]))
        else:
            source_key = (source_row[5], package_basis(source_row[2], source_row[4]))
        family = product_family(source_row[2])
        if source.unit_price_rm is not None and family:
            for candidate in candidates_by_key.get(source_key, []):
                if product_family(candidate[1]) != family:
                    continue
                candidate_item = _item_from_row(candidate, quantity, today)
                if (
                    candidate_item.unit_price_rm is not None
                    and candidate_item.line_total_rm is not None
                    and candidate_item.line_total_rm < source.line_total_rm
                ):
                    alternatives.append(candidate_item)

        alternative = min(
            alternatives,
            key=lambda item: (
                item.line_total_rm,
                -(item.price_observed_days_ago is not None),
                item.price_observed_days_ago or 0,
                item.item_name or "",
                int(item.item_id),
            ),
            default=None,
        )
        savings = (
            _money(Decimal(str(source.line_total_rm)) - Decimal(str(alternative.line_total_rm)))
            if alternative is not None and source.line_total_rm is not None and alternative.line_total_rm is not None
            else None
        )
        results.append(
            BasketAlternative(
                quantity=quantity,
                source=source,
                alternative=alternative,
                savings_rm=savings if savings and savings > 0 else None,
            )
        )
    return results
