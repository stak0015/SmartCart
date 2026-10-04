"""Compute AC 4i.7.5 festival historical average prices.

For each significant festival-state window and each price-covered item, the
script prefers the previous-year counterpart of the key price-rise window,
then falls back to the most recent prior occurrence, then to the current rise
window.  The fallback method is always recorded.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from smartcart.categories import CATEGORIES_BY_ID, category_for_raw  # noqa: E402
from smartcart.festival_price_stats import (  # noqa: E402
    HISTORICAL_PRICE_METHOD_VERSION,
    HistoricalPriceResult,
    compute_historical_price,
    shift_year,
)
from compute_festival_price_stats import (  # noqa: E402
    load_premise_states,
    load_state_prices,
    partition_by_state,
)

MALAYSIA_TZ = timezone.utc


def _date(value):
    return None if not value else date.fromisoformat(value)


def _load_specs(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = payload.get("rows", [])
    significant = [row for row in rows if row.get("significant")]
    specs = []
    for row in significant:
        current_start = _date(row.get("rise_start"))
        current_end = _date(row.get("rise_end"))
        observance_start = _date(row.get("observance_start"))
        prior_start = None
        prior_end = None
        if current_start is not None and current_end is not None:
            prior_candidates = []
            for other in significant:
                if other.get("festival_id") != row.get("festival_id"):
                    continue
                if other.get("state") != row.get("state"):
                    continue
                other_end = _date(other.get("observance_end"))
                other_start = _date(other.get("observance_start"))
                if other_end is None or other_start is None:
                    continue
                if observance_start is None or other_end >= observance_start:
                    continue
                if other.get("window_status") != "ok":
                    continue
                prior_candidates.append((other_end, other))
            if prior_candidates:
                prior = max(prior_candidates, key=lambda pair: pair[0])[1]
                prior_start = _date(prior.get("rise_start"))
                prior_end = _date(prior.get("rise_end"))

        specs.append(
            {
                "festival_id": row["festival_id"],
                "name_en": row.get("name_en"),
                "name_zh": row.get("name_zh"),
                "scope": row.get("scope"),
                "state": row["state"],
                "observance_start": observance_start,
                "observance_end": _date(row.get("observance_end")),
                "window_status": row.get("window_status"),
                "ready": current_start is not None and current_end is not None,
                "current_start": current_start,
                "current_end": current_end,
                "previous_start": (
                    None if current_start is None else shift_year(current_start)
                ),
                "previous_end": (
                    None if current_end is None else shift_year(current_end)
                ),
                "prior_start": prior_start,
                "prior_end": prior_end,
            }
        )
    return payload, specs


def _category_metadata(raw_category):
    category = category_for_raw(raw_category)
    if category is None:
        category = CATEGORIES_BY_ID["other"]
    return category.id, category.label_en, category.label_ms


def _decimal_text(value):
    return None if value is None else str(round(value, 2))


QUALITY_BY_METHOD = {
    "previous_year_same_window": "historical",
    "prior_occurrence_window": "prior_occurrence",
    "current_rise_window_fallback": "current_fallback",
    "unavailable": "unavailable",
    "window_not_ready": "window_not_ready",
}


def serialize_row(spec, item_code, metadata, result):
    broad_id, label_en, label_ms = _category_metadata(metadata.get("item_category"))
    quality = QUALITY_BY_METHOD.get(result.method, "unknown")
    coverage_ratio = None
    if result.window_days:
        coverage_ratio = Decimal(result.observed_days) / Decimal(result.window_days)
        if (
            result.method == "previous_year_same_window"
            and coverage_ratio < Decimal("0.8")
        ):
            quality = "historical_partial"
    return {
        "festival_id": spec["festival_id"],
        "name_en": spec["name_en"],
        "name_zh": spec["name_zh"],
        "scope": spec["scope"],
        "state": spec["state"],
        "observance_start": None if spec["observance_start"] is None else spec["observance_start"].isoformat(),
        "observance_end": None if spec["observance_end"] is None else spec["observance_end"].isoformat(),
        "current_rise_start": None if spec["current_start"] is None else spec["current_start"].isoformat(),
        "current_rise_end": None if spec["current_end"] is None else spec["current_end"].isoformat(),
        "item_code": item_code,
        "item_name": metadata.get("item", ""),
        "unit": metadata.get("unit", ""),
        "source_item_group": metadata.get("item_group", ""),
        "source_category": metadata.get("item_category", ""),
        "broad_category_id": broad_id,
        "broad_category_label_en": label_en,
        "broad_category_label_ms": label_ms,
        "baseline_method": result.method,
        "baseline_quality": quality,
        "baseline_window_start": None if result.window_start is None else result.window_start.isoformat(),
        "baseline_window_end": None if result.window_end is None else result.window_end.isoformat(),
        "historical_avg_price": _decimal_text(result.average_price),
        "observation_count": result.observation_count,
        "excluded_observation_count": result.excluded_observation_count,
        "observed_days": result.observed_days,
        "window_days": result.window_days,
        "coverage_ratio": (
            None if coverage_ratio is None else str(round(coverage_ratio, 4))
        ),
        "sample_status": result.sample_status,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--windows", required=True)
    parser.add_argument("--lookup-item", required=True)
    parser.add_argument("--out", default="festival_historical_prices.json")
    args = parser.parse_args(argv)

    window_payload, specs = _load_specs(args.windows)
    states_by_premise = load_premise_states(args.data_dir)
    lookup_items = {}
    with Path(args.lookup_item).open(encoding="utf-8", newline="") as handle:
        import csv

        for row in csv.DictReader(handle):
            code = (row.get("item_code") or "").strip()
            if code:
                lookup_items[code] = {
                    "item": (row.get("item") or "").strip(),
                    "unit": (row.get("unit") or "").strip(),
                    "item_group": (row.get("item_group") or "").strip(),
                    "item_category": (row.get("item_category") or "").strip(),
                }

    specs_by_state = {}
    for spec in specs:
        specs_by_state.setdefault(spec["state"], []).append(spec)

    rows = []
    with __import__("tempfile").TemporaryDirectory(
        prefix="smartcart_festival_history_"
    ) as temp_dir:
        state_paths = partition_by_state(args.data_dir, states_by_premise, temp_dir)
        for state, state_path in state_paths.items():
            state_specs = specs_by_state.get(state, [])
            if not state_specs:
                continue
            state_prices = load_state_prices(state_path)
            for spec in state_specs:
                for item_code, observations in state_prices.items():
                    if not spec["ready"]:
                        result = HistoricalPriceResult(
                            average_price=None,
                            method="window_not_ready",
                            window_start=None,
                            window_end=None,
                            observation_count=0,
                            excluded_observation_count=0,
                            sample_status="insufficient",
                        )
                    else:
                        result = compute_historical_price(
                            observations,
                            current_start=spec["current_start"],
                            current_end=spec["current_end"],
                            previous_start=spec["previous_start"],
                            previous_end=spec["previous_end"],
                            prior_start=spec["prior_start"],
                            prior_end=spec["prior_end"],
                        )
                    rows.append(
                        serialize_row(
                            spec,
                            item_code,
                            lookup_items.get(item_code, {}),
                            result,
                        )
                    )
            del state_prices

    method_counts = {}
    for row in rows:
        method_counts[row["baseline_method"]] = method_counts.get(row["baseline_method"], 0) + 1
    output = {
        "historical_price_method_version": HISTORICAL_PRICE_METHOD_VERSION,
        "computed_at": datetime.now(MALAYSIA_TZ).isoformat(timespec="seconds"),
        "window_source": str(args.windows),
        "window_method_version": window_payload.get("window_method_version"),
        "row_count": len(rows),
        "method_counts": method_counts,
        "rows": rows,
    }
    Path(args.out).write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + chr(10),
        encoding="utf-8",
    )
    print("historical_price_method_version:", HISTORICAL_PRICE_METHOD_VERSION)
    print("rows:", len(rows), " methods:", method_counts)
    print("written:", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
