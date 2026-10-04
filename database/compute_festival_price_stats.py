"""Compute item-level festival price statistics for AC 4i.7.3.

The script consumes the AC 4i.7.2 windows JSON and streams the PriceCatcher CSV
dump once into per-state temporary partitions.  Each state is then processed in
memory so that every price-covered item can be evaluated without holding the
whole 22M-row dump at once.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import tempfile
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from smartcart.categories import CATEGORIES_BY_ID, category_for_raw  # noqa: E402
from smartcart.festival_price_stats import (  # noqa: E402
    PRICE_STATS_METHOD_VERSION,
    compute_item_window_stats,
    summarize_categories,
)

MALAYSIA_TZ = timezone.utc


def load_premise_states(data_dir):
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


def load_lookup_items(path):
    items = {}
    with Path(path).open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            code = (row.get("item_code") or "").strip()
            if not code:
                continue
            items[code] = {
                "item": (row.get("item") or "").strip(),
                "unit": (row.get("unit") or "").strip(),
                "item_group": (row.get("item_group") or "").strip(),
                "item_category": (row.get("item_category") or "").strip(),
            }
    return items


def iter_rows(data_dir, states_by_premise):
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
                yield day, state, item_code, price


def _state_file_name(state):
    safe = "".join(ch if ch.isalnum() else "_" for ch in state).strip("_")
    return (safe or "state") + ".tsv"


def partition_by_state(data_dir, states_by_premise, temp_dir):
    paths = {}
    writers = {}
    handles = []
    try:
        for state in sorted(set(states_by_premise.values())):
            path = Path(temp_dir) / _state_file_name(state)
            handle = path.open("w", encoding="utf-8", newline="")
            handles.append(handle)
            writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
            writers[state] = writer
            paths[state] = path
        for day, state, item_code, price in iter_rows(data_dir, states_by_premise):
            writers[state].writerow([day.isoformat(), item_code, str(price)])
    finally:
        for handle in handles:
            handle.close()
    return paths


def load_state_prices(path):
    prices = defaultdict(list)
    with Path(path).open(encoding="utf-8", newline="") as handle:
        for row in csv.reader(handle, delimiter="\t"):
            if len(row) != 3:
                continue
            day = date.fromisoformat(row[0])
            prices[row[1]].append((day, Decimal(row[2])))
    return prices


def _date_value(value):
    return None if value is None else date.fromisoformat(value)


def load_window_specs(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    specs = []
    skipped = []
    for row in payload.get("rows", []):
        if not row.get("significant"):
            continue
        if row.get("window_status") != "ok":
            skipped.append(
                {
                    "festival_id": row.get("festival_id"),
                    "state": row.get("state"),
                    "window_status": row.get("window_status"),
                }
            )
            continue
        start = row.get("recovery_search_start") or row.get("start")
        end = row.get("recovery_search_end") or row.get("end")
        if not start or not end:
            skipped.append(
                {
                    "festival_id": row.get("festival_id"),
                    "state": row.get("state"),
                    "window_status": "missing_search_bounds",
                }
            )
            continue
        specs.append(
            {
                "festival_id": row["festival_id"],
                "name_en": row.get("name_en"),
                "name_zh": row.get("name_zh"),
                "scope": row.get("scope"),
                "state": row["state"],
                "observance_start": _date_value(row.get("observance_start")),
                "observance_end": _date_value(row.get("observance_end")),
                "search_start": _date_value(start),
                "search_end": _date_value(end),
                "rise_start": _date_value(row.get("rise_start")),
                "rise_end": _date_value(row.get("rise_end")),
                "recovery_end": _date_value(row.get("recovery_end")),
                "next_festival_start": _date_value(row.get("next_festival_start")),
                "window_status": row.get("window_status"),
            }
        )
    return payload, specs, skipped


def _decimal_text(value):
    return None if value is None else str(round(value, 2))


def _category_metadata(raw_category):
    category = category_for_raw(raw_category)
    if category is None:
        category = CATEGORIES_BY_ID["other"]
    return category.id, category.label_en, category.label_ms


def serialize_item(spec, item_code, metadata, stats):
    broad_id, label_en, label_ms = _category_metadata(metadata.get("item_category"))
    row = {
        "festival_id": spec["festival_id"],
        "name_en": spec["name_en"],
        "name_zh": spec["name_zh"],
        "scope": spec["scope"],
        "state": spec["state"],
        "observance_start": None if spec["observance_start"] is None else spec["observance_start"].isoformat(),
        "observance_end": None if spec["observance_end"] is None else spec["observance_end"].isoformat(),
        "item_code": item_code,
        "item_name": metadata.get("item", ""),
        "unit": metadata.get("unit", ""),
        "source_item_group": metadata.get("item_group", ""),
        "source_category": metadata.get("item_category", ""),
        "broad_category_id": broad_id,
        "broad_category_label_en": label_en,
        "broad_category_label_ms": label_ms,
        "status": stats.status,
        "sample_status": stats.sample_status,
        "rise_status": stats.rise_status,
        "baseline_price": _decimal_text(stats.baseline_price),
        "baseline_date": None if stats.baseline_date is None else stats.baseline_date.isoformat(),
        "peak_price": _decimal_text(stats.peak_price),
        "peak_date": None if stats.peak_date is None else stats.peak_date.isoformat(),
        "recovery_price": _decimal_text(stats.recovery_price),
        "recovery_date": None if stats.recovery_date is None else stats.recovery_date.isoformat(),
        "rise_pct": _decimal_text(stats.rise_pct),
        "recovery_pct": _decimal_text(stats.recovery_pct),
        "recovery_vs_baseline_pct": _decimal_text(stats.recovery_vs_baseline_pct),
        "observation_count": stats.observation_count,
        "excluded_observation_count": stats.excluded_observation_count,
        "observed_days": stats.observed_days,
    }
    return row


def serialize_summary(summary):
    result = dict(summary)
    for key in (
        "average_rise_pct",
        "average_positive_rise_pct",
        "median_rise_pct",
        "average_recovery_pct",
    ):
        result[key] = _decimal_text(result.get(key))
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--windows", required=True)
    parser.add_argument("--lookup-item", required=True)
    parser.add_argument("--out", default="festival_price_stats.json")
    args = parser.parse_args(argv)

    window_payload, specs, skipped = load_window_specs(args.windows)
    states_by_premise = load_premise_states(args.data_dir)
    lookup_items = load_lookup_items(args.lookup_item)
    specs_by_state = defaultdict(list)
    for spec in specs:
        specs_by_state[spec["state"]].append(spec)

    item_rows = []
    with tempfile.TemporaryDirectory(prefix="smartcart_festival_price_") as temp_dir:
        state_paths = partition_by_state(
            args.data_dir, states_by_premise, temp_dir
        )
        for state, path in state_paths.items():
            state_specs = specs_by_state.get(state, [])
            if not state_specs:
                continue
            state_prices = load_state_prices(path)
            for spec in state_specs:
                for item_code, observations in state_prices.items():
                    stats = compute_item_window_stats(
                        item_code,
                        observations,
                        start=spec["search_start"],
                        end=spec["search_end"],
                        window_status=spec["window_status"],
                        rise_start=spec["rise_start"],
                        rise_end=spec["rise_end"],
                        recovery_end=spec["recovery_end"],
                    )
                    metadata = lookup_items.get(item_code, {})
                    item_rows.append(
                        serialize_item(spec, item_code, metadata, stats)
                    )
            del state_prices

    category_rows = [
        serialize_summary(summary)
        for summary in summarize_categories(item_rows)
    ]
    payload = {
        "price_stats_method_version": PRICE_STATS_METHOD_VERSION,
        "computed_at": datetime.now(MALAYSIA_TZ).isoformat(timespec="seconds"),
        "window_source": str(args.windows),
        "source_method_version": window_payload.get("method_version"),
        "window_method_version": window_payload.get("window_method_version"),
        "window_count": len(specs),
        "item_row_count": len(item_rows),
        "skipped_windows": skipped,
        "items": item_rows,
        "category_summaries": category_rows,
    }
    Path(args.out).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + chr(10),
        encoding="utf-8",
    )
    statuses = defaultdict(int)
    for row in item_rows:
        statuses[row["status"]] += 1
    print("price_stats_method_version:", PRICE_STATS_METHOD_VERSION)
    print("windows:", len(specs), " item rows:", len(item_rows))
    print("statuses:", dict(statuses))
    print("written:", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
