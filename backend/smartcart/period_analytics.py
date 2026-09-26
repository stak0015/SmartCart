"""Pure period analytics shared with the TypeScript implementation by fixtures."""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Literal, Mapping, Sequence, TypedDict

from .categories import CATEGORIES_BY_ID, CATEGORY_SUMMARIES


AnalyticsCadence = Literal["weekly", "monthly"]
AnalyticsSpendingClass = Literal[
    "essential", "discretionary", "mixed_or_unknown"
]
AnalyticsCategoryId = Literal[
    "fresh-produce",
    "protein",
    "staples",
    "cooking-ingredients",
    "drinks-milk",
    "snacks-convenience",
    "baby-care",
    "personal-health",
    "household",
    "education-reading",
    "other",
    "uncategorised",
]

MALAYSIA_TZ = timezone(timedelta(hours=8), "Asia/Kuala_Lumpur")
UTC = timezone.utc
_ISO_INSTANT = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$"
)
_CENT = Decimal("0.01")
_CATEGORY_ORDER = {
    category.id: index for index, category in enumerate(CATEGORY_SUMMARIES)
}
_SPENDING_CLASSES: tuple[AnalyticsSpendingClass, ...] = (
    "essential",
    "discretionary",
    "mixed_or_unknown",
)
_SAVINGS_COMPONENTS = (
    ("storeChoiceImpact", "storeChoiceImpactRm"),
    ("itemChangeImpact", "itemChangeImpactRm"),
    ("netSaving", "netSavingRm"),
)


class AnalyticsSavingsValue(TypedDict):
    amountRm: float | None
    available: bool
    incomplete: bool


class AnalyticsCategoryTotal(TypedDict):
    categoryId: AnalyticsCategoryId
    spendingClass: AnalyticsSpendingClass
    amountRm: float
    partial: bool


class PeriodAnalytics(TypedDict):
    cadence: AnalyticsCadence
    periodStart: str
    periodEnd: str
    tripCount: int
    hasActivity: bool
    hasEstimatedOnly: bool
    actualSpendingRm: float | None
    hasConfirmedSpending: bool
    missingPriceCount: int
    spendingIncomplete: bool
    categoryTotals: list[AnalyticsCategoryTotal]
    spendingClassTotals: dict[AnalyticsSpendingClass, float | None]
    savings: dict[str, bool | AnalyticsSavingsValue]


class PeriodAnalyticsComparison(TypedDict):
    cadence: AnalyticsCadence
    current: PeriodAnalytics
    previous: PeriodAnalytics


def _parse_instant(value: object) -> datetime | None:
    if not isinstance(value, str) or not _ISO_INSTANT.fullmatch(value):
        return None
    try:
        instant = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError:
        return None
    if instant.tzinfo is None:
        return None
    try:
        return instant.astimezone(UTC)
    except (OverflowError, ValueError):
        return None


def _parse_now(value: str | datetime) -> datetime:
    instant = _parse_instant(value) if isinstance(value, str) else value
    if not isinstance(instant, datetime) or instant.tzinfo is None:
        raise ValueError("now must be a valid ISO timestamp with an explicit offset")
    try:
        return instant.astimezone(UTC)
    except (OverflowError, ValueError) as error:
        raise ValueError("now must be a valid ISO timestamp with an explicit offset") from error


def _iso(instant: datetime) -> str:
    return instant.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _local_period_start(instant: datetime, cadence: AnalyticsCadence) -> datetime:
    local_date = instant.astimezone(MALAYSIA_TZ).date()
    if cadence == "weekly":
        start_date = local_date - timedelta(days=local_date.weekday())
    elif cadence == "monthly":
        start_date = local_date.replace(day=1)
    else:
        raise ValueError(f"Unsupported cadence: {cadence}")
    return datetime.combine(start_date, time.min, tzinfo=MALAYSIA_TZ).astimezone(UTC)


def _range_for(instant: datetime, cadence: AnalyticsCadence) -> tuple[datetime, datetime]:
    start = _local_period_start(instant, cadence)
    local_start = start.astimezone(MALAYSIA_TZ)
    if cadence == "weekly":
        next_local_date = local_start.date() + timedelta(days=7)
    else:
        if local_start.month == 12:
            next_local_date = date(local_start.year + 1, 1, 1)
        else:
            next_local_date = date(local_start.year, local_start.month + 1, 1)
    end = datetime.combine(next_local_date, time.min, tzinfo=MALAYSIA_TZ).astimezone(UTC)
    return start, end


def _previous_range(
    current: tuple[datetime, datetime], cadence: AnalyticsCadence
) -> tuple[datetime, datetime]:
    if cadence == "weekly":
        return current[0] - timedelta(days=7), current[0]
    local_start = current[0].astimezone(MALAYSIA_TZ)
    if local_start.month == 1:
        previous_date = date(local_start.year - 1, 12, 1)
    else:
        previous_date = date(local_start.year, local_start.month - 1, 1)
    previous_start = datetime.combine(previous_date, time.min, tzinfo=MALAYSIA_TZ).astimezone(UTC)
    return previous_start, current[0]


def _decimal(value: object) -> Decimal | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return None
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return result if result.is_finite() else None


