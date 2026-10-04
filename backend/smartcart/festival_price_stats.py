"""Item-level festival price statistics for AC 4i.7.3."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from statistics import median
from typing import Iterable, Mapping, Sequence

PRICE_STATS_METHOD_VERSION = "4i.7.3-v1"
SIGMA_LIMIT = Decimal("3")
MIN_BASELINE_DAYS = 3
FULL_BASELINE_DAYS = 14
PERCENT = Decimal("100")


@dataclass(frozen=True)
class ItemWindowStats:
    """One item's prices and movement within a festival-state window."""

    item_code: str
    status: str
    sample_status: str = "insufficient"
    rise_status: str | None = None
    baseline_price: Decimal | None = None
    baseline_date: date | None = None
    peak_price: Decimal | None = None
    peak_date: date | None = None
    recovery_price: Decimal | None = None
    recovery_date: date | None = None
    rise_pct: Decimal | None = None
    recovery_pct: Decimal | None = None
    recovery_vs_baseline_pct: Decimal | None = None
    observation_count: int = 0
    excluded_observation_count: int = 0
    observed_days: int = 0


def _to_decimal(value):
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def filter_window_observations(
    observations: Iterable[tuple[date, object]],
    *,
    start: date,
    end: date,
    sigma_limit: Decimal = SIGMA_LIMIT,
) -> tuple[list[tuple[date, Decimal]], int]:
    """Filter raw observations for one item and one festival-state window."""

    in_window: list[tuple[date, Decimal]] = []
    for day, raw_price in observations:
        if day < start or day > end:
            continue
        price = _to_decimal(raw_price)
        if price is None:
            continue
        in_window.append((day, price))

    if len(in_window) < 3:
        return in_window, 0

    prices = [price for _, price in in_window]
    mean = sum(prices) / Decimal(len(prices))
    variance = sum((price - mean) ** 2 for price in prices) / Decimal(len(prices))
    sigma = variance.sqrt()
    if sigma == 0:
        return in_window, 0
    limit = sigma * sigma_limit
    kept = [
        (day, price)
        for day, price in in_window
        if abs(price - mean) <= limit
    ]
    return kept, len(in_window) - len(kept)


def daily_item_medians(
    observations: Iterable[tuple[date, Decimal]],
) -> dict[date, Decimal]:
    """Return one median price per observed day for a single item."""

    by_day: dict[date, list[Decimal]] = {}
    for day, price in observations:
        by_day.setdefault(day, []).append(price)
    return {day: median(prices) for day, prices in by_day.items()}


def _baseline(daily: Mapping[date, Decimal], minimum_days: int):
    days = sorted(daily)
    if len(days) < minimum_days:
        return None, None
    baseline_days = days[:minimum_days]
    return median([daily[day] for day in baseline_days]), baseline_days[-1]


def _highest_between(daily: Mapping[date, Decimal], start: date, end: date):
    candidates = [
        (day, price)
        for day, price in daily.items()
        if start <= day <= end
    ]
    if not candidates:
        return None, None
    day, price = max(
        candidates, key=lambda pair: (pair[1], -pair[0].toordinal())
    )
    return price, day


def _lowest_after(
    daily: Mapping[date, Decimal], after: date, end: date
):
    candidates = [
        (day, price)
        for day, price in daily.items()
        if after < day <= end
    ]
    if not candidates:
        return None, None
    day, price = min(candidates, key=lambda pair: (pair[1], pair[0]))
    return price, day


def _percent_change(value: Decimal | None, reference: Decimal | None):
    if value is None or reference is None or reference <= 0:
        return None
    return (value - reference) / reference * PERCENT


