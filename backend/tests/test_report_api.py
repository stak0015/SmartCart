"""Contract, validation and privacy tests for POST /api/reports/generate (US 8.5).

Self-contained: requests are built from report_builders, and the clock,
narrator and rate-limit hook are injected through create_app.
"""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Mapping

import pytest
from fastapi.testclient import TestClient

from main import create_app
from smartcart.reporting import FallbackReportNarrator
from tests.report_builders import WEEK_END, WEEK_START, iso, line, trip, weekly_history

# Monday 12 Oct 2026, 12:00 in Kuala Lumpur: the week of WEEK_START has just ended.
NOW = datetime(2026, 10, 12, 4, tzinfo=timezone.utc)
URL = "/api/reports/generate"


def body(trips, *, cadence="weekly", locale="en", start=WEEK_START, end=WEEK_END) -> dict[str, object]:
    return {"cadence": cadence, "periodStart": iso(start), "periodEnd": iso(end),
            "locale": locale, "timeZone": "Asia/Kuala_Lumpur", "trips": trips}


def this_week(*lines) -> dict[str, object]:
    return trip(WEEK_START + timedelta(days=2), list(lines) or [
        line("Chicken Breast Fillet", 14.0, key="1001"),
        line("Grade A Eggs", 12.0, key="1002"),
        line("Fresh Milk", 7.0, key="1003", category="drinks-milk"),
    ])


def client(*, now=NOW, narrator=None, rate_limit_hook=None) -> TestClient:
    return TestClient(create_app(
        report_clock=lambda: now,
        report_narrator=narrator if narrator is not None else FallbackReportNarrator(),
        report_rate_limit_hook=rate_limit_hook,
    ))


class RecordingNarrator:
    def __init__(self, *, fail: bool = False) -> None:
        self.calls: list[Mapping[str, object]] = []
        self.fail = fail

    async def narrate(self, facts):
        self.calls.append(deepcopy(facts))
        if self.fail:
            raise RuntimeError("provider down")
        return await FallbackReportNarrator().narrate(facts)


def post(payload, **kwargs):
    return client(**kwargs).post(URL, json=payload)


# ------------------------------------------------------------------ happy path


def test_weekly_report_summarises_the_period_and_compares_with_last_week():
    response = post(body([this_week(), *weekly_history()]))

    assert response.status_code == 200
    report = response.json()
    assert report["id"] == f"weekly:{iso(WEEK_START)}"
    assert (report["periodStart"], report["periodEnd"]) == (iso(WEEK_START), iso(WEEK_END))
    assert report["tripCount"] == 1
    assert report["actualSpendingRm"] == 33
    assert report["spendingIncomplete"] is False
    assert sum(row["amountRm"] for row in report["categorySpending"]) == 33
    assert [row["spendingClass"] for row in report["spendingClassBreakdown"]] == [
        "essential", "discretionary", "mixed_or_unknown"]
    assert report["comparison"]["tripCount"] == 1
    assert report["comparison"]["actualSpendingRm"] == 33
    assert report["generationSource"] == "fallback"
    insights = report["newsletter"]["insights"]
    assert 1 <= len(insights) <= 4
    assert all(insight["title"] and insight["body"] for insight in insights)


def test_comparison_is_null_without_trips_in_the_previous_period():
    report = post(body([this_week()])).json()

    assert report["comparison"] is None


def test_current_period_can_be_requested_while_it_is_in_progress():
    in_week = WEEK_START + timedelta(days=3)
    response = post(body([this_week()]), now=in_week)

    assert response.status_code == 200
    assert response.json()["tripCount"] == 1


def test_monthly_report_covers_the_previous_calendar_month():
    september = datetime(2026, 8, 31, 16, tzinfo=timezone.utc)
    october = datetime(2026, 9, 30, 16, tzinfo=timezone.utc)
    trips = [trip(september + timedelta(days=10), [line("Beras", 26.0, category="staples")])]
    response = post(body(trips, cadence="monthly", locale="ms", start=september, end=october))

    assert response.status_code == 200
    assert response.json()["actualSpendingRm"] == 26


def test_unpriced_lines_are_disclosed_and_never_counted_as_zero():
    response = post(body([this_week(line("Bread", None), line("Eggs", 12.0))]))
    report = response.json()

    assert report["actualSpendingRm"] == 12
    assert report["spendingIncomplete"] is True
    assert any("missing a confirmed line total" in text for text in report["disclosures"])


