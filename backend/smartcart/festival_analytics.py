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

# AC 4i.7.2 - deterministic key-window detection (D4i.8).
WINDOW_METHOD_VERSION = "4i.7.2-v1"
WINDOW_SMOOTHING_OBSERVATIONS = 3
WINDOW_CONFIRMATION_OBSERVATIONS = 3
WINDOW_RISE_RATIO = Decimal("1.02")
WINDOW_RECOVERY_RATIO = Decimal("1.02")
RECOVERY_SEARCH_DAYS = 180


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
    excluded_observations: int = 0
    remaining_observations: int = 0

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

@dataclass(frozen=True)
class KeyWindowResult:
    """Result of the AC 4i.7.2 key-window detection."""

    status: str
    baseline: Decimal | None = None
    rise_start: date | None = None
    rise_end: date | None = None
    recovery_start: date | None = None
    recovery_end: date | None = None
    peak_value: Decimal | None = None
    recovery_below_baseline: bool | None = None
    recovery_value: Decimal | None = None


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

def observances_for_state(festival, state):
    """Return the date records that apply to one state (AC 4i.7.2)."""

    if not festival.national and state not in festival.states:
        return ()
    return tuple(
        observance
        for observance in festival.observances
        if not observance.states or state in observance.states
    )


def state_observance_span(festival, state):
    """Return the first and last observance dates for one state."""

    observances = observances_for_state(festival, state)
    if not observances:
        return None
    return (
        min(observance.start for observance in observances),
        max(observance.end for observance in observances),
    )


def state_window_bounds(
    festival, state, *, pre_days=PRE_WINDOW_DAYS, post_days=POST_WINDOW_DAYS
):
    """Return the inclusive search window for one festival-and-state pair."""

    span = state_observance_span(festival, state)
    if span is None:
        return None
    start, end = span
    return start - timedelta(days=pre_days), end + timedelta(days=post_days)


def next_festival_start(festivals, current, state):
    """Return the next applicable festival start after one state observance."""

    span = state_observance_span(current, state)
    if span is None:
        return None
    current_end = span[1]
    starts = []
    for festival in festivals:
        if festival.id == current.id or not applies_to_state(festival, state):
            continue
        other_span = state_observance_span(festival, state)
        if other_span is not None and other_span[0] > current_end:
            starts.append(other_span[0])
    return min(starts) if starts else None


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


def _filter_item_observations(observations, sigma_limit):
    """Filter raw observations against one item's window-level mean/sigma."""

    if len(observations) < 3:
        return list(observations)
    prices = [price for _, price in observations]
    mean = sum(prices) / Decimal(len(prices))
    variance = sum((price - mean) ** 2 for price in prices) / Decimal(len(prices))
    sigma = variance.sqrt()
    if sigma == 0:
        return list(observations)
    limit = sigma * sigma_limit
    return [
        (day, price)
        for day, price in observations
        if abs(price - mean) <= limit
    ]


def _daily_index_from_per_item(per_item, sigma_limit):
    total_observations = sum(len(pairs) for pairs in per_item.values())
    remaining_observations = 0
    contributing_items = set()
    per_day_item = {}
    for item_code, pairs in per_item.items():
        kept = _filter_item_observations(pairs, sigma_limit)
        if not kept:
            continue
        contributing_items.add(item_code)
        remaining_observations += len(kept)
        for day, price in kept:
            per_day_item.setdefault(day, {}).setdefault(item_code, []).append(price)

    days = []
    index = []
    for day in sorted(per_day_item):
        item_prices = [
            median(prices)
            for prices in per_day_item[day].values()
            if prices
        ]
        if not item_prices:
            continue
        days.append(day)
        index.append(sum(item_prices) / Decimal(len(item_prices)))

    return WindowSeries(
        days=tuple(days),
        index=tuple(index),
        observation_days=len(days),
        sample_items=len(contributing_items),
        excluded_observations=total_observations - remaining_observations,
        remaining_observations=remaining_observations,
    )


def daily_index(observations, *, items, start, end, sigma_limit=SIGMA_LIMIT):
    """Equal-weighted daily index over raw PriceObservation inputs."""

    allowed = set(items)
    per_item = {}
    for observation in observations:
        if observation.item_code not in allowed:
            continue
        if observation.day < start or observation.day > end:
            continue
        price = _to_decimal(observation.price)
        if price is None:
            continue
        per_item.setdefault(observation.item_code, []).append(
            (observation.day, price)
        )
    return _daily_index_from_per_item(per_item, sigma_limit)