def compute_item_window_stats(
    item_code: str,
    observations: Iterable[tuple[date, object]],
    *,
    start: date,
    end: date,
    window_status: str,
    rise_start: date | None,
    rise_end: date | None,
    recovery_end: date | None,
    minimum_baseline_days: int = MIN_BASELINE_DAYS,
    sigma_limit: Decimal = SIGMA_LIMIT,
) -> ItemWindowStats:
    """Calculate one item's actual prices and percentage movement."""

    kept, excluded = filter_window_observations(
        observations, start=start, end=end, sigma_limit=sigma_limit
    )
    if not kept:
        return ItemWindowStats(
            item_code=item_code,
            status="no_price_observations",
            sample_status="insufficient",
            observation_count=0,
            excluded_observation_count=excluded,
        )

    daily = daily_item_medians(kept)
    sample_status = (
        "full" if len(daily) >= FULL_BASELINE_DAYS else "limited"
    )
    baseline, baseline_date = _baseline(daily, minimum_baseline_days)
    base = ItemWindowStats(
        item_code=item_code,
        status="insufficient_baseline",
        sample_status="insufficient",
        baseline_price=baseline,
        baseline_date=baseline_date,
        observation_count=len(kept),
        excluded_observation_count=excluded,
        observed_days=len(daily),
    )
    if baseline is None:
        return base

    if window_status != "ok" or rise_start is None or rise_end is None:
        return ItemWindowStats(
            **{
                **base.__dict__,
                "status": "window_not_ready",
                "sample_status": sample_status,
            }
        )

    peak, peak_date = _highest_between(daily, rise_start, rise_end)
    if peak is None or peak_date is None:
        return ItemWindowStats(
            **{
                **base.__dict__,
                "status": "no_peak",
                "sample_status": sample_status,
            }
        )

    if recovery_end is None:
        recovery, recovery_date = None, None
    else:
        recovery, recovery_date = _lowest_after(daily, peak_date, recovery_end)

    if recovery is None or recovery_date is None:
        rise_pct = _percent_change(peak, baseline)
        return ItemWindowStats(
            **{
                **base.__dict__,
                "status": "no_recovery",
                "sample_status": sample_status,
                "peak_price": peak,
                "peak_date": peak_date,
                "rise_pct": rise_pct,
                "rise_status": (
                    None
                    if rise_pct is None
                    else ("rise" if rise_pct > 0 else "flat_or_fall")
                ),
            }
        )

    rise_pct = _percent_change(peak, baseline)
    return ItemWindowStats(
        item_code=item_code,
        status="ok",
        sample_status=sample_status,
        rise_status=(
            None if rise_pct is None else ("rise" if rise_pct > 0 else "flat_or_fall")
        ),
        baseline_price=baseline,
        baseline_date=baseline_date,
        peak_price=peak,
        peak_date=peak_date,
        recovery_price=recovery,
        recovery_date=recovery_date,
        rise_pct=rise_pct,
        recovery_pct=_percent_change(recovery, peak),
        recovery_vs_baseline_pct=_percent_change(recovery, baseline),
        observation_count=len(kept),
        excluded_observation_count=excluded,
        observed_days=len(daily),
    )


def _numeric(value):
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def summarize_categories(rows: Sequence[Mapping[str, object]]):
    """Aggregate item-level percentage movement by broad category."""

    groups: dict[tuple[str, str, str], list[Mapping[str, object]]] = {}
    for row in rows:
        key = (
            str(row["festival_id"]),
            str(row["state"]),
            str(row["broad_category_id"]),
        )
        groups.setdefault(key, []).append(row)

    summaries = []
    for (festival_id, state, category_id), members in sorted(groups.items()):
        ok_members = [
            member
            for member in members
            if member.get("status") == "ok" and member.get("rise_pct") is not None
        ]
        rises = [
            value
            for value in (_numeric(member.get("rise_pct")) for member in ok_members)
            if value is not None
        ]
        positive_rises = [value for value in rises if value > 0]
        recoveries = [
            value
            for value in (
                _numeric(member.get("recovery_pct")) for member in ok_members
            )
            if value is not None
        ]
        summaries.append(
            {
                "festival_id": festival_id,
                "state": state,
                "broad_category_id": category_id,
                "item_count": len(members),
                "ok_item_count": len(ok_members),
                "rising_item_count": len(positive_rises),
                "falling_or_flat_item_count": len(rises) - len(positive_rises),
                "average_rise_pct": (
                    None
                    if not rises
                    else sum(rises) / Decimal(len(rises))
                ),
                "average_positive_rise_pct": (
                    None
                    if not positive_rises
                    else sum(positive_rises) / Decimal(len(positive_rises))
                ),
                "median_rise_pct": None if not rises else median(rises),
                "average_recovery_pct": (
                    None
                    if not recoveries
                    else sum(recoveries) / Decimal(len(recoveries))
                ),
            }
        )
    return summaries


