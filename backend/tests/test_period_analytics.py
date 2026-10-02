"""Cross-language golden contract for deterministic period analytics."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from smartcart.period_analytics import period_analytics


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "fixtures"
    / "reports"
    / "G3-analytics-golden.json"
)
GOLDEN_FIXTURES: list[dict[str, Any]] = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["fixtures"]


@pytest.mark.parametrize("fixture", GOLDEN_FIXTURES, ids=lambda fixture: fixture["id"])
def test_matches_shared_cross_language_golden_fixture(fixture: dict[str, Any]) -> None:
    assert period_analytics(
        fixture["records"], fixture["cadence"], fixture["now"]
    ) == fixture["expected"]


def test_category_totals_reconcile_and_use_actual_quantity() -> None:
    fixture = next(
        value
        for value in GOLDEN_FIXTURES
        if value["id"] == "weekly-bought-categories-signed-savings"
    )
    current = period_analytics(fixture["records"], fixture["cadence"], fixture["now"])[
        "current"
    ]
    category_total = sum(item["amountRm"] for item in current["categoryTotals"])

    assert current["actualSpendingRm"] == 28
    assert category_total == current["actualSpendingRm"]
    assert current["missingPriceCount"] == 1
    assert all(item["partial"] for item in current["categoryTotals"])
    assert current["spendingClassTotals"] == {
        "essential": 9,
        "discretionary": 10,
        "mixed_or_unknown": 9,
    }


def test_null_spending_signed_savings_invalid_time_and_immediate_previous_range() -> None:
    fixture = next(
        value
        for value in GOLDEN_FIXTURES
        if value["id"] == "monthly-no-priced-lines-null-savings-and-invalid-time"
    )
    metrics = period_analytics(fixture["records"], fixture["cadence"], fixture["now"])

    assert metrics["current"]["actualSpendingRm"] is None
    assert metrics["current"]["missingPriceCount"] == 3
    assert metrics["current"]["savings"]["netSaving"]["amountRm"] == -2
    assert metrics["previous"]["periodStart"] == "2026-02-28T16:00:00.000Z"


def test_empty_adjacent_period_does_not_backfill_older_activity() -> None:
    fixture = next(
        value
        for value in GOLDEN_FIXTURES
        if value["id"] == "weekly-adjacent-empty-does-not-backfill"
    )
    metrics = period_analytics(fixture["records"], fixture["cadence"], fixture["now"])

    assert metrics["previous"]["hasActivity"] is False
    assert metrics["previous"]["periodEnd"] == metrics["current"]["periodStart"]


def test_month_boundary_uses_kuala_lumpur_time_at_year_rollover() -> None:
    fixture = next(
        value
        for value in GOLDEN_FIXTURES
        if value["id"] == "monthly-malaysia-midnight-year-rollover"
    )
    metrics = period_analytics(fixture["records"], fixture["cadence"], fixture["now"])

    assert metrics["current"]["periodStart"] == "2026-12-31T16:00:00.000Z"
    assert metrics["current"]["periodEnd"] == "2027-01-31T16:00:00.000Z"
    assert all(not item["partial"] for item in metrics["current"]["categoryTotals"])