def daily_index_from_prices(price_index, *, items, start, end, sigma_limit=SIGMA_LIMIT):
    """Equal-weighted daily index over state -> day -> item -> raw prices."""

    allowed = set(items)
    per_item = {}
    for day, day_items in price_index.items():
        if day < start or day > end:
            continue
        for item_code, prices in day_items.items():
            if item_code not in allowed:
                continue
            for raw_price in prices:
                price = _to_decimal(raw_price)
                if price is None:
                    continue
                per_item.setdefault(item_code, []).append((day, price))
    return _daily_index_from_per_item(per_item, sigma_limit)


def smooth_index(series, *, window=WINDOW_SMOOTHING_OBSERVATIONS):
    """Smooth a daily index with a centred rolling median over observations."""

    if window < 1:
        raise ValueError("window must be at least 1")
    if window % 2 == 0:
        raise ValueError("window must be odd")
    half = window // 2
    smoothed = []
    for position in range(len(series.index)):
        first = max(0, position - half)
        last = min(len(series.index), position + half + 1)
        smoothed.append(median(series.index[first:last]))
    return WindowSeries(
        days=series.days,
        index=tuple(smoothed),
        observation_days=series.observation_days,
        sample_items=series.sample_items,
        excluded_observations=series.excluded_observations,
        remaining_observations=series.remaining_observations,
    )


def _first_confirmed_run(values, predicate, start, run_length):
    matches = 0
    for position in range(start, len(values)):
        if predicate(values[position]):
            matches += 1
            if matches >= run_length:
                return position - run_length + 1
        else:
            matches = 0
    return None


def detect_key_windows(series, *, recovery_end_limit=None):
    """Detect price-rise and peak-to-trough recovery windows.

    The rise side keeps the approved three-observation confirmation.  The
    recovery side deliberately uses the lowest smoothed observation after the
    peak, optionally bounded by the day before the next applicable festival.
    """

    if not series.index:
        return KeyWindowResult("no_price_observations")
    if not series.enough_sample:
        return KeyWindowResult("insufficient_sample")
    if len(series.index) < BASELINE_DAYS + WINDOW_CONFIRMATION_OBSERVATIONS:
        return KeyWindowResult("insufficient_sample")

    smoothed = smooth_index(series)
    baseline = median(smoothed.index[:BASELINE_DAYS])
    if baseline <= 0:
        return KeyWindowResult("invalid_baseline", baseline=baseline)

    rise_threshold = baseline * WINDOW_RISE_RATIO
    rise_start_index = _first_confirmed_run(
        smoothed.index,
        lambda value: value >= rise_threshold,
        BASELINE_DAYS,
        WINDOW_CONFIRMATION_OBSERVATIONS,
    )
    if rise_start_index is None:
        return KeyWindowResult("no_rise", baseline=baseline)

    peak_index = max(
        range(rise_start_index, len(smoothed.index)),
        key=lambda position: (smoothed.index[position], -position),
    )
    peak_value = smoothed.index[peak_index]
    recovery_start = smoothed.days[peak_index]
    common = {
        "baseline": baseline,
        "rise_start": smoothed.days[rise_start_index],
        "rise_end": recovery_start,
        "peak_value": peak_value,
    }

    if peak_index + 1 >= len(smoothed.index):
        return KeyWindowResult(
            "recovery_not_reached",
            recovery_start=recovery_start,
            **common,
        )

    if recovery_end_limit is not None and recovery_start >= recovery_end_limit:
        return KeyWindowResult(
            "overlapped_by_next_festival",
            recovery_start=recovery_start,
            **common,
        )

    limit_index = len(smoothed.index) - 1
    if recovery_end_limit is not None:
        eligible = [
            position
            for position, day in enumerate(smoothed.days)
            if day <= recovery_end_limit
        ]
        if not eligible:
            return KeyWindowResult(
                "overlapped_by_next_festival",
                recovery_start=recovery_start,
                **common,
            )
        limit_index = eligible[-1]

    if limit_index <= peak_index:
        return KeyWindowResult(
            "overlapped_by_next_festival",
            recovery_start=recovery_start,
            **common,
        )

    trough_index = min(
        range(peak_index + 1, limit_index + 1),
        key=lambda position: (smoothed.index[position], position),
    )
    trough_value = smoothed.index[trough_index]
    recovery_threshold = baseline * WINDOW_RECOVERY_RATIO
    return KeyWindowResult(
        "ok",
        recovery_start=recovery_start,
        recovery_end=smoothed.days[trough_index],
        recovery_below_baseline=trough_value <= recovery_threshold,
        recovery_value=trough_value,
        **common,
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
