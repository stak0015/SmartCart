"""Read-only service for the US 4i.1 festive-price evidence view."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Mapping

DATASET_VERSION_FALLBACK = "4i.7-dataset-v3"
SOURCE_LABEL = "PriceCatcher official open data (data.gov.my) and the maintained festival register"
SOURCE_URL = "https://data.gov.my/data-catalogue/pricecatcher"
INSUFFICIENT_EN = "Insufficient sample — indicative only"
INSUFFICIENT_MS = "Sampel tidak mencukupi — indikatif sahaja"
INSUFFICIENT_ZH = "样本不足，仅供参考"
ALERT_RULE_VERSION = "4i.2.1-v1"
MALAYSIA_TZ = timezone(timedelta(hours=8))

MALAY_FESTIVAL_NAMES = {
    "deepavali-2025": "Deepavali",
    "christmas-2025": "Krismas",
    "thaipusam-2026": "Thaipusam",
    "cny-2026": "Tahun Baru Cina",
    "hari-raya-aidilfitri-2026": "Hari Raya Aidilfitri",
    "good-friday-2026": "Good Friday",
    "hari-raya-haji-2026": "Hari Raya Haji",
    "kaamatan-2026": "Pesta Kaamatan",
    "wesak-2026": "Hari Wesak",
    "gawai-2026": "Gawai Dayak",
    "merdeka-2026": "Hari Kebangsaan",
    "malaysia-day-2026": "Hari Malaysia",
}

DATASET_FILES = {
    "significance": "festival_significance.json",
    "price_stats": "festival_price_stats.json",
    "rise_ratios": "festival_rise_ratios.json",
    "historical_prices": "festival_historical_prices.json",
    "specialty_stats": "festival_specialty_stats.json",
}


class FestivalDatasetError(RuntimeError):
    """Raised when the unified festival dataset is unavailable."""


def load_dataset(dataset_dir):
    root = Path(dataset_dir)
    payloads = {}
    missing = []
    for key, file_name in DATASET_FILES.items():
        path = root / file_name
        if not path.exists():
            missing.append(file_name)
            continue
        payloads[key] = json.loads(path.read_text(encoding="utf-8"))
    if missing:
        raise FestivalDatasetError(
            "festival dataset is missing: " + ", ".join(missing)
        )
    registry_path = root / "festival_method_registry.json"
    manifest_path = root / "festival_dataset_manifest.json"
    payloads["registry"] = (
        json.loads(registry_path.read_text(encoding="utf-8"))
        if registry_path.exists()
        else {}
    )
    payloads["manifest"] = (
        json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest_path.exists()
        else {}
    )
    return payloads


def _dataset_metadata(payloads):
    manifest = payloads.get("manifest") or {}
    registry = payloads.get("registry") or {}
    methods = {
        method.get("method_id"): method.get("version")
        for method in registry.get("methods", [])
    }
    return {
        "dataset_id": manifest.get("dataset_id") or registry.get("dataset_id") or "US4i.7",
        "dataset_version": (
            manifest.get("dataset_version")
            or registry.get("dataset_version")
            or DATASET_VERSION_FALLBACK
        ),
        "effective_date": manifest.get("effective_date") or registry.get("effective_date"),
        "method_versions": methods,
        "source_label": SOURCE_LABEL,
        "source_url": SOURCE_URL,
    }


def _row_for_state(rows, state):
    if state is None:
        return None
    return next((row for row in rows if row.get("state") == state), None)


def _sample_notice(row):
    return {
        "en": INSUFFICIENT_EN,
        "ms": INSUFFICIENT_MS,
        "zh": INSUFFICIENT_ZH,
    }


def _selected_payload(row):
    observation_days = int(row.get("observation_days") or 0)
    sample_items = int(row.get("sample_items") or 0)
    insufficient = observation_days < 14 or sample_items < 30
    return {
        "state": row.get("state"),
        "significant": bool(row.get("significant")),
        "window_status": row.get("window_status"),
        "start": row.get("start"),
        "end": row.get("end"),
        "observance_start": row.get("observance_start"),
        "observance_end": row.get("observance_end"),
        "rise_start": row.get("rise_start"),
        "rise_end": row.get("rise_end"),
        "recovery_start": row.get("recovery_start"),
        "recovery_end": row.get("recovery_end"),
        "baseline_value": row.get("baseline_value"),
        "peak_value": row.get("peak_value"),
        "recovery_value": row.get("recovery_value"),
        "rise_pct": row.get("rise_pct"),
        "peak_rise_pct": row.get("peak_rise_pct"),
        "observation_days": observation_days,
        "sample_items": sample_items,
        "insufficient_sample": insufficient,
        "sample_notice": _sample_notice(row) if insufficient else None,
        "daily_index": row.get("daily_index") or [],
        "method_version": row.get("method_version") or "4i.7-v1",
        "window_method_version": row.get("window_method_version") or "4i.7.2-v1",
        "source_label": SOURCE_LABEL,
        "source_url": SOURCE_URL,
    }


def list_festivals(payloads):
    rows = (payloads.get("significance") or {}).get("rows", [])
    grouped = {}
    for row in rows:
        grouped.setdefault(str(row.get("festival_id")), []).append(row)

    festivals = []
    for festival_id, group in grouped.items():
        significant_rows = [row for row in group if row.get("significant")]
        first = group[0]
        status_counts = {}
        for row in group:
            status = str(row.get("window_status") or "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        festivals.append(
            {
                "festival_id": festival_id,
                "name_en": first.get("name_en"),
                "name_zh": first.get("name_zh"),
                "name_ms": MALAY_FESTIVAL_NAMES.get(festival_id, first.get("name_en")),
                "scope": first.get("scope"),
                "significant": bool(significant_rows),
                "state_count": len(group),
                "significant_state_count": len(significant_rows),
                "states": [row.get("state") for row in group],
                "significant_states": [row.get("state") for row in significant_rows],
                "window_status_counts": status_counts,
                "sample_item_count": max(
                    int(row.get("sample_items") or 0) for row in group
                ),
                "observation_days_min": min(
                    int(row.get("observation_days") or 0) for row in group
                ),
                "observation_days_max": max(
                    int(row.get("observation_days") or 0) for row in group
                ),
                "date_start": min(str(row.get("start")) for row in group),
                "date_end": max(str(row.get("end")) for row in group),
                "method_version": first.get("method_version") or "4i.7-v1",
                "window_method_version": first.get("window_method_version") or "4i.7.2-v1",
            }
        )
    festivals.sort(key=lambda item: (item["date_start"], item["festival_id"]))
    return {
        "count": len(festivals),
        "dataset": _dataset_metadata(payloads),
        "festivals": festivals,
    }


def get_festival_detail(payloads, festival_id, state=None):
    rows = [
        row
        for row in (payloads.get("significance") or {}).get("rows", [])
        if str(row.get("festival_id")) == str(festival_id)
    ]
    if not rows:
        return None

    selected = _row_for_state(rows, state)
    if selected is None:
        significant_rows = [row for row in rows if row.get("significant")]
        selected = (significant_rows or rows)[0]
        if state is not None:
            raise KeyError(state)

    first = rows[0]
    states = [
        {
            "state": row.get("state"),
            "significant": bool(row.get("significant")),
            "window_status": row.get("window_status"),
        }
        for row in rows
    ]
    return {
        "festival_id": first.get("festival_id"),
        "name_en": first.get("name_en"),
        "name_zh": first.get("name_zh"),
        "name_ms": MALAY_FESTIVAL_NAMES.get(str(festival_id), first.get("name_en")),
        "scope": first.get("scope"),
        "dataset": _dataset_metadata(payloads),
        "states": states,
        "selected_state": selected.get("state"),
        "selected": _selected_payload(selected),
    }

def _parse_date(value):
    if isinstance(value, date):
        return value
    if not value:
        return datetime.now(MALAYSIA_TZ).date()
    return date.fromisoformat(str(value))


def _numeric_or_none(value):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _alert_items(payloads, festival_id, state):
    rows = (payloads.get("price_stats") or {}).get("items", [])
    by_item = {}
    for row in rows:
        if str(row.get("festival_id")) != str(festival_id):
            continue
        if state is not None and row.get("state") != state:
            continue
        if row.get("status") != "ok" or row.get("rise_status") != "rise":
            continue
        rise = _numeric_or_none(row.get("rise_pct"))
        if rise is None:
            continue
        code = str(row.get("item_code"))
        entry = by_item.setdefault(
            code,
            {
                "item_code": code,
                "item_name": row.get("item_name"),
                "unit": row.get("unit"),
                "broad_category_id": row.get("broad_category_id"),
                "broad_category_label_en": row.get("broad_category_label_en"),
                "broad_category_label_ms": row.get("broad_category_label_ms"),
                "_rises": [],
            },
        )
        entry["_rises"].append(rise)
    items = []
    for entry in by_item.values():
        rises = entry.pop("_rises")
        entry["rise_pct"] = str(round(sum(rises) / Decimal(len(rises)), 2))
        items.append(entry)
    items.sort(key=lambda item: (-float(item["rise_pct"]), item["item_code"]))
    return items


def get_active_alerts(payloads, state=None, on_date=None):
    on = _parse_date(on_date)
    significance = payloads.get("significance") or {}
    rows = significance.get("rows", [])
    if state is not None:
        candidates = [row for row in rows if row.get("state") == state]
    else:
        candidates = [row for row in rows if row.get("scope") == "national"]

    grouped = {}
    for row in candidates:
        if not row.get("significant") or row.get("window_status") != "ok":
            continue
        start = row.get("rise_start")
        end = row.get("rise_end")
        if not start or not end:
            continue
        if not (date.fromisoformat(start) <= on <= date.fromisoformat(end)):
            continue
        grouped.setdefault(str(row["festival_id"]), []).append(row)

    alerts = []
    for festival_id, group in grouped.items():
        first = group[0]
        affected_items = _alert_items(payloads, festival_id, state)
        if not affected_items:
            continue
        state_param = f"&state={state}" if state else ""
        alerts.append(
            {
                "festival_id": festival_id,
                "name_en": first.get("name_en"),
                "name_zh": first.get("name_zh"),
                "name_ms": MALAY_FESTIVAL_NAMES.get(festival_id, first.get("name_en")),
                "scope": first.get("scope"),
                "state": state,
                "rise_start": min(row["rise_start"] for row in group),
                "rise_end": max(row["rise_end"] for row in group),
                "affected_item_count": len(affected_items),
                "affected_items": affected_items,
                "evidence_url": f"/festivals?festival={festival_id}{state_param}",
                "method_version": first.get("method_version") or "4i.7-v1",
                "window_method_version": first.get("window_method_version") or "4i.7.2-v1",
                "alert_rule_version": ALERT_RULE_VERSION,
            }
        )
    alerts.sort(key=lambda alert: (alert["rise_end"], alert["festival_id"]))
    return {
        "on": on.isoformat(),
        "state": state,
        "alert_rule_version": ALERT_RULE_VERSION,
        "dataset": _dataset_metadata(payloads),
        "count": len(alerts),
        "alerts": alerts,
    }