RISE_RATIO_METHOD_VERSION = "4i.7.4-v1"
MIN_RATIO_ITEMS = 30


def _ratio_summary(group_rows, *, unique_items=False, window_status="ok", skipped_state_count=0):
    price_rows = list(group_rows)
    if unique_items:
        by_item = {}
        for row in price_rows:
            by_item.setdefault(str(row.get("item_code")), []).append(row)
        eligible_item_groups = [
            rows
            for rows in by_item.values()
            if any(row.get("status") == "ok" for row in rows)
        ]
        rising_values = []
        all_eligible_values = []
        for rows in by_item.values():
            positive = [
                value
                for value in (
                    _numeric(row.get("rise_pct"))
                    for row in rows
                    if row.get("status") == "ok"
                    and row.get("rise_status") == "rise"
                )
                if value is not None
            ]
            if positive:
                rising_values.append(sum(positive) / Decimal(len(positive)))
            all_values = [
                value
                for value in (
                    _numeric(row.get("rise_pct"))
                    for row in rows
                    if row.get("status") == "ok"
                )
                if value is not None
            ]
            if all_values:
                all_eligible_values.append(
                    sum(all_values) / Decimal(len(all_values))
                )
        price_item_count = len(by_item)
        eligible_item_count = len(eligible_item_groups)
        flat_or_fall_count = eligible_item_count - len(rising_values)
        rising_item_count = len(rising_values)
    else:
        eligible = [row for row in price_rows if row.get("status") == "ok"]
        rising = [
            row
            for row in eligible
            if row.get("rise_status") == "rise"
            and _numeric(row.get("rise_pct")) is not None
        ]
        rising_values = [_numeric(row.get("rise_pct")) for row in rising]
        rising_values = [value for value in rising_values if value is not None]
        all_eligible_values = [
            value
            for value in (_numeric(row.get("rise_pct")) for row in eligible)
            if value is not None
        ]
        price_item_count = len(price_rows)
        eligible_item_count = len(eligible)
        rising_item_count = len(rising_values)
        flat_or_fall_count = eligible_item_count - len(rising_values)

    observation_count = sum(int(row.get("observation_count") or 0) for row in price_rows)
    excluded_count = sum(
        int(row.get("excluded_observation_count") or 0) for row in price_rows
    )
    total_observations = observation_count + excluded_count
    sample_status_counts = {"full": 0, "limited": 0, "insufficient": 0}
    for row in price_rows:
        sample_status = str(row.get("sample_status") or "insufficient")
        if sample_status not in sample_status_counts:
            sample_status = "insufficient"
        sample_status_counts[sample_status] += 1

    first = price_rows[0] if price_rows else {}
    return {
        "festival_id": first.get("festival_id"),
        "name_en": first.get("name_en"),
        "name_zh": first.get("name_zh"),
        "ratio_status": (
            "ok" if len(rising_values) >= MIN_RATIO_ITEMS else "insufficient_item_sample"
        ),
        "avg_rise_ratio": (
            None if not rising_values else sum(rising_values) / Decimal(len(rising_values))
        ),
        "avg_net_change_ratio": (
            None
            if not all_eligible_values
            else sum(all_eligible_values) / Decimal(len(all_eligible_values))
        ),
        "median_rise_ratio": None if not rising_values else median(rising_values),
        "price_item_count": price_item_count,
        "eligible_item_count": eligible_item_count,
        "rising_item_count": rising_item_count,
        "flat_or_fall_item_count": flat_or_fall_count,
        "observation_count": observation_count,
        "total_observation_count": total_observations,
        "excluded_observation_count": excluded_count,
        "remaining_observation_count": observation_count,
        "exclusion_ratio": (
            None
            if total_observations == 0
            else Decimal(excluded_count) / Decimal(total_observations)
        ),
        "window_status": window_status,
        "skipped_state_count": skipped_state_count,
        "sample_status_counts": sample_status_counts,
    }