def _to_cents(value: object) -> int | None:
    """Round each monetary input to cents, with half-cent ties away from zero."""
    decimal_value = _decimal(value)
    if decimal_value is None:
        return None
    try:
        rounded = decimal_value.quantize(_CENT, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None
    return int(rounded * 100)


def _from_cents(value: int) -> float:
    return 0.0 if value == 0 else value / 100


def _line_total_cents(line: Mapping[str, object]) -> int | None:
    price = line.get("actualPriceRm")
    if price is None:
        price = line.get("unitPriceRm")
    quantity = line.get("actualQuantity")
    if quantity is None:
        quantity = line.get("quantity")
    price_decimal = _decimal(price)
    quantity_decimal = _decimal(quantity)
    if price_decimal is None or quantity_decimal is None:
        return None
    try:
        return _to_cents(price_decimal * quantity_decimal)
    except InvalidOperation:
        return None


def _category_for(line: Mapping[str, object]) -> tuple[str, AnalyticsSpendingClass]:
    value = line.get("category")
    category_id = value.get("id") if isinstance(value, Mapping) else None
    category = CATEGORIES_BY_ID.get(category_id) if isinstance(category_id, str) else None
    if category is None:
        return "uncategorised", "mixed_or_unknown"
    return category.id, category.spending_class


def _sum_snapshot_component(
    trips: Sequence[Mapping[str, object]], component_key: str
) -> AnalyticsSavingsValue:
    available_count = 0
    snapshot_count = 0
    cents = 0
    for trip in trips:
        snapshot = trip.get("estimatedSavings")
        if snapshot is not None:
            snapshot_count += 1
        value = snapshot.get(component_key) if isinstance(snapshot, Mapping) else None
        value_cents = _to_cents(value)
        if value_cents is None:
            continue
        cents += value_cents
        available_count += 1
    return {
        "amountRm": _from_cents(cents) if available_count else None,
        "available": available_count > 0,
        "incomplete": snapshot_count > 0 and available_count < len(trips),
    }


def _analyze_range(
    records: Sequence[Mapping[str, object]],
    cadence: AnalyticsCadence,
    period_range: tuple[datetime, datetime],
) -> PeriodAnalytics:
    start, end = period_range
    trips: list[Mapping[str, object]] = []
    for record in records:
        recorded_at = _parse_instant(record.get("recordedAt"))
        if recorded_at is not None and start <= recorded_at < end:
            trips.append(record)

    category_cents: dict[str, tuple[int, AnalyticsSpendingClass]] = {}
    class_cents = {spending_class: 0 for spending_class in _SPENDING_CLASSES}
    total_cents = 0
    priced_line_count = 0
    missing_price_count = 0

    for trip in trips:
        lines = trip.get("lines")
        if not isinstance(lines, Sequence) or isinstance(lines, (str, bytes)):
            continue
        for raw_line in lines:
            if not isinstance(raw_line, Mapping) or raw_line.get("status") != "bought":
                continue
            line_cents = _line_total_cents(raw_line)
            if line_cents is None:
                missing_price_count += 1
                continue
            priced_line_count += 1
            total_cents += line_cents
            category_id, spending_class = _category_for(raw_line)
            existing_cents, _ = category_cents.get(category_id, (0, spending_class))
            category_cents[category_id] = (existing_cents + line_cents, spending_class)
            class_cents[spending_class] += line_cents

    category_totals: list[AnalyticsCategoryTotal] = [
        {
            "categoryId": category_id,  # type: ignore[typeddict-item]
            "spendingClass": spending_class,
            "amountRm": _from_cents(cents),
            "partial": missing_price_count > 0,
        }
        for category_id, (cents, spending_class) in category_cents.items()
    ]
    category_totals.sort(
        key=lambda item: (
            -item["amountRm"],
            _CATEGORY_ORDER.get(item["categoryId"], len(_CATEGORY_ORDER)),
        )
    )

    actual_spending = _from_cents(total_cents) if priced_line_count else None
    savings = {
        public_key: _sum_snapshot_component(trips, input_key)
        for public_key, input_key in _SAVINGS_COMPONENTS
    }
    savings_available = any(value["available"] for value in savings.values())
    savings_incomplete = any(value["incomplete"] for value in savings.values())
    has_estimates = any(
        trip.get("plannedSubtotalRm") is not None
        or trip.get("estimatedRoundTripCostRm") is not None
        for trip in trips
    )

    return {
        "cadence": cadence,
        "periodStart": _iso(start),
        "periodEnd": _iso(end),
        "tripCount": len(trips),
        "hasActivity": bool(trips),
        "hasEstimatedOnly": bool(trips) and actual_spending is None and has_estimates,
        "actualSpendingRm": actual_spending,
        "hasConfirmedSpending": actual_spending is not None,
        "missingPriceCount": missing_price_count,
        "spendingIncomplete": missing_price_count > 0,
        "categoryTotals": category_totals,
        "spendingClassTotals": {
            spending_class: _from_cents(class_cents[spending_class]) if priced_line_count else None
            for spending_class in _SPENDING_CLASSES
        },
        "savings": {
            "available": savings_available,
            "incomplete": savings_incomplete,
            **savings,
        },
    }


def period_analytics(
    records: Sequence[Mapping[str, object]],
    cadence: AnalyticsCadence,
    now: str | datetime,
) -> PeriodAnalyticsComparison:
    """Return deterministic current and immediately previous period metrics."""
    instant = _parse_now(now)
    current_range = _range_for(instant, cadence)
    prior_range = _previous_range(current_range, cadence)
    return {
        "cadence": cadence,
        "current": _analyze_range(records, cadence, current_range),
        "previous": _analyze_range(records, cadence, prior_range),
    }


def period_analytics_for_start(
    records: Sequence[Mapping[str, object]],
    cadence: AnalyticsCadence,
    period_start: str | datetime,
) -> PeriodAnalytics:
    """Analyze the Malaysia calendar period containing an explicit instant."""
    period_range = _range_for(_parse_now(period_start), cadence)
    return _analyze_range(records, cadence, period_range)
