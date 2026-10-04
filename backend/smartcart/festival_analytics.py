"""Festival price-movement analytics for Epic 4i (US 4i.7).

Pure functions over price observations.  The module deliberately avoids any
database or filesystem access beyond the festival register so that the whole
pipeline can be unit-tested against small fixtures instead of the 22M-row
production dataset.

Contract (see Epic4i development plan v1):

* AC 4i.7.1 - the festival register is the single source of festival dates.
  Every entry carries a source URL; entries that are not yet verified against
  the official source are rejected unless the caller explicitly opts in for a
  demo run.  A festival counts as "significantly fluctuating" when the
  equal-weighted price rise across the sample items reaches the threshold and
  enough observations exist.
* Later ACs (4i.7.2 - 4i.7.6) build on the same primitives; the shared
  constants live here so every stage reports a single method version.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from statistics import median
from typing import Iterable, Sequence

METHOD_VERSION = "4i.7-v1"

# AC 4i.7.4 - equal-weighted average, extreme values removed.
SIGMA_LIMIT = Decimal("3")

# AC 4i.7.1 - threshold that makes a festival "significantly fluctuating".
SIGNIFICANCE_RISE_PCT = Decimal("5")

# AC 4i.1.4 - a festival window is under-sampled below these limits.
MIN_OBSERVATION_DAYS = 14
MIN_SAMPLE_ITEMS = 30

# AC 4i.7.2 - the sample is the 50 best-covered items in the dataset.
SAMPLE_ITEM_COUNT = 50

# AC 4i.7.1 - baseline window used for the rise measurement.  A single first
# day is too noisy once the sample is split per state, so the baseline is the
# median of the first BASELINE_DAYS observations of the window.
BASELINE_DAYS = 14

# AC 4i.7.2 - window searched around a festival (days, inclusive).
PRE_WINDOW_DAYS = 60
POST_WINDOW_DAYS = 30


class RegisterError(ValueError):
    """Raised when the festival register is missing or malformed."""


@dataclass(frozen=True)
class Observance:
    """One date record for a festival; state-level festivals may have several."""

    start: date
    end: date
    kind: str
    states: tuple


@dataclass(frozen=True)
class Festival:
    id: str
    name_en: str
    name_zh: str
    scope: str
    states: tuple
    observances: tuple
    specialties: tuple
    source_url: str
    verified: bool

    @property
    def national(self) -> bool:
        return self.scope == "national"


@dataclass(frozen=True)
class PriceObservation:
    """One observed price for an item on a day (already de-duplicated)."""

    day: date
    item_code: str
    price: Decimal


@dataclass(frozen=True)
class WindowSeries:
    """Daily equal-weighted price index for one festival window."""

    days: tuple
    index: tuple
    observation_days: int
    sample_items: int

    @property
    def enough_sample(self) -> bool:
        return (
            self.observation_days >= MIN_OBSERVATION_DAYS
            and self.sample_items >= MIN_SAMPLE_ITEMS
        )


@dataclass(frozen=True)
class Significance:
    festival_id: str
    significant: bool
    rise_pct: object
    enough_sample: bool
    reason: str


def load_register(path, *, allow_unverified: bool = False):
    """Read and validate the hand-maintained festival register.

    The register is the only permitted source of festival dates: web scraping
    is prohibited by the unit rules, so every entry must carry a source_url.
    """

    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    entries = payload.get("festivals")
    if not isinstance(entries, list) or not entries:
        raise RegisterError("register contains no festivals")

    festivals = []
    seen = set()
    for raw in entries:
        try:
            scope = str(raw["scope"])
            states = tuple(str(s) for s in raw.get("states", []))
            observances = []
            for item in raw["observances"]:
                observances.append(
                    Observance(
                        start=date.fromisoformat(str(item["start"])),
                        end=date.fromisoformat(str(item["end"])),
                        kind=str(item.get("kind", "festival")),
                        states=tuple(str(s) for s in item.get("states", [])),
                    )
                )
            specialties = tuple(
                (str(s["name_en"]), str(s["name_zh"]))
                for s in raw.get("specialties", [])
            )
            festival = Festival(
                id=str(raw["id"]),
                name_en=str(raw["name_en"]),
                name_zh=str(raw["name_zh"]),
                scope=scope,
                states=states,
                observances=tuple(observances),
                specialties=specialties,
                source_url=str(raw["source_url"]),
                verified=bool(raw.get("verified", False)),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise RegisterError("invalid festival entry: " + repr(raw)) from exc

        if festival.id in seen:
            raise RegisterError("duplicate festival id: " + festival.id)
        if scope not in ("national", "state"):
            raise RegisterError(festival.id + ": scope must be national or state")
        if scope == "state" and not states:
            raise RegisterError(festival.id + ": state-level festival needs states")
        if not observances:
            raise RegisterError(festival.id + ": at least one observance is required")
        for obs in observances:
            if obs.end < obs.start:
                raise RegisterError(festival.id + ": end date precedes start date")
        if not festival.source_url.startswith("https://"):
            raise RegisterError(festival.id + ": source_url must be https")
        if not festival.verified and not allow_unverified:
            raise RegisterError(
                festival.id + ": date not verified against the official source; "
                "pass allow_unverified=True only for demo runs"
            )
        seen.add(festival.id)
        festivals.append(festival)

    return festivals


def sample_items(observations, *, top_n=SAMPLE_ITEM_COUNT):
    """Return the top_n items with the most price observations (AC 4i.7.2)."""

    counts = {}
    for observation in observations:
        counts[observation.item_code] = counts.get(observation.item_code, 0) + 1
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    return [item_code for item_code, _ in ranked[:top_n]]


def _to_decimal(value):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def window_bounds(observance, *, pre_days=PRE_WINDOW_DAYS, post_days=POST_WINDOW_DAYS):
    """Inclusive search window around one observance (AC 4i.7.2)."""

    return observance.start - timedelta(days=pre_days), observance.end + timedelta(days=post_days)


def applicable_states(festival):
    """States a festival applies to; national festivals apply to every state."""

    return None if festival.national else set(festival.states)


def applies_to_state(festival, state):
    allowed = applicable_states(festival)
    return allowed is None or state in allowed


def _drop_outliers(prices, sigma_limit):
    """Remove observations beyond sigma_limit standard deviations."""

    if len(prices) < 3:
        return list(prices)
    mean = sum(prices) / Decimal(len(prices))
    variance = sum((price - mean) ** 2 for price in prices) / Decimal(len(prices))
    sigma = variance.sqrt()
    if sigma == 0:
        return list(prices)
    limit = sigma * sigma_limit
    return [price for price in prices if abs(price - mean) <= limit]


def daily_index(observations, *, items, start, end, sigma_limit=SIGMA_LIMIT):
    """Equal-weighted daily index over items between start and end.

    Per day each item contributes the median of its non-outlier observations;
    the day index is the equal-weighted mean across contributing items, so no
    category weighting is applied (AC 4i.7.4).
    """

    allowed = set(items)
    per_day_item = {}
    for observation in observations:
        if observation.item_code not in allowed:
            continue
        if observation.day < start or observation.day > end:
            continue
        price = _to_decimal(observation.price)
        if price is None:
            continue
        per_day_item.setdefault(observation.day, {}).setdefault(
            observation.item_code, []
        ).append(price)

    days = []
    index = []
    for day in sorted(per_day_item):
        item_prices = []
        for prices in per_day_item[day].values():
            kept = _drop_outliers(prices, sigma_limit)
            if kept:
                item_prices.append(median(kept))
        if not item_prices:
            continue
        days.append(day)
        index.append(sum(item_prices) / Decimal(len(item_prices)))

    sample_items_count = len(
        {item for day in per_day_item for item in per_day_item[day]}
    )
    return WindowSeries(
        days=tuple(days),
        index=tuple(index),
        observation_days=len(days),
        sample_items=sample_items_count,
    )


def classify_significance(festival, series):
    """Decide whether a festival is significantly fluctuating (AC 4i.7.1)."""

    if not series.index:
        return Significance(festival.id, False, None, False, "no price observations")
    if not series.enough_sample:
        return Significance(festival.id, False, None, False, "insufficient sample")

    baseline = median(series.index[:BASELINE_DAYS])
    peak = max(series.index)
    if baseline <= 0:
        return Significance(festival.id, False, None, True, "invalid baseline")
    rise = (peak - baseline) / baseline * Decimal(100)
    significant = rise >= SIGNIFICANCE_RISE_PCT
    reason = "rise at or above threshold" if significant else "rise below threshold"
    return Significance(festival.id, significant, rise, True, reason)
