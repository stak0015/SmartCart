"""Tests for AC 4i.7.3 item-level festival price statistics."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from smartcart.festival_price_stats import (
    compute_item_window_stats,
    daily_item_medians,
    filter_window_observations,
    summarize_categories,
)


def test_filter_window_observations_removes_window_level_outlier():
    day = date(2026, 2, 22)
    prices = [
        1299,
        20,
        20,
        19.9,
        18,
        17,
        17,
        16,
        14.8,
        14.49,
        14,
        11.99,
        11.99,
        9.99,
        9.99,
        9.99,
    ]
    kept, excluded = filter_window_observations(
        [(day, Decimal(str(price))) for price in prices],
        start=day,
        end=day,
    )
    assert excluded == 1
    assert len(kept) == 15
    assert daily_item_medians(kept) == {day: Decimal("14.8")}


def test_compute_item_window_stats_ok():
    start = date(2026, 1, 1)
    observations = [
        (start + timedelta(days=index), Decimal("100")) for index in range(14)
    ]
    observations += [
        (start + timedelta(days=14), Decimal("120")),
        (start + timedelta(days=15), Decimal("121")),
        (start + timedelta(days=16), Decimal("119")),
        (start + timedelta(days=17), Decimal("90")),
        (start + timedelta(days=18), Decimal("91")),
    ]
    stats = compute_item_window_stats(
        "A",
        observations,
        start=start,
        end=start + timedelta(days=18),
        window_status="ok",
        rise_start=start + timedelta(days=14),
        rise_end=start + timedelta(days=16),
        recovery_end=start + timedelta(days=18),
    )
    assert stats.status == "ok"
    assert stats.baseline_price == Decimal("100")
    assert stats.peak_price == Decimal("121")
    assert stats.recovery_price == Decimal("90")
    assert stats.rise_status == "rise"
    assert stats.rise_pct == Decimal("21")
    assert stats.recovery_pct is not None
    assert stats.recovery_vs_baseline_pct is not None


def test_compute_item_window_stats_insufficient_baseline():
    start = date(2026, 1, 1)
    observations = [
        (start + timedelta(days=index), Decimal("100")) for index in range(2)
    ]
    stats = compute_item_window_stats(
        "A",
        observations,
        start=start,
        end=start + timedelta(days=1),
        window_status="no_rise",
        rise_start=None,
        rise_end=None,
        recovery_end=None,
    )
    assert stats.status == "insufficient_baseline"
    assert stats.sample_status == "insufficient"
    assert stats.baseline_price is None


def test_compute_item_window_stats_limited_baseline():
    start = date(2026, 1, 1)
    observations = [
        (start + timedelta(days=index), Decimal("100")) for index in range(5)
    ]
    stats = compute_item_window_stats(
        "A",
        observations,
        start=start,
        end=start + timedelta(days=4),
        window_status="no_rise",
        rise_start=None,
        rise_end=None,
        recovery_end=None,
    )
    assert stats.status == "window_not_ready"
    assert stats.sample_status == "limited"
    assert stats.baseline_price == Decimal("100")


def test_compute_item_window_stats_window_not_ready():
    start = date(2026, 1, 1)
    observations = [
        (start + timedelta(days=index), Decimal("100")) for index in range(14)
    ]
    stats = compute_item_window_stats(
        "A",
        observations,
        start=start,
        end=start + timedelta(days=13),
        window_status="no_rise",
        rise_start=None,
        rise_end=None,
        recovery_end=None,
    )
    assert stats.status == "window_not_ready"
    assert stats.baseline_price == Decimal("100")


def test_summarize_categories_uses_percentage_values_only():
    rows = [
        {
            "festival_id": "f",
            "state": "S",
            "broad_category_id": "protein",
            "status": "ok",
            "rise_pct": "10",
            "recovery_pct": "-5",
        },
        {
            "festival_id": "f",
            "state": "S",
            "broad_category_id": "protein",
            "status": "ok",
            "rise_pct": "20",
            "recovery_pct": "-15",
        },
        {
            "festival_id": "f",
            "state": "S",
            "broad_category_id": "protein",
            "status": "no_recovery",
            "rise_pct": "100",
            "recovery_pct": None,
        },
    ]
    summaries = summarize_categories(rows)
    assert len(summaries) == 1
    summary = summaries[0]
    assert summary["item_count"] == 3
    assert summary["ok_item_count"] == 2
    assert summary["rising_item_count"] == 2
    assert summary["falling_or_flat_item_count"] == 0
    assert summary["average_rise_pct"] == Decimal("15")
    assert summary["average_positive_rise_pct"] == Decimal("15")
    assert summary["median_rise_pct"] == Decimal("15")
    assert summary["average_recovery_pct"] == Decimal("-10")
