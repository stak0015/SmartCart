"""Compute festival significance per state from the PriceCatcher CSV dump.

Implements AC 4i.7.1 (register + significance) and AC 4i.7.2 (per festival-and-
state windows) of US 4i.7, Epic 4i.

The 552 MB / 22.3M-row dump is processed in two streaming passes and is never
loaded into memory or committed to the repository.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from smartcart.festival_analytics import (  # noqa: E402
    METHOD_VERSION,
    PRE_WINDOW_DAYS,
    RECOVERY_SEARCH_DAYS,
    SAMPLE_ITEM_COUNT,
    WINDOW_METHOD_VERSION,
    applicable_states,
    classify_significance,
    daily_index_from_prices,
    detect_key_windows,
    load_register,
    next_festival_start,
    sample_items,
    state_observance_span,
    state_window_bounds,
    window_bounds,
)

MALAYSIA_TZ = timezone.utc


def load_premise_states(data_dir):
    """Map premise_code -> state using lookup_premise.csv (AC 4i.7.2)."""

    mapping = {}
    path = Path(data_dir) / "lookup_premise.csv"
    if not path.exists():
        raise SystemExit("lookup_premise.csv not found in " + str(data_dir))
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            code = (row.get("premise_code") or "").strip()
            state = (row.get("state") or "").strip()
            if code and state:
                mapping[code] = state
    return mapping


def iter_rows(data_dir, states_by_premise):
    """Yield (day, item_code, state, price); rows without a known state drop."""

    files = sorted(Path(data_dir).glob("pricecatcher_*.csv"))
    if not files:
        raise SystemExit("no pricecatcher_*.csv files found in " + str(data_dir))
    for path in files:
        with path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                raw_day = (row.get("date") or "").strip()
                item_code = (row.get("item_code") or "").strip()
                premise_code = (row.get("premise_code") or "").strip()
                raw_price = (row.get("price") or "").strip()
                state = states_by_premise.get(premise_code)
                if not raw_day or not item_code or not raw_price or not state:
                    continue
                try:
                    day = date.fromisoformat(raw_day[:10])
                    price = Decimal(raw_price)
                except (ValueError, InvalidOperation):
                    continue
                if price <= 0:
                    continue
                yield day, item_code, state, price


def rank_items(data_dir, states_by_premise):
    counts = {}
    for _day, item_code, _state, _price in iter_rows(data_dir, states_by_premise):
        counts[item_code] = counts.get(item_code, 0) + 1
    return counts


def collect_sample_prices(data_dir, sample, states_by_premise):
    """Store each sample-item premise price once, keyed by state/day/item."""

    sample_set = set(sample)
    price_index = {}
    for day, item_code, state, price in iter_rows(data_dir, states_by_premise):
        if item_code not in sample_set:
            continue
        price_index.setdefault(state, {}).setdefault(day, {}).setdefault(
            item_code, []
        ).append(price)
    return price_index


def _decimal_text(value):
    return None if value is None else str(round(value, 2))


def _date_text(value):
    return None if value is None else value.isoformat()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--register", required=True)
    parser.add_argument("--out", default="festival_significance.json")
    parser.add_argument("--top-n", type=int, default=SAMPLE_ITEM_COUNT)
    parser.add_argument("--allow-unverified", action="store_true")
    args = parser.parse_args(argv)

    festivals = load_register(args.register, allow_unverified=args.allow_unverified)
    states_by_premise = load_premise_states(args.data_dir)

    counts = rank_items(args.data_dir, states_by_premise)
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    sample = [code for code, _ in ranked[: args.top_n]]
    if not sample:
        raise SystemExit("no usable price rows found")

    prices_by_state = collect_sample_prices(
        args.data_dir, sample, states_by_premise
    )
    if not prices_by_state:
        raise SystemExit("no usable sample prices found")

    all_states = sorted(set(states_by_premise.values()))
    results = []
    for festival in festivals:
        allowed = applicable_states(festival)
        targets = all_states if allowed is None else sorted(allowed)
        spans = [window_bounds(o) for o in festival.observances]
        win_start = min(s for s, _ in spans)
        win_end = max(e for _, e in spans)
        for state in targets:
            state_prices = prices_by_state.get(state, {})
            series = daily_index_from_prices(
                state_prices, items=sample, start=win_start, end=win_end
            )
            sig = classify_significance(festival, series)

            state_span = state_observance_span(festival, state)
            window = None
            window_status = "not_significant"
            next_start = None
            recovery_method = None
            recovery_search_start = None
            recovery_search_end = None
            if sig.significant and state_span is not None:
                next_start = next_festival_start(festivals, festival, state)
                recovery_limit = (
                    None
                    if next_start is None
                    else next_start - timedelta(days=1)
                )
                extended_start = state_span[0] - timedelta(days=PRE_WINDOW_DAYS)
                extended_end = state_span[1] + timedelta(days=RECOVERY_SEARCH_DAYS)
                if recovery_limit is not None and recovery_limit < extended_end:
                    extended_end = recovery_limit
                recovery_search_start = extended_start
                recovery_search_end = extended_end
                state_series = daily_index_from_prices(
                    state_prices,
                    items=sample,
                    start=extended_start,
                    end=extended_end,
                )
                window = detect_key_windows(
                    state_series, recovery_end_limit=recovery_limit
                )
                window_status = window.status
                recovery_method = (
                    "trough_before_next_festival"
                    if next_start is not None
                    else "trough_without_next_festival"
                )
                if window.status == "overlapped_by_next_festival":
                    fallback_bounds = state_window_bounds(festival, state)
                    fallback_series = daily_index_from_prices(
                        state_prices,
                        items=sample,
                        start=fallback_bounds[0],
                        end=fallback_bounds[1],
                    )
                    window = detect_key_windows(fallback_series)
                    window_status = "overlapped_by_next_festival"
                    recovery_method = "trough_within_post_window_overlap_fallback"
                    recovery_search_start = fallback_bounds[0]
                    recovery_search_end = fallback_bounds[1]
            elif sig.significant:
                window_status = "no_applicable_observance"

            baseline_value = None if window is None else _decimal_text(window.baseline)
            peak_value = None if window is None else _decimal_text(window.peak_value)
            peak_rise_pct = None
            if window is not None and window.baseline not in (None, Decimal("0")) and window.peak_value is not None:
                peak_rise_pct = _decimal_text(
                    (window.peak_value - window.baseline)
                    / window.baseline
                    * Decimal(100)
                )

            results.append({
                "festival_id": festival.id,
                "name_en": festival.name_en,
                "name_zh": festival.name_zh,
                "scope": festival.scope,
                "state": state,
                "start": win_start.isoformat(),
                "end": win_end.isoformat(),
                "observance_start": None if state_span is None else state_span[0].isoformat(),
                "observance_end": None if state_span is None else state_span[1].isoformat(),
                "specialties": [s[0] for s in festival.specialties],
                "significant": sig.significant,
                "rise_pct": None if sig.rise_pct is None else str(round(Decimal(sig.rise_pct), 2)),
                "enough_sample": sig.enough_sample,
                "reason": sig.reason,
                "observation_days": series.observation_days,
                "sample_items": series.sample_items,
                "excluded_observation_count": series.excluded_observations,
                "remaining_observation_count": series.remaining_observations,
                "exclusion_ratio": (
                    None
                    if series.excluded_observations + series.remaining_observations == 0
                    else _decimal_text(
                        Decimal(series.excluded_observations)
                        / Decimal(
                            series.excluded_observations
                            + series.remaining_observations
                        )
                    )
                ),
                "window_method_version": WINDOW_METHOD_VERSION,
                "window_status": window_status,
                "next_festival_start": (
                    None if next_start is None else next_start.isoformat()
                ),
                "recovery_method": recovery_method,
                "recovery_days": (
                    None
                    if window is None
                    or window.recovery_start is None
                    or window.recovery_end is None
                    else (window.recovery_end - window.recovery_start).days
                ),
                "recovery_below_baseline": (
                    None if window is None else window.recovery_below_baseline
                ),
                "recovery_value": (
                    None if window is None else _decimal_text(window.recovery_value)
                ),
                "recovery_search_start": (
                    None
                    if recovery_search_start is None
                    else recovery_search_start.isoformat()
                ),
                "recovery_search_end": (
                    None
                    if recovery_search_end is None
                    else recovery_search_end.isoformat()
                ),
                "rise_start": None if window is None else _date_text(window.rise_start),
                "rise_end": None if window is None else _date_text(window.rise_end),
                "recovery_start": None if window is None else _date_text(window.recovery_start),
                "recovery_end": None if window is None else _date_text(window.recovery_end),
                "baseline_value": baseline_value,
                "peak_value": peak_value,
                "peak_rise_pct": peak_rise_pct,
            })

    payload = {
        "method_version": METHOD_VERSION,
        "window_method_version": WINDOW_METHOD_VERSION,
        "computed_at": datetime.now(MALAYSIA_TZ).isoformat(timespec="seconds"),
        "sample_item_count": len(sample),
        "ranked_item_count": len(counts),
        "states": all_states,
        "rows": results,
    }
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")

    sig_rows = [r for r in results if r["significant"]]
    window_rows = [r for r in results if r["window_status"] == "ok"]
    print("method_version:", METHOD_VERSION)
    print("window_method_version:", WINDOW_METHOD_VERSION)
    print("states:", len(all_states), " sample items:", len(sample))
    print("rows:", len(results), " significant:", len(sig_rows), " windows_ok:", len(window_rows))
    for r in sig_rows:
        print("  %-26s %-22s rise=%-7s days=%-4d" % (r["festival_id"], r["state"], r["rise_pct"], r["observation_days"]))
    print("written:", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
