"""Tests for AC 4i.7.1 festival register and significance (US 4i.7)."""

from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal

import pytest

from smartcart.festival_analytics import (
    MIN_OBSERVATION_DAYS,
    MIN_SAMPLE_ITEMS,
    PRE_WINDOW_DAYS,
    POST_WINDOW_DAYS,
    Festival,
    PriceObservation,
    RegisterError,
    classify_significance,
    daily_index,
    load_register,
    sample_items,
    window_bounds,
)


def write_register(tmp_path, festivals):
    path = tmp_path / "festivals.json"
    path.write_text(json.dumps({"festivals": festivals}), encoding="utf-8")
    return path


def entry(**overrides):
    base = {
        "id": "cny-2026",
        "name_en": "Chinese New Year",
        "name_zh": "农历新年",
        "scope": "national",
        "states": [],
        "observances": [{"start": "2026-02-17", "end": "2026-02-18", "kind": "festival"}],
        "specialties": [{"name_en": "Mandarin oranges", "name_zh": "柑橘"}],
        "source_url": "https://www.malaysia.gov.my/",
        "verified": True,
    }
    base.update(overrides)
    return base


class TestFestivalRegister:
    def test_loads_verified_register(self, tmp_path):
        festivals = load_register(write_register(tmp_path, [entry()]))
        assert len(festivals) == 1
        assert festivals[0].id == "cny-2026"
        assert festivals[0].observances[0].start == date(2026, 2, 17)
        assert festivals[0].verified is True

    def test_rejects_unverified_dates_by_default(self, tmp_path):
        path = write_register(tmp_path, [entry(verified=False)])
        with pytest.raises(RegisterError, match="not verified"):
            load_register(path)

    def test_allows_unverified_dates_for_demo_runs(self, tmp_path):
        path = write_register(tmp_path, [entry(verified=False)])
        festivals = load_register(path, allow_unverified=True)
        assert festivals[0].verified is False

    def test_requires_https_source(self, tmp_path):
        path = write_register(tmp_path, [entry(source_url="http://example.com/")])
        with pytest.raises(RegisterError, match="https"):
            load_register(path)

    def test_rejects_duplicate_ids(self, tmp_path):
        path = write_register(tmp_path, [entry(), entry()])
        with pytest.raises(RegisterError, match="duplicate"):
            load_register(path)

    def test_rejects_reversed_date_range(self, tmp_path):
        bad = {"start": "2026-02-18", "end": "2026-02-17", "kind": "festival"}
        path = write_register(tmp_path, [entry(observances=[bad])])
        with pytest.raises(RegisterError, match="precedes"):
            load_register(path)

    def test_rejects_empty_register(self, tmp_path):
        path = write_register(tmp_path, [])
        with pytest.raises(RegisterError, match="no festivals"):
            load_register(path)


class TestSampleItems:
    def test_ranks_by_observation_count_then_code(self):
        observations = (
            [PriceObservation(date(2026, 1, 1), "B", Decimal("1")) for _ in range(3)]
            + [PriceObservation(date(2026, 1, 1), "A", Decimal("1")) for _ in range(3)]
            + [PriceObservation(date(2026, 1, 1), "C", Decimal("1"))]
        )
        assert sample_items(observations, top_n=2) == ["A", "B"]

    def test_limits_to_top_n(self):
        observations = [
            PriceObservation(date(2026, 1, 1), code, Decimal("1"))
            for code in ("A", "B", "C")
        ]
        assert len(sample_items(observations, top_n=2)) == 2


class TestDailyIndex:
    def test_equal_weighted_mean_across_items(self):
        day = date(2026, 2, 1)
        observations = [
            PriceObservation(day, "A", Decimal("1")),
            PriceObservation(day, "B", Decimal("3")),
        ]
        series = daily_index(
            observations, items=["A", "B"], start=day, end=day
        )
        assert series.index == (Decimal("2"),)
        assert series.observation_days == 1
        assert series.sample_items == 2

    def test_filters_to_requested_items_and_window(self):
        inside = date(2026, 2, 1)
        outside = date(2026, 1, 1)
        observations = [
            PriceObservation(inside, "A", Decimal("2")),
            PriceObservation(inside, "Z", Decimal("9")),
            PriceObservation(outside, "A", Decimal("5")),
        ]
        series = daily_index(
            observations, items=["A"], start=inside, end=inside
        )
        assert series.index == (Decimal("2"),)

    def test_drops_outlier_observations(self):
        day = date(2026, 2, 1)
        observations = [
            PriceObservation(day, "A", Decimal("10")),
            PriceObservation(day, "A", Decimal("10")),
            PriceObservation(day, "A", Decimal("10")),
            PriceObservation(day, "A", Decimal("9999")),
        ]
        series = daily_index(observations, items=["A"], start=day, end=day)
        assert series.index == (Decimal("10"),)

    def test_ignores_non_positive_prices(self):
        day = date(2026, 2, 1)
        observations = [
            PriceObservation(day, "A", Decimal("0")),
            PriceObservation(day, "A", Decimal("-5")),
        ]
        series = daily_index(observations, items=["A"], start=day, end=day)
        assert series.index == ()


def make_series(values):
    from smartcart.festival_analytics import WindowSeries

    start = date(2026, 1, 1)
    days = tuple(start + timedelta(days=index) for index in range(len(values)))
    return WindowSeries(
        days=days,
        index=tuple(Decimal(str(value)) for value in values),
        observation_days=len(values),
        sample_items=MIN_SAMPLE_ITEMS,
    )


class TestSignificance:
    def festival(self):
        from smartcart.festival_analytics import Observance

        return Festival(
            id="cny-2026",
            name_en="Chinese New Year",
            name_zh="农历新年",
            scope="national",
            states=(),
            observances=(Observance(start=date(2026, 2, 17), end=date(2026, 2, 18), kind="festival", states=()),),
            specialties=(),
            source_url="https://www.malaysia.gov.my/",
            verified=True,
        )

    def test_flags_rise_at_or_above_threshold(self):
        series = make_series([100] * 7 + [120] * 7)
        result = classify_significance(self.festival(), series)
        assert result.significant is True
        assert result.rise_pct > Decimal("5")

    def test_does_not_flag_small_rise(self):
        series = make_series([100] * 7 + [104] * 7)
        result = classify_significance(self.festival(), series)
        assert result.significant is False
        assert result.reason == "rise below threshold"

    def test_marks_short_windows_as_insufficient_sample(self):
        series = make_series([100, 200])
        result = classify_significance(self.festival(), series)
        assert result.significant is False
        assert result.enough_sample is False
        assert result.reason == "insufficient sample"

    def test_marks_too_few_items_as_insufficient_sample(self):
        series = make_series([100] + [110] * (MIN_OBSERVATION_DAYS - 1))
        short = type(series)(
            days=series.days,
            index=series.index,
            observation_days=series.observation_days,
            sample_items=MIN_SAMPLE_ITEMS - 1,
        )
        result = classify_significance(self.festival(), short)
        assert result.significant is False
        assert result.enough_sample is False

    def test_handles_empty_series(self):
        result = classify_significance(self.festival(), make_series([]))
        assert result.reason == "no price observations"


class TestWindowBounds:
    def test_window_spans_pre_and_post_days(self):
        festival = TestSignificance().festival()
        observance = festival.observances[0]
        start, end = window_bounds(observance)
        assert start == observance.start - timedelta(days=PRE_WINDOW_DAYS)
        assert end == observance.end + timedelta(days=POST_WINDOW_DAYS)
