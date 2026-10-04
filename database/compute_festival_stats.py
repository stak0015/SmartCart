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
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from smartcart.festival_analytics import (  # noqa: E402
    METHOD_VERSION,
    SAMPLE_ITEM_COUNT,
    PriceObservation,
    applicable_states,
    classify_significance,
    daily_index,
    load_register,
    sample_items,
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


def collect(data_dir, festivals, sample, states_by_premise):
    """Bucket observations per festival, state, day and sample item."""

    windows = []
    for festival in festivals:
        for observance in festival.observances:
            start, end = window_bounds(observance)
            windows.append((festival.id, start, end))

    sample_set = set(sample)
    buckets = {f.id: {} for f in festivals}
    for day, item_code, state, price in iter_rows(data_dir, states_by_premise):
        if item_code not in sample_set:
            continue
        for festival_id, start, end in windows:
            if start <= day <= end:
                buckets[festival_id].setdefault(state, {}).setdefault(day, {}).setdefault(
                    item_code, []
                ).append(price)
    return buckets


def flatten(state_days):
    observations = []
    for day in sorted(state_days):
        for item_code, prices in state_days[day].items():
            observations.append(
                PriceObservation(day=day, item_code=item_code, price=sum(prices) / Decimal(len(prices)))
            )
    return observations


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

    buckets = collect(args.data_dir, festivals, sample, states_by_premise)

    all_states = sorted(set(states_by_premise.values()))
    results = []
    for festival in festivals:
        allowed = applicable_states(festival)
        targets = all_states if allowed is None else sorted(allowed)
        spans = [window_bounds(o) for o in festival.observances]
        win_start = min(s for s, _ in spans)
        win_end = max(e for _, e in spans)
        for state in targets:
            observations = flatten(buckets[festival.id].get(state, {}))
            series = daily_index(observations, items=sample, start=win_start, end=win_end)
            sig = classify_significance(festival, series)
            results.append({
                "festival_id": festival.id,
                "name_en": festival.name_en,
                "name_zh": festival.name_zh,
                "scope": festival.scope,
                "state": state,
                "start": win_start.isoformat(),
                "end": win_end.isoformat(),
                "specialties": [s[0] for s in festival.specialties],
                "significant": sig.significant,
                "rise_pct": None if sig.rise_pct is None else str(round(Decimal(sig.rise_pct), 2)),
                "enough_sample": sig.enough_sample,
                "reason": sig.reason,
                "observation_days": series.observation_days,
                "sample_items": series.sample_items,
            })

    payload = {
        "method_version": METHOD_VERSION,
        "computed_at": datetime.now(MALAYSIA_TZ).isoformat(timespec="seconds"),
        "sample_item_count": len(sample),
        "ranked_item_count": len(counts),
        "states": all_states,
        "rows": results,
    }
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")

    sig_rows = [r for r in results if r["significant"]]
    print("method_version:", METHOD_VERSION)
    print("states:", len(all_states), " sample items:", len(sample))
    print("rows:", len(results), " significant:", len(sig_rows))
    for r in sig_rows:
        print("  %-26s %-22s rise=%-7s days=%-4d" % (r["festival_id"], r["state"], r["rise_pct"], r["observation_days"]))
    print("written:", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
