from dataclasses import replace
from datetime import date
from io import BytesIO

import pytest

from smartcart import fuel
from smartcart.config import get_settings


def test_latest_effective_level_price_ignores_changes_future_and_invalid_rows():
    rows = [
        {"series_type": "level", "date": "2026-10-01", "ron95": "2.60"},
        {"series_type": "change_weekly", "date": "2026-10-08", "ron95": "0.15"},
        {"series_type": "level", "date": "2026-10-08", "ron95": "2.75", "ron95_budi95": "1.99"},
        {"series_type": "level", "date": "2026-10-15", "ron95": "3.0"},
        {"series_type": "level", "date": "2026-10-09", "ron95": "NaN"},
    ]
    assert fuel.latest_fuel_price(rows, "ron95", date(2026, 10, 11)).per_litre_rm == 2.75
    assert fuel.latest_fuel_price(rows, "ron95_budi95", date(2026, 10, 11)).per_litre_rm == 1.99
    with pytest.raises(ValueError):
        fuel.latest_fuel_price(rows, "ron95", date(2020, 1, 1))


def test_daily_cache_and_labelled_failure_fallback(monkeypatch):
    monkeypatch.setattr(fuel, "_cache", {})
    settings = get_settings()
    calls = []
    def fetch(*args, **kwargs):
        calls.append(1)
        return BytesIO(b"series_type,date,ron95\nlevel,2020-01-01,2.75\n")
    monkeypatch.setattr(fuel, "urlopen", fetch)
    first = fuel.get_fuel_price(settings)
    assert fuel.get_fuel_price(settings) == first
    assert len(calls) == 1
    # Force a new-day refresh, then verify last known data survives an outage.
    field = settings.fuel_price_field
    fuel._cache[field] = (date(2020, 1, 1), 0, first)
    def fail(*args, **kwargs):
        raise OSError("offline")
    monkeypatch.setattr(fuel, "urlopen", fail)
    assert fuel.get_fuel_price(settings).source == "cached"
    fuel._cache.clear()
    fallback = fuel.get_fuel_price(replace(settings, fuel_price_fallback_rm=2.50))
    assert fallback.source == "fallback"
    assert fallback.per_litre_rm == 2.50
