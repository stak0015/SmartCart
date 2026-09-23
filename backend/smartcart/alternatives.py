"""Selected-store, category-scoped cheaper-item discovery.

Names are normalized into comparison tokens, then candidates in the same
category and package basis are matched by token Jaccard similarity. PriceCatcher
observations are estimates and do not establish current stock.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import re

from .catalogue import catalogue_image_url, display_package_size
from .database import database_cursor
from .models import BasketLineRequest
from .sara import is_sara_credit_line


_PACKAGE_TOKEN = re.compile(
    r"\b\d+(?:\.\d+)?\s?(?:KG|G|GM|ML|L|LITER|LITRE|CM)\b",
    re.IGNORECASE,
)
_MULTIPACK_TOKEN = re.compile(
    r"\b\d+\s?[Xx]\s?\d+(?:\.\d+)?\s?(?:KG|G|GM|ML|L|LITER|LITRE)\b",
    re.IGNORECASE,
)
_SPACE = re.compile(r"\s+")
_ALTERNATIVE_BRAND_SEGMENT = re.compile(r"\b(?:CAP|JENAMA)\s+[^()]*", re.IGNORECASE)
_ALTERNATIVE_TOKENS = re.compile(r"[A-Z0-9]+")
ALTERNATIVE_NAME_SIMILARITY_THRESHOLD = 0.67


def _money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def alternative_name_tokens(item_name: str | None) -> tuple[str, ...]:
    """Normalize an item name for category-scoped similarity matching.

    Package sizes and explicit brand segments are removed, while text in
    parentheses is retained because it often identifies product type or
    variant. Percentage grades beside a brand marker are retained too.
    """

    value = (item_name or "").upper().replace("&", " AND ")
    value = re.sub(r"\bPELBAGAI\s+JENAMA\b", " ", value)
    value = _MULTIPACK_TOKEN.sub(" ", value)
    value = _PACKAGE_TOKEN.sub(" ", value)

    def preserve_percentage(match: re.Match[str]) -> str:
        percentages = re.findall(r"\d+(?:\.\d+)?\s?%", match.group(0))
        return " " + " ".join(percentages)

    value = _ALTERNATIVE_BRAND_SEGMENT.sub(preserve_percentage, value)
    return tuple(_ALTERNATIVE_TOKENS.findall(value))


def alternative_name_similarity(left: str | None, right: str | None) -> float:
    """Return token-set Jaccard similarity for two normalized item names."""

    left_tokens = set(alternative_name_tokens(left))
    right_tokens = set(alternative_name_tokens(right))
    union = left_tokens | right_tokens
    if not union:
        return 0.0
    return len(left_tokens & right_tokens) / len(union)


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
    price_source: str | None = None
    image_url: str | None = None


@dataclass(frozen=True)
class BasketAlternative:
    quantity: int
    source: AlternativePriceItem
    alternative: AlternativePriceItem | None
    savings_rm: float | None


def premise_exists(premise_id: str) -> bool:
    with database_cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM premise
            WHERE premise_id = %s
              AND open_closed_status = 'open'
            """,
            (int(premise_id),),
        )
        return cursor.fetchone() is not None


def _premise_is_open(cursor, premise_id: str) -> bool:
    """Check a premise using an already-open request cursor."""

    cursor.execute(
        """
        SELECT 1
        FROM premise
        WHERE premise_id = %s
          AND open_closed_status = 'open'
        """,
        (int(premise_id),),
    )
    return cursor.fetchone() is not None


def _item_from_row(
    row: tuple,
    quantity: int,
    today: date,
    *,
    allow_median: bool = False,
    image_code: str | None = None,
) -> AlternativePriceItem:
    if len(row) == 7:
        item_id, item_name, unit, category, sara_eligible, current_price, observed = row
        item_name_en = None
        median_price = None
    elif len(row) == 8:
        (
            item_id, item_name, item_name_en, unit, category, sara_eligible,
            current_price, observed,
        ) = row
        median_price = None
    else:
        (
            item_id, item_name, item_name_en, unit, category, sara_eligible,
            current_price, median_price, observed,
        ) = row
    has_store_price = (
        item_name is not None
        and current_price is not None
        and current_price > 0
    )
    has_median_price = (
        allow_median
        and item_name is not None
        and not has_store_price
        and median_price is not None
        and median_price > 0
    )
    priced = has_store_price or has_median_price
    effective_price = (
        current_price
        if has_store_price
        else median_price
        if has_median_price
        else None
    )
    unit_price = _money(Decimal(effective_price)) if priced else None
    line_total = _money(Decimal(effective_price) * quantity) if priced else None
    age = (today - observed).days if has_store_price and observed is not None else None
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
        observed_date=observed if has_store_price else None,
        price_observed_days_ago=age,
        price_source="store" if has_store_price else "median" if has_median_price else None,
        sara_eligible=sara_eligible,
        sara_category_candidate=category_candidate,
        is_sara_credit_candidate=is_sara_credit_line(sara_eligible, category),
        image_url=catalogue_image_url(image_code),
    )


