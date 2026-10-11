"""Daily, process-local cache of Malaysia's official RON95 retail price."""

import csv
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone, date
from io import StringIO
import logging
from math import isfinite
from threading import Lock
from time import monotonic
from urllib.request import urlopen

from .config import Settings

FUEL_DATA_URL = "https://storage.data.gov.my/commodities/fuelprice.csv"
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FuelPrice:
    per_litre_rm: float
    basis: str
    source: str
    effective_date: str | None = None


def latest_fuel_price(rows: list[dict], field: str, today: date) -> FuelPrice:
    eligible = []
    for row in rows:
        if row.get("series_type") != "level":
            continue
        try:
            effective = date.fromisoformat(row["date"])
            price = float(row[field])
        except (KeyError, TypeError, ValueError):
            continue
        if effective <= today and isfinite(price) and price > 0:
            eligible.append((effective, price))
    if not eligible:
        raise ValueError("No usable effective fuel price")
    effective, price = max(eligible)
    return FuelPrice(price, field, "data.gov.my", effective.isoformat())


_lock = Lock()
_cache: dict[str, tuple[date, float, FuelPrice | None]] = {}


def get_fuel_price(settings: Settings) -> FuelPrice:
    """Refresh on the first request of each Malaysian day; retry failures hourly."""
    today = datetime.now(timezone(timedelta(hours=8))).date()
    field = settings.fuel_price_field
    with _lock:
        cached = _cache.get(field)
        now = monotonic()
        if cached and cached[0] == today and now < cached[1]:
            price = cached[2]
        else:
            try:
                with urlopen(FUEL_DATA_URL, timeout=5) as response:
                    rows = list(csv.DictReader(StringIO(response.read().decode("utf-8-sig"))))
                price = latest_fuel_price(rows, field, today)
                _cache[field] = (today, float("inf"), price)
            except (OSError, ValueError, UnicodeError):
                logger.warning("Official fuel price unavailable; using labelled fallback")
                price = replace(cached[2], source="cached") if cached and cached[2] else None
                _cache[field] = (today, now + 3600, price)
        return price or FuelPrice(settings.fuel_price_fallback_rm, field, "fallback")
