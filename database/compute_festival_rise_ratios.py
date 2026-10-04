"""Compute AC 4i.7.4 festival average rise ratios.

Reads the AC 4i.7.3 item-level price statistics and produces a compact JSON
dataset containing festival-level and festival-state average rise ratios.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from smartcart.festival_price_stats import (  # noqa: E402
    RISE_RATIO_METHOD_VERSION,
    compute_rise_ratios,
)

MALAYSIA_TZ = timezone.utc


def _decimal_text(value):
    return None if value is None else str(round(value, 2))


def _ratio_text(value):
    return None if value is None else str(round(value, 4))


def serialize_ratio(row):
    result = dict(row)
    for key in (
        "avg_rise_ratio",
        "avg_net_change_ratio",
        "median_rise_ratio",
    ):
        result[key] = _decimal_text(result.get(key))
    result["exclusion_ratio"] = _ratio_text(result.get("exclusion_ratio"))
    return result


def _load_festival_meta(path):
    meta = {}
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return meta
    for row in payload.get("rows", []):
        if not row.get("significant"):
            continue
        key = (str(row.get("festival_id")), str(row.get("state")))
        meta[key] = {
            "name_en": row.get("name_en"),
            "name_zh": row.get("name_zh"),
        }
    return meta


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--price-stats", required=True)
    parser.add_argument("--out", default="festival_rise_ratios.json")
    args = parser.parse_args(argv)

    payload = json.loads(Path(args.price_stats).read_text(encoding="utf-8"))
    item_rows = payload.get("items")
    if not isinstance(item_rows, list) or not item_rows:
        raise SystemExit("price-stats file contains no items")

    skipped_windows = payload.get("skipped_windows") or []
    festival_meta = _load_festival_meta(payload.get("window_source"))
    ratios = compute_rise_ratios(
        item_rows,
        skipped_windows=skipped_windows,
        festival_meta=festival_meta,
    )
    festival_rows = [serialize_ratio(row) for row in ratios["festival_rise_ratios"]]
    state_rows = [
        serialize_ratio(row) for row in ratios["festival_state_rise_ratios"]
    ]
    output = {
        "rise_ratio_method_version": RISE_RATIO_METHOD_VERSION,
        "computed_at": datetime.now(MALAYSIA_TZ).isoformat(timespec="seconds"),
        "source_price_stats": str(args.price_stats),
        "source_price_stats_method_version": payload.get(
            "price_stats_method_version"
        ),
        "festival_count": len(festival_rows),
        "festival_state_count": len(state_rows),
        "festival_rise_ratios": festival_rows,
        "festival_state_rise_ratios": state_rows,
    }
    Path(args.out).write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + chr(10),
        encoding="utf-8",
    )
    print("rise_ratio_method_version:", RISE_RATIO_METHOD_VERSION)
    print("festivals:", len(festival_rows), " festival-states:", len(state_rows))
    for row in festival_rows:
        print(
            "  %-26s status=%-24s avg=%-8s rising=%d"
            % (
                row["festival_id"],
                row["ratio_status"],
                row["avg_rise_ratio"],
                row["rising_item_count"],
            )
        )
    print("written:", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
