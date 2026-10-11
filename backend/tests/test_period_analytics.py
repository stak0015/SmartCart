"""Period analytics behind the Statistics dashboard and reports (Epic 8).

Self-contained scenarios: weeks run Monday-Sunday and months run calendar
month in Asia/Kuala_Lumpur (UTC+8); only bought, priced lines count as
spending; missing values are never zero.
"""

from __future__ import annotations

import pytest

from smartcart.period_analytics import period_analytics, period_analytics_for_start

# Wednesday 7 Oct 2026, 12:00 in Kuala Lumpur.
NOW = "2026-10-07T04:00:00.000Z"
# Monday 5 Oct 2026, 00:00 in Kuala Lumpur.
WEEK_START = "2026-10-04T16:00:00.000Z"


def line(price, *, quantity=1, category="protein", status="bought", **extra):
    return {"status": status, "unitPriceRm": price, "quantity": quantity,
            "category": None if category is None else {"id": category}, **extra}


def trip(recorded_at, lines, **extra):
    return {"recordedAt": recorded_at, "lines": lines, **extra}


def test_weekly_period_runs_monday_to_monday_in_kuala_lumpur():
    metrics = period_analytics([], "weekly", NOW)

    assert metrics["current"]["periodStart"] == WEEK_START
    assert metrics["current"]["periodEnd"] == "2026-10-11T16:00:00.000Z"
    assert metrics["previous"]["periodStart"] == "2026-09-27T16:00:00.000Z"
    assert metrics["previous"]["periodEnd"] == WEEK_START


def test_monthly_period_handles_year_rollover():
    metrics = period_analytics([], "monthly", "2027-01-15T04:00:00.000Z")

    assert metrics["current"]["periodStart"] == "2026-12-31T16:00:00.000Z"
    assert metrics["current"]["periodEnd"] == "2027-01-31T16:00:00.000Z"
    assert metrics["previous"]["periodStart"] == "2026-11-30T16:00:00.000Z"


def test_trip_at_local_midnight_belongs_to_the_new_week():
    records = [
        trip(WEEK_START, [line(5)]),
        trip("2026-10-04T15:59:59.000Z", [line(7)]),
    ]
    metrics = period_analytics(records, "weekly", NOW)

    assert metrics["current"]["actualSpendingRm"] == 5
    assert metrics["previous"]["actualSpendingRm"] == 7


def test_spending_counts_only_bought_priced_lines_and_reconciles_by_category():
    records = [trip("2026-10-05T02:00:00.000Z", [
        line(4.5, quantity=2),                                   # 9.00 essential
        line(10, category="snacks-convenience"),                 # 10.00 discretionary
        line(3, quantity=3, category="drinks-milk"),             # 9.00 mixed
        line(None),                                              # bought, no price
        line(50, status="not_bought"),                           # never spending
    ])]
    current = period_analytics(records, "weekly", NOW)["current"]

    assert current["actualSpendingRm"] == 28
    assert current["missingPriceCount"] == 1
    assert current["spendingIncomplete"] is True
    assert sum(item["amountRm"] for item in current["categoryTotals"]) == 28
    assert all(item["partial"] for item in current["categoryTotals"])
    assert current["spendingClassTotals"] == {
        "essential": 9, "discretionary": 10, "mixed_or_unknown": 9,
    }


def test_recorded_actual_price_and_quantity_override_planned_values():
    records = [trip("2026-10-05T02:00:00.000Z", [
        line(4, quantity=2, actualPriceRm=3.5, actualQuantity=3),
    ])]

    assert period_analytics(records, "weekly", NOW)["current"]["actualSpendingRm"] == 10.5


def test_money_rounds_each_line_to_cents_half_up():
    records = [trip("2026-10-05T02:00:00.000Z", [line(1.005), line(2.004)])]

    assert period_analytics(records, "weekly", NOW)["current"]["actualSpendingRm"] == 3.01


def test_unknown_category_is_uncategorised_and_mixed():
    records = [trip("2026-10-05T02:00:00.000Z", [line(6, category=None)])]
    current = period_analytics(records, "weekly", NOW)["current"]

    assert current["categoryTotals"] == [{
        "categoryId": "uncategorised", "spendingClass": "mixed_or_unknown",
        "amountRm": 6, "partial": False,
    }]


def test_no_priced_lines_gives_unavailable_totals_not_zero():
    records = [trip("2026-10-05T02:00:00.000Z", [line(None), line(None)],
                    estimatedRoundTripCostRm=3.0)]
    current = period_analytics(records, "weekly", NOW)["current"]

    assert current["tripCount"] == 1
    assert current["actualSpendingRm"] is None
    assert current["hasConfirmedSpending"] is False
    assert current["hasEstimatedOnly"] is True
    assert current["missingPriceCount"] == 2
    assert set(current["spendingClassTotals"].values()) == {None}


def test_savings_sum_signed_values_and_flag_incomplete_periods():
    records = [
        trip("2026-10-05T02:00:00.000Z", [line(5)], estimatedSavings={
            "storeChoiceImpactRm": 2.5, "itemChangeImpactRm": -1, "netSavingRm": 1.5}),
        trip("2026-10-06T02:00:00.000Z", [line(5)], estimatedSavings={
            "storeChoiceImpactRm": -4, "itemChangeImpactRm": None, "netSavingRm": -4}),
    ]
    savings = period_analytics(records, "weekly", NOW)["current"]["savings"]

    assert savings["available"] is True
    assert savings["netSaving"] == {"amountRm": -2.5, "available": True, "incomplete": False}
    assert savings["storeChoiceImpact"]["amountRm"] == -1.5
    assert savings["itemChangeImpact"] == {"amountRm": -1, "available": True, "incomplete": True}
    assert savings["incomplete"] is True


def test_savings_unavailable_without_snapshots():
    records = [trip("2026-10-05T02:00:00.000Z", [line(5)])]
    savings = period_analytics(records, "weekly", NOW)["current"]["savings"]

    assert savings["available"] is False
    assert savings["incomplete"] is False
    assert savings["netSaving"]["amountRm"] is None


def test_records_with_invalid_timestamps_are_ignored():
    records = [
        trip("yesterday", [line(99)]),
        trip("2026-10-05 02:00:00", [line(99)]),
        trip(None, [line(99)]),
        trip("2026-10-05T02:00:00.000Z", [line(4)]),
    ]
    current = period_analytics(records, "weekly", NOW)["current"]

    assert current["tripCount"] == 1
    assert current["actualSpendingRm"] == 4


def test_empty_previous_period_does_not_backfill_older_activity():
    records = [trip("2026-09-20T02:00:00.000Z", [line(8)])]  # two weeks earlier
    metrics = period_analytics(records, "weekly", NOW)

    assert metrics["previous"]["hasActivity"] is False
    assert metrics["previous"]["actualSpendingRm"] is None
    assert metrics["previous"]["periodEnd"] == metrics["current"]["periodStart"]


def test_period_for_start_analyses_the_period_containing_the_instant():
    records = [trip("2026-09-20T02:00:00.000Z", [line(8)])]
    period = period_analytics_for_start(records, "weekly", "2026-09-18T00:00:00.000Z")

    assert period["periodStart"] == "2026-09-13T16:00:00.000Z"
    assert period["actualSpendingRm"] == 8


@pytest.mark.parametrize("now", ["2026-10-07", "not a date", "2026-10-07T04:00:00"])
def test_now_must_be_an_instant_with_an_offset(now):
    with pytest.raises(ValueError):
        period_analytics([], "weekly", now)