def get_basket_alternatives(
    premise_id: str,
    basket: list[BasketLineRequest],
    today: date | None = None,
) -> list[BasketAlternative]:
    """Find one cheaper, name-similar item for every requested basket line."""

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
                   item.median_price_rm,
                   current_status.price_observed_date,
                   item.item_code
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
                   current_status.price_observed_date,
                   item.item_code
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

    return _build_basket_alternatives(source_rows, candidate_rows, basket, today)


def _build_basket_alternatives(
    source_rows: list[tuple],
    candidate_rows: list[tuple],
    basket: list[BasketLineRequest],
    today: date,
) -> list[BasketAlternative]:
    """Build alternatives from rows already fetched for the request.

    ``candidate_rows`` uses the eight-column shape returned by the legacy
    alternatives query.  The request-level service converts the shared
    premise-wide rows into this shape before calling this pure builder.
    """

    quantities = [line.quantity for line in basket]
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
                source_row[5], source_row[6], None, source_row[7],
            )
        elif len(source_row) == 9:
            source_values = (
                source_row[0], source_row[2], source_row[3], source_row[4],
                source_row[5], source_row[6], source_row[7], None, source_row[8],
            )
        else:
            source_values = (
                source_row[0], source_row[2], source_row[3], source_row[4],
                source_row[5], source_row[6], source_row[7], source_row[8],
                source_row[9],
            )
        source = _item_from_row(
            source_values,
            quantity,
            today,
            allow_median=True,
            image_code=source_row[10] if len(source_row) > 10 else None,
        )
        alternatives: list[tuple[float, AlternativePriceItem]] = []
        if len(source_row) == 8:
            source_category = source_row[4]
            source_key = (source_category, package_basis(source_row[2], source_row[3]))
        else:
            source_category = source_row[5]
            source_key = (source_category, package_basis(source_row[2], source_row[4]))
        if (
            source_category
            and source_category.strip()
            and source.price_source == "store"
            and source.unit_price_rm is not None
        ):
            for candidate in candidates_by_key.get(source_key, []):
                similarity = alternative_name_similarity(source_row[2], candidate[1])
                if similarity < ALTERNATIVE_NAME_SIMILARITY_THRESHOLD:
                    continue
                candidate_item = _item_from_row(
                    candidate[:8] if len(candidate) > 8 else candidate,
                    quantity,
                    today,
                    image_code=candidate[8] if len(candidate) > 8 else None,
                )
                if (
                    candidate_item.unit_price_rm is not None
                    and candidate_item.line_total_rm is not None
                    and candidate_item.line_total_rm < source.line_total_rm
                ):
                    alternatives.append((similarity, candidate_item))

        best_alternative = min(
            alternatives,
            key=lambda match: (
                -match[0],
                match[1].line_total_rm
                if match[1].line_total_rm is not None
                else float("inf"),
                -(match[1].price_observed_days_ago is not None),
                match[1].price_observed_days_ago or 0,
                match[1].item_name or "",
                int(match[1].item_id),
            ),
            default=None,
        )
        alternative = best_alternative[1] if best_alternative else None
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


def get_basket_alternatives_with_pack_options(
    premise_id: str,
    basket: list[BasketLineRequest],
    today: date | None = None,
) -> tuple[bool, list[BasketAlternative], dict[str, list[object]]]:
    """Load all basket comparison data in one database scope.

    The premise-wide priced rows are fetched once and shared by name-similar
    cheaper-item matching and pack-size comparisons. The boolean is
    false when the premise is not open; callers can map that to the public 404
    response without issuing a second database request.
    """

    today = today or date.today()
    item_ids = [line.item_id for line in basket]
    quantities = [line.quantity for line in basket]

    # Imported lazily to avoid the alternatives -> pack_ratios -> alternatives
    # module import cycle.  The builder itself is pure and performs no I/O.
    from .pack_ratios import get_pack_options_from_premise_rows

    with database_cursor() as cursor:
        if not _premise_is_open(cursor, premise_id):
            return False, [], {}
        if not basket:
            return True, [], {}

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
                   item.median_price_rm,
                   current_status.price_observed_date,
                   item.item_code
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

        # This is the only premise-wide scan.  It includes the quantity
        # columns needed by pack comparisons, so no second item lookup is
        # needed for the requested source lines.
        cursor.execute(
            """
            SELECT item.item_id, item.item_name, item.item_name_en, item.unit,
                   item.quantity_value, item.quantity_unit,
                   current_status.current_price,
                   current_status.price_observed_date,
                   item.item_category, item.sara_eligible,
                   item.item_code
            FROM item
            JOIN current_status
              ON current_status.item_id = item.item_id
             AND current_status.premise_id = %s
            WHERE current_status.current_price > 0
            """,
            (int(premise_id),),
        )
        premise_rows = cursor.fetchall()

    # Adapt the shared rows to the similar-item builder's historical candidate
    # shape and append the catalogue code for its optional thumbnail.
    candidate_rows = [
        (
            row[0], row[1], row[2], row[3], row[8], row[9], row[6], row[7], row[10],
        )
        for row in premise_rows
        if row[0] not in item_ids
    ]
    lines = _build_basket_alternatives(source_rows, candidate_rows, basket, today)
    store_source_ids = {
        line.source.item_id
        for line in lines
        if line.source.price_source == "store"
    }
    pack_options = (
        get_pack_options_from_premise_rows(basket, premise_rows)
        if store_source_ids
        else {}
    )
    return True, lines, pack_options