def test_all_unpriced_lines_leave_spending_unavailable():
    report = post(body([this_week(line("Bread", None))])).json()

    assert report["actualSpendingRm"] is None
    assert report["categorySpending"] == []


def test_disclosures_follow_the_report_language():
    report = post(body([this_week(line("Roti", None))], locale="ms")).json()

    assert any("item yang dibeli" in text for text in report["disclosures"])


# ------------------------------------------------------------------ narration


def test_narrator_receives_computed_findings_not_raw_trips():
    narrator = RecordingNarrator()
    post(body([this_week(), *weekly_history()]), narrator=narrator)

    facts = narrator.calls[0]
    assert set(facts) == {"locale", "cadence", "periodStart", "periodEnd", "periodInProgress",
                          "tripCount", "findings", "defaultHeadline"}
    serialized = json.dumps(facts)
    assert "boughtLines" not in serialized and "recordedAt" not in serialized


def test_narrator_failure_falls_back_to_template_text():
    response = post(body([this_week()]), narrator=RecordingNarrator(fail=True))

    assert response.status_code == 200
    assert response.json()["generationSource"] == "fallback"
    assert response.json()["newsletter"]["insights"]


def test_rejecting_rate_limit_hook_stops_before_narration():
    narrator = RecordingNarrator()

    async def reject(_request):
        return False

    response = post(body([this_week()]), narrator=narrator, rate_limit_hook=reject)

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "REPORT_RATE_LIMITED"
    assert narrator.calls == []


# ------------------------------------------------------------------ validation


def test_periods_other_than_current_or_previous_are_rejected():
    start = WEEK_START - timedelta(days=7)
    response = post(body([], start=start, end=WEEK_START))

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REPORT_REQUEST"


@pytest.mark.parametrize("recorded_at", [
    WEEK_START - timedelta(days=7 * 8, seconds=1),   # before the 8-week baseline
    WEEK_END,                                        # after the period
])
def test_trips_outside_the_report_window_are_rejected(recorded_at):
    response = post(body([trip(recorded_at, [line("Rice", 5.0)])]))

    assert response.status_code == 400


def test_future_trips_are_rejected():
    in_week = WEEK_START + timedelta(days=1)
    future = trip(in_week + timedelta(days=2), [line("Rice", 5.0)])
    response = post(body([future]), now=in_week)

    assert response.status_code == 400


@pytest.mark.parametrize("path, extra", [
    ((), {"userId": "secret-value"}),
    (("trips", 0), {"origin": "secret-value"}),
    (("trips", 0, "boughtLines", 0), {"premiseId": "secret-value"}),
    ((), {"period_start": "secret-value"}),  # snake_case aliases are not accepted
])
def test_unknown_fields_are_rejected_without_echoing_them(path, extra):
    payload = body([this_week()])
    target = payload
    for key in path:
        target = target[key]
    target.update(extra)
    response = post(payload)

    assert response.status_code == 400
    assert "secret-value" not in response.text


@pytest.mark.parametrize("field, value", [
    ("quantity", 0), ("quantity", -1), ("lineTotalRm", -0.01), ("categoryId", "not-a-category"),
])
def test_invalid_line_values_are_rejected(field, value):
    bad = line("Rice", 5.0)
    bad[field] = value
    response = post(body([this_week(bad)]))

    assert response.status_code == 400


def test_trip_count_limit_is_enforced():
    trips = [this_week(line("Rice", 1.0)) for _ in range(129)]

    assert post(body(trips)).status_code == 400


def test_oversized_body_is_rejected_before_parsing():
    response = client().post(URL, content=b"{" + b" " * (512 * 1024) + b"}",
                             headers={"Content-Type": "application/json"})

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REPORT_REQUEST_TOO_LARGE"


def test_malformed_json_is_rejected_without_echo():
    response = client().post(URL, content=b'{"cadence": "weekly", "secret-value"',
                             headers={"Content-Type": "application/json"})

    assert response.status_code == 400
    assert "secret-value" not in response.text


# ------------------------------------------------------------------ privacy


def test_logs_contain_only_aggregate_metadata(caplog):
    caplog.set_level(logging.INFO, logger="smartcart.api")
    post(body([this_week(line("Private Item Name", 9.0))]))

    records = [r for r in caplog.records if getattr(r, "event", None) == "report_generation"]
    assert len(records) == 1
    assert records[0].outcome == "success"
    assert records[0].trip_count == 1
    assert "Private Item Name" not in caplog.text
