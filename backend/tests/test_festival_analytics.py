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
    Observance,
    PriceObservation,
    RegisterError,
    WindowSeries,
    classify_significance,
    daily_index,
    daily_index_from_prices,
    detect_key_windows,
    load_register,
    next_festival_start,
    observances_for_state,
    sample_items,
    smooth_index,
    state_observance_span,
    state_window_bounds,
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

    def test_daily_index_from_prices_matches_observations(self):
        day = date(2026, 2, 1)
        price_index = {
            day: {
                "A": [Decimal("1"), Decimal("3")],
                "B": [Decimal("5")],
            }
        }
        observations = [
            PriceObservation(day, "A", Decimal("1")),
            PriceObservation(day, "A", Decimal("3")),
            PriceObservation(day, "B", Decimal("5")),
        ]
        from_observations = daily_index(
            observations, items=["A", "B"], start=day, end=day
        )
        from_prices = daily_index_from_prices(
            price_index, items=["A", "B"], start=day, end=day
        )
        assert from_prices.index == from_observations.index
        assert from_prices.sample_items == from_observations.sample_items

    def test_excludes_window_level_outlier_before_daily_aggregation(self):
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
        observations = [
            PriceObservation(day, "A", Decimal(str(price))) for price in prices
        ]
        series = daily_index(observations, items=["A"], start=day, end=day)
        assert series.index == (Decimal("14.8"),)
        assert series.excluded_observations == 1
        assert series.remaining_observations == 15


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


def make_festival(*, id="test-festival", scope="national", states=(), observances=()):
    return Festival(
        id=id,
        name_en="Test Festival",
        name_zh="测试节日",
        scope=scope,
        states=tuple(states),
        observances=tuple(observances),
        specialties=(),
        source_url="https://www.malaysia.gov.my/",
        verified=True,
    )


class TestStateObservances:
    def test_selects_national_and_matching_state_extension(self):
        festival = make_festival(
            observances=(
                Observance(date(2026, 2, 17), date(2026, 2, 18), "festival", ()),
                Observance(date(2026, 2, 19), date(2026, 2, 19), "holiday", ("Kedah",)),
            )
        )
        assert len(observances_for_state(festival, "Kedah")) == 2
        assert len(observances_for_state(festival, "Selangor")) == 1
        assert state_observance_span(festival, "Kedah") == (
            date(2026, 2, 17),
            date(2026, 2, 19),
        )
        start, end = state_window_bounds(festival, "Kedah")
        assert start == date(2025, 12, 19)
        assert end == date(2026, 3, 21)

    def test_rejects_state_not_listed_on_state_festival(self):
        festival = make_festival(
            scope="state",
            states=("Sarawak",),
            observances=(
                Observance(date(2026, 6, 1), date(2026, 6, 2), "festival", ()),
            ),
        )
        assert observances_for_state(festival, "Sabah") == ()
        assert state_window_bounds(festival, "Sabah") is None

    def test_finds_next_applicable_festival(self):
        current = make_festival(
            id="current",
            observances=(
                Observance(date(2026, 2, 17), date(2026, 2, 18), "festival", ()),
            ),
        )
        following = make_festival(
            id="following",
            observances=(
                Observance(date(2026, 3, 21), date(2026, 3, 22), "festival", ()),
            ),
        )
        assert next_festival_start((current, following), current, "Selangor") == date(
            2026, 3, 21
        )

    def test_keeps_different_state_dates_independent(self):
        festival = make_festival(
            scope="state",
            states=("A", "B"),
            observances=(
                Observance(date(2026, 1, 1), date(2026, 1, 1), "festival", ("A",)),
                Observance(date(2026, 2, 1), date(2026, 2, 1), "festival", ("B",)),
            ),
        )
        assert state_observance_span(festival, "A")[0] == date(2026, 1, 1)
        assert state_observance_span(festival, "B")[0] == date(2026, 2, 1)


class TestSmoothIndex:
    def test_centred_median_removes_single_day_spike(self):
        series = make_series([10, 10, 100, 10, 10])
        smoothed = smooth_index(series)
        assert smoothed.index == (Decimal("10"),) * 5
        assert smoothed.days == series.days

    def test_rejects_even_window(self):
        with pytest.raises(ValueError, match="odd"):
            smooth_index(make_series([1, 2, 3]), window=2)


class TestKeyWindows:
    def test_detects_rise_peak_and_recovery(self):
        values = [100] * 14 + [
            101,
            102,
            103,
            105,
            110,
            120,
            115,
            110,
            105,
            103,
            102,
            101,
            100,
            100,
            100,
        ]
        series = make_series(values)
        result = detect_key_windows(series)
        assert result.status == "ok"
        assert result.baseline == Decimal("100")
        assert result.rise_start == series.days[15]
        assert result.rise_end == series.days[19]
        assert result.recovery_start == series.days[19]
        assert result.recovery_end == series.days[26]
        assert result.recovery_below_baseline is True
        assert result.recovery_value == Decimal("100")
        assert result.peak_value == Decimal("115")

    def test_two_high_observations_do_not_confirm_rise(self):
        values = [100] * 14 + [101, 102, 103, 100, 100, 100, 100, 100, 100, 100]
        result = detect_key_windows(make_series(values))
        assert result.status == "no_rise"

    def test_uses_lowest_point_without_three_day_confirmation(self):
        values = [100] * 14 + [
            101,
            102,
            103,
            105,
            110,
            120,
            115,
            112,
            110,
            109,
            108,
            107,
            106,
            105,
            104,
            103,
            104,
            105,
            106,
        ]
        result = detect_key_windows(make_series(values))
        assert result.status == "ok"
        assert result.recovery_end is not None
        assert result.recovery_below_baseline is False

    def test_marks_recovery_not_reached_when_peak_is_last(self):
        values = [100] * 14 + [101, 102, 103, 105, 110, 120]
        result = detect_key_windows(make_series(values))
        assert result.status == "recovery_not_reached"
        assert result.recovery_end is None

    def test_respects_recovery_end_limit(self):
        values = [100] * 14 + [
            101,
            102,
            103,
            105,
            110,
            120,
            115,
            110,
            105,
            103,
            102,
            101,
            100,
            100,
            100,
        ]
        series = make_series(values)
        result = detect_key_windows(series, recovery_end_limit=series.days[22])
        assert result.status == "ok"
        assert result.recovery_end == series.days[22]

    def test_marks_overlap_when_peak_reaches_limit(self):
        values = [100] * 14 + [
            101,
            102,
            103,
            105,
            110,
            120,
            115,
            110,
            105,
        ]
        series = make_series(values)
        result = detect_key_windows(series, recovery_end_limit=series.days[19])
        assert result.status == "overlapped_by_next_festival"
        assert result.recovery_end is None

    def test_marks_short_series_as_insufficient(self):
        result = detect_key_windows(make_series([100] * 10))
        assert result.status == "insufficient_sample"

    def test_marks_too_few_items_as_insufficient(self):
        series = make_series([100] * 20)
        short = WindowSeries(
            days=series.days,
            index=series.index,
            observation_days=series.observation_days,
            sample_items=MIN_SAMPLE_ITEMS - 1,
        )
        result = detect_key_windows(short)
        assert result.status == "insufficient_sample"
