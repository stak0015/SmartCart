"""End-to-end report assembly with the deterministic narrator."""

from __future__ import annotations

import asyncio
from datetime import timedelta

import pytest

from smartcart.reporting import FallbackReportNarrator, ReportRequestRejected, generate_report
from report_builders import AFTER_WEEK, WEEK_START, line, request, trip, weekly_history


def _generate(payload):
    return asyncio.run(generate_report(payload, AFTER_WEEK, FallbackReportNarrator()))


def test_minimal_legacy_trip_shape_is_still_accepted() -> None:
    legacy = {
        "recordedAt": "2026-10-07T04:00:00.000Z",
        "boughtLines": [{"name": "Eggs", "categoryId": "protein", "sourceCategory": None,
                         "quantity": 1, "lineTotalRm": 12.0}],
        "estimatedSavings": None,
    }
    report = _generate(request([legacy]))
    assert report.trip_count == 1
    assert [insight.kind for insight in report.newsletter.insights] == ["getting_started"]
    assert report.newsletter.headline.startswith("You recorded 1 trip and spent RM12.00.")
    assert report.generation_source == "fallback"
    assert "sections" not in report.model_dump(by_alias=True)


def test_baseline_trips_are_accepted_but_not_counted_in_period_totals() -> None:
    current = trip(WEEK_START + timedelta(days=2), [
        line("Chicken Breast Fillet", 14.0, key="1001"),
        line("Potato Chips", 30.0, key="2001", category="snacks-convenience"),
    ])
    report = _generate(request([*weekly_history(), current]))
    assert report.trip_count == 1
    assert report.actual_spending_rm == 44.0
    assert report.comparison is not None and report.comparison.trip_count == 1
    assert [insight.kind for insight in report.newsletter.insights] == [
        "spending_vs_usual", "items_due", "where_money_went",
    ]


def test_trips_older_than_the_baseline_window_are_rejected() -> None:
    too_old = trip(WEEK_START - timedelta(weeks=9), [line("Eggs", 12.0)])
    with pytest.raises(ReportRequestRejected):
        _generate(request([too_old]))


def test_malay_report_uses_malay_copy_and_subject() -> None:
    current = trip(WEEK_START + timedelta(days=2), [line("Chicken Breast Fillet", 14.0, key="1001")])
    report = _generate(request([*weekly_history(), current], locale="ms"))
    assert report.newsletter.subject == "Laporan membeli-belah mingguan anda"
    due = next(insight for insight in report.newsletter.insights if insight.kind == "items_due")
    assert due.title == "Elok ditambah ke perjalanan seterusnya"
    assert due.body.startswith("Anda biasanya membeli Fresh Milk dan Grade A Eggs")
