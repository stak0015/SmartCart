"""Synthetic shopper histories for report insight and narration tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from smartcart.report_models import GenerateReportRequest

# Monday 5 Oct 2026, 00:00 in Kuala Lumpur.
WEEK_START = datetime(2026, 10, 4, 16, tzinfo=timezone.utc)
WEEK_END = WEEK_START + timedelta(days=7)
AFTER_WEEK = WEEK_END + timedelta(hours=1)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def line(name: str, total: float | None, *, key: str | None = None, category: str | None = "protein",
         quantity: float = 1, unit: float | None = None) -> dict[str, object]:
    return {
        "name": name,
        "categoryId": category,
        "sourceCategory": None,
        "quantity": quantity,
        "lineTotalRm": total,
        "itemKey": key,
        "unitPriceRm": unit if unit is not None else (None if total is None else total / quantity),
    }


def trip(when: datetime, lines: list[dict[str, object]], *, store: str | None = "Lotus's Cheras",
         skipped: list[str] | None = None, travel: float | None = 3.0, planned: float | None = None,
         alternative: tuple[str, float] | None = None) -> dict[str, object]:
    return {
        "recordedAt": iso(when),
        "boughtLines": lines,
        "estimatedSavings": None,
        "storeName": store,
        "skippedLines": [{"name": name, "itemKey": None} for name in skipped or []],
        "estimatedRoundTripCostRm": travel,
        "plannedCombinedTotalRm": planned,
        "cheapestAlternative": None if alternative is None else {
            "name": alternative[0], "estimatedTotalCostRm": alternative[1],
        },
    }


def weekly_history(weeks: int = 8, *, chicken: float = 14.0, eggs: float = 12.0) -> list[dict[str, object]]:
    """One steady trip per baseline week: chicken, eggs and milk."""
    trips = []
    for index in range(1, weeks + 1):
        when = WEEK_START - timedelta(days=7 * index) + timedelta(days=2)
        trips.append(trip(when, [
            line("Chicken Breast Fillet", chicken, key="1001"),
            line("Grade A Eggs", eggs, key="1002"),
            line("Fresh Milk", 7.0, key="1003", category="drinks-milk"),
        ]))
    return trips


def request(trips: list[dict[str, object]], *, cadence: str = "weekly", locale: str = "en",
            start: datetime = WEEK_START, end: datetime = WEEK_END) -> GenerateReportRequest:
    return GenerateReportRequest.model_validate({
        "cadence": cadence,
        "periodStart": iso(start),
        "periodEnd": iso(end),
        "locale": locale,
        "timeZone": "Asia/Kuala_Lumpur",
        "trips": trips,
    })
