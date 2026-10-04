"""Compute AC 4i.7.7 festival-specific key commodity statistics."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from smartcart.festival_specialty import (  # noqa: E402
    SPECIALTY_ANALYSIS_METHOD_VERSION,
    compute_specialty_rows,
)

MALAYSIA_TZ = timezone.utc


def _decimal_text(value):
    return None if value is None else str(round(value, 2))


def serialize_row(row):
    result = dict(row)
    for key in (
        "specialty_avg_rise_ratio",
        "festival_avg_rise_ratio",
        "difference_pct_points",
        "relative_lift",
        "median_rise_ratio",
    ):
        result[key] = _decimal_text(result.get(key))
    return result


def load_lookup_items(path):
    items = {}
    with Path(path).open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            code = (row.get("item_code") or "").strip()
            if code:
                items[code] = {
                    "item": (row.get("item") or "").strip(),
                    "unit": (row.get("unit") or "").strip(),
                    "item_group": (row.get("item_group") or "").strip(),
                    "item_category": (row.get("item_category") or "").strip(),
                }
    return items


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--price-stats", required=True)
    parser.add_argument("--rise-ratios", required=True)
    parser.add_argument("--specialty-map", required=True)
    parser.add_argument("--lookup-item", required=True)
    parser.add_argument("--out", default="festival_specialty_stats.json")
    args = parser.parse_args(argv)

    price_payload = json.loads(Path(args.price_stats).read_text(encoding="utf-8"))
    ratio_payload = json.loads(Path(args.rise_ratios).read_text(encoding="utf-8"))
    specialty_map = json.loads(Path(args.specialty_map).read_text(encoding="utf-8"))
    lookup_items = load_lookup_items(args.lookup_item)

    computed = compute_specialty_rows(
        price_payload.get("items", []),
        ratio_payload,
        specialty_map,
        lookup_items,
    )
    festival_rows = [serialize_row(row) for row in computed["festival_specialties"]]
    state_rows = [
        serialize_row(row) for row in computed["festival_state_specialties"]
    ]
    flagged = [
        row for row in festival_rows + state_rows
        if row.get("significant_above_average")
    ]
    output = {
        "specialty_analysis_method_version": SPECIALTY_ANALYSIS_METHOD_VERSION,
        "computed_at": datetime.now(MALAYSIA_TZ).isoformat(timespec="seconds"),
        "source_price_stats": str(args.price_stats),
        "source_rise_ratios": str(args.rise_ratios),
        "specialty_map": str(args.specialty_map),
        "specialty_map_version": specialty_map.get("version"),
        "thresholds": specialty_map.get("thresholds", {}),
        "festival_specialty_count": len(festival_rows),
        "festival_state_specialty_count": len(state_rows),
        "row_count": len(festival_rows) + len(state_rows),
        "festival_specialties": festival_rows,
        "festival_state_specialties": state_rows,
    }
    Path(args.out).write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + chr(10),
        encoding="utf-8",
    )
    print("specialty_analysis_method_version:", SPECIALTY_ANALYSIS_METHOD_VERSION)
    print(
        "festival rows:",
        len(festival_rows),
        " state rows:",
        len(state_rows),
        " flagged:",
        len(flagged),
    )
    print("written:", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