def _empty_ratio_summary(festival_id, state, meta, window_status):
    return {
        "festival_id": festival_id,
        "name_en": None if meta is None else meta.get("name_en"),
        "name_zh": None if meta is None else meta.get("name_zh"),
        "state": state,
        "ratio_status": "window_not_ready",
        "window_status": window_status,
        "avg_rise_ratio": None,
        "avg_net_change_ratio": None,
        "median_rise_ratio": None,
        "price_item_count": 0,
        "eligible_item_count": 0,
        "rising_item_count": 0,
        "flat_or_fall_item_count": 0,
        "observation_count": 0,
        "total_observation_count": 0,
        "excluded_observation_count": 0,
        "remaining_observation_count": 0,
        "exclusion_ratio": None,
        "skipped_state_count": 0,
        "sample_status_counts": {"full": 0, "limited": 0, "insufficient": 0},
    }


def compute_rise_ratios(rows, *, skipped_windows=(), festival_meta=None):
    """Return festival-level and festival-state average rise ratios."""

    festival_groups = {}
    state_groups = {}
    for row in rows:
        festival_id = str(row["festival_id"])
        state = str(row["state"])
        festival_groups.setdefault(festival_id, []).append(row)
        state_groups.setdefault((festival_id, state), []).append(row)

    skipped_by_festival = {}
    skipped_states = set()
    for skipped in skipped_windows:
        festival_id = str(skipped.get("festival_id"))
        state = str(skipped.get("state"))
        skipped_states.add((festival_id, state))
        skipped_by_festival[festival_id] = skipped_by_festival.get(festival_id, 0) + 1

    meta = festival_meta or {}
    festival_ratios = [
        _ratio_summary(
            group,
            unique_items=True,
            skipped_state_count=skipped_by_festival.get(festival_id, 0),
        )
        for festival_id, group in sorted(festival_groups.items())
    ]
    state_ratios = []
    for (festival_id, state), group in sorted(state_groups.items()):
        summary = _ratio_summary(group)
        summary["state"] = state
        summary["festival_id"] = festival_id
        state_ratios.append(summary)

    existing_states = {(row["festival_id"], row["state"]) for row in state_ratios}
    for skipped in skipped_windows:
        key = (str(skipped.get("festival_id")), str(skipped.get("state")))
        if key in existing_states:
            continue
        summary = _empty_ratio_summary(
            key[0], key[1], meta.get(key), skipped.get("window_status")
        )
        state_ratios.append(summary)
        existing_states.add(key)

    existing_festivals = {row["festival_id"] for row in festival_ratios}
    for festival_id, count in sorted(skipped_by_festival.items()):
        if festival_id in existing_festivals:
            continue
        name_meta = next(
            (
                value
                for (fid, _state), value in meta.items()
                if fid == festival_id
            ),
            None,
        )
        summary = _empty_ratio_summary(
            festival_id, None, name_meta, "all_states_window_not_ready"
        )
        summary["skipped_state_count"] = count
        festival_ratios.append(summary)

    state_ratios.sort(key=lambda row: (row["festival_id"], row["state"] or ""))
    festival_ratios.sort(key=lambda row: row["festival_id"])
    return {
        "festival_rise_ratios": festival_ratios,
        "festival_state_rise_ratios": state_ratios,
    }
