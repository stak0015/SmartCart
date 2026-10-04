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


def _sample_rank(row):
    return (
        int(row.get("sample_items") or 0),
        int(row.get("observation_days") or 0),
    )


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
        # Prefer a significant state; when none is significant, use the state
        # with the most complete sample instead of trusting an arbitrary row
        # order. This prevents a zero-sample observance from becoming the
        # default view for state-level festivals such as Kaamatan.
        selected = max(significant_rows or rows, key=_sample_rank)
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

ESTIMATED_PRICE_METHOD_VERSION = "4i.6.1-v1"

ITEM_QUALITY_LABELS = {
    "measured": {
        "en": "Measured from this item's festival-window price history",
        "ms": "Diukur daripada sejarah harga item ini dalam tetingkap perayaan",
        "zh": "基于该商品在节日窗口内的实测价格历史",
    },
    "derived": {
        "en": "Estimated from the festival average rise",
        "ms": "Dianggarkan daripada purata kenaikan perayaan",
        "zh": "按节日平均涨幅推算",
    },
    "unavailable": {
        "en": "No usable price data",
        "ms": "Tiada data harga yang boleh digunakan",
        "zh": "无可用价格数据",
    },
}


def _price_range(low, high):
    if low is None or high is None:
        return None
    first, second = sorted((low, high))
    return {"min": str(round(first, 2)), "max": str(round(second, 2))}


def _date_range(start, end):
    if not start or not end:
        return None, None
    return tuple(sorted((str(start), str(end))))


def _state_average_ratio(payloads, festival_id, state):
    for row in (payloads.get("rise_ratios") or {}).get(
        "festival_state_rise_ratios", []
    ):
        if str(row.get("festival_id")) == str(festival_id) and row.get("state") == state:
            value = _numeric_or_none(row.get("avg_rise_ratio"))
            if value is not None:
                return value
    for row in (payloads.get("rise_ratios") or {}).get("festival_rise_ratios", []):
        if str(row.get("festival_id")) == str(festival_id):
            value = _numeric_or_none(row.get("avg_rise_ratio"))
            if value is not None:
                return value
    return None


def get_festival_items(
    payloads,
    festival_id,
    state=None,
    median_price_provider=None,
):
    detail = get_festival_detail(payloads, festival_id, state=state)
    if detail is None:
        return None
    selected_state = detail["selected_state"]
    rows = [
        row
        for row in (payloads.get("price_stats") or {}).get("items", [])
        if str(row.get("festival_id")) == str(festival_id)
        and row.get("state") == selected_state
    ]
    item_codes = [str(row.get("item_code")) for row in rows if row.get("item_code")]
    medians = {}
    if median_price_provider is not None and item_codes:
        try:
            medians = median_price_provider(item_codes) or {}
        except Exception:
            medians = {}
    average_ratio = _state_average_ratio(payloads, festival_id, selected_state)

    items = []
    for row in rows:
        code = str(row.get("item_code"))
        measured = row.get("status") == "ok" and _numeric_or_none(row.get("rise_pct")) is not None
        quality = "unavailable"
        rise = None
        price_range = None
        baseline = None
        peak = None
        history_start = None
        history_end = None

        if measured:
            rise = _numeric_or_none(row.get("rise_pct"))
            low = _numeric_or_none(row.get("baseline_price"))
            high = _numeric_or_none(row.get("peak_price"))
            if low is not None and high is not None:
                quality = "measured"
                baseline = low
                peak = high
                price_range = _price_range(low, high)
                history_start, history_end = _date_range(
                    row.get("baseline_date"), row.get("peak_date")
                )
        else:
            median = _numeric_or_none(medians.get(code))
            if median is not None and average_ratio is not None:
                quality = "derived"
                rise = average_ratio
                baseline = median
                high = median * (Decimal("1") + average_ratio / Decimal("100"))
                peak = high
                price_range = _price_range(median, high)

        items.append(
            {
                "item_code": code,
                "item_name": row.get("item_name") or code,
                "unit": row.get("unit") or "",
                "source_category": row.get("source_category") or "",
                "broad_category_id": row.get("broad_category_id") or "other",
                "broad_category_label_en": row.get("broad_category_label_en") or "Other",
                "broad_category_label_ms": row.get("broad_category_label_ms") or "Lain-lain",
                "data_quality": quality,
                "quality_label": ITEM_QUALITY_LABELS[quality],
                "rise_pct": None if rise is None else str(round(rise, 2)),
                "baseline_price": None if baseline is None else str(round(baseline, 2)),
                "peak_price": None if peak is None else str(round(peak, 2)),
                "price_range": price_range,
                "history_start": history_start,
                "history_end": history_end,
                "observation_count": int(row.get("observation_count") or 0),
                "observed_days": int(row.get("observed_days") or 0),
                "sample_status": row.get("sample_status"),
            }
        )
    return {
        "festival_id": festival_id,
        "state": selected_state,
        "dataset": _dataset_metadata(payloads),
        "average_rise_ratio": None if average_ratio is None else str(round(average_ratio, 2)),
        "average_rise_ratio_method_version": (
            (payloads.get("rise_ratios") or {}).get("rise_ratio_method_version")
            or "4i.7.4-v1"
        ),
        "estimated_price_method_version": ESTIMATED_PRICE_METHOD_VERSION,
        "item_count": len(items),
        "items": items,
    }

def _specialty_code_map(payloads, festival_id, state):
    payload = payloads.get("specialty_stats") or {}
    result = {}
    state_codes = set()
    for row in payload.get("festival_state_specialties") or []:
        if (
            str(row.get("festival_id")) != str(festival_id)
            or row.get("state") != state
        ):
            continue
        for code in row.get("item_codes") or []:
            state_codes.add(str(code))
        if not row.get("significant_above_average"):
            continue
        for code in row.get("item_codes") or []:
            result[str(code)] = {
                "specialty_id": row.get("specialty_id"),
                "name_en": row.get("name_en"),
                "name_zh": row.get("name_zh"),
            }
    for row in payload.get("festival_specialties") or []:
        if str(row.get("festival_id")) != str(festival_id):
            continue
        if not row.get("significant_above_average"):
            continue
        for code in row.get("item_codes") or []:
            code = str(code)
            if code not in state_codes:
                result[code] = {
                    "specialty_id": row.get("specialty_id"),
                    "name_en": row.get("name_en"),
                    "name_zh": row.get("name_zh"),
                }
    return result


def _money(value):
    return value.quantize(Decimal("0.01"))


def get_festival_top_items(
    payloads,
    festival_id,
    state=None,
    limit=10,
    item_summary_provider=None,
):
    detail = get_festival_detail(payloads, festival_id, state=state)
    if detail is None:
        return None
    selected_state = detail["selected_state"]
    rows = [
        row
        for row in (payloads.get("price_stats") or {}).get("items", [])
        if str(row.get("festival_id")) == str(festival_id)
        and row.get("state") == selected_state
        and row.get("status") == "ok"
        and row.get("rise_status") == "rise"
        and row.get("sample_status") == "full"
        and _numeric_or_none(row.get("rise_pct")) is not None
        and _numeric_or_none(row.get("rise_pct")) > 0
    ]
    codes = [str(row.get("item_code")) for row in rows if row.get("item_code")]
    summaries = {}
    if item_summary_provider is not None and codes:
        try:
            summaries = item_summary_provider(codes) or {}
        except Exception:
            summaries = {}
    specialties = _specialty_code_map(payloads, festival_id, selected_state)
    candidates = []
    for row in rows:
        code = str(row.get("item_code"))
        summary = summaries.get(code) or {}
        rise = _numeric_or_none(row.get("rise_pct"))
        current_price = _numeric_or_none(summary.get("current_price_rm"))
        specialty = specialties.get(code) or {}
        candidates.append(
            {
                "item_id": summary.get("item_id"),
                "item_code": code,
                "item_name": summary.get("item_name") or row.get("item_name") or code,
                "item_name_en": summary.get("item_name_en") or row.get("item_name"),
                "item_name_ms": summary.get("item_name_ms") or row.get("item_name"),
                "unit": summary.get("unit") or row.get("unit") or "",
                "package_size": summary.get("package_size") or row.get("unit") or "",
                "category": summary.get("category"),
                "source_category": summary.get("source_category"),
                "image_url": summary.get("image_url"),
                "sara_eligible": summary.get("sara_eligible"),
                "sara_category_candidate": bool(
                    summary.get("sara_category_candidate")
                ),
                "current_price_rm": (
                    None if current_price is None else float(_money(current_price))
                ),
                "historical_rise_pct": str(round(rise, 2)),
                "historical_price_range": _price_range(
                    _numeric_or_none(row.get("baseline_price")),
                    _numeric_or_none(row.get("peak_price")),
                ),
                "history_start": _date_range(
                    row.get("baseline_date"), row.get("peak_date")
                )[0],
                "history_end": _date_range(
                    row.get("baseline_date"), row.get("peak_date")
                )[1],
                "observation_count": int(row.get("observation_count") or 0),
                "observed_days": int(row.get("observed_days") or 0),
                "sample_status": row.get("sample_status"),
                "is_specialty": code in specialties,
                "specialty_id": specialty.get("specialty_id"),
                "specialty_name_en": specialty.get("name_en"),
                "specialty_name_zh": specialty.get("name_zh"),
            }
        )
    candidates.sort(
        key=lambda item: (
            -float(_numeric_or_none(item["historical_rise_pct"])),
            str(item["item_name"]),
        )
    )
    top_items = candidates[: max(0, int(limit))]
    return {
        "festival_id": festival_id,
        "state": selected_state,
        "dataset": _dataset_metadata(payloads),
        "method_version": (
            (payloads.get("price_stats") or {}).get("price_stats_method_version")
            or "4i.7.3-v1"
        ),
        "specialty_method_version": (
            (payloads.get("specialty_stats") or {}).get(
                "specialty_analysis_method_version"
            )
            or "4i.7.7-v1"
        ),
        "item_count": len(candidates),
        "limit": int(limit),
        "items": top_items,
    }


def get_early_purchase_savings(
    payloads,
    state,
    purchases,
    item_code_provider=None,
):
    historical = payloads.get("historical_prices") or {}
    rows = [
        row
        for row in historical.get("rows") or []
        if row.get("state") == state
    ]
    if not rows:
        raise KeyError("state")
    by_code = {}
    for row in rows:
        by_code.setdefault(str(row.get("item_code")), []).append(row)
    item_ids = []
    for purchase in purchases:
        try:
            item_id = int(str(purchase.get("item_id")))
        except (TypeError, ValueError):
            continue
        item_ids.append(item_id)
    code_by_id = {}
    if item_code_provider is not None and item_ids:
        try:
            code_by_id = item_code_provider(item_ids) or {}
        except Exception:
            code_by_id = {}
    matches = []
    for purchase in purchases:
        item_id = str(purchase.get("item_id"))
        code = code_by_id.get(item_id)
        if not code:
            continue
        try:
            purchase_date = date.fromisoformat(str(purchase.get("purchased_on")))
        except ValueError as error:
            raise ValueError("The purchase date must use YYYY-MM-DD.") from error
        quantity = int(purchase.get("quantity") or 0)
        paid = _numeric_or_none(purchase.get("unit_price_rm"))
        if quantity < 1 or paid is None:
            continue
        candidates = []
        for row in by_code.get(str(code)) or []:
            if row.get("baseline_quality") != "historical_partial":
                continue
            try:
                start = date.fromisoformat(str(row.get("current_rise_start")))
                end = date.fromisoformat(str(row.get("current_rise_end")))
            except ValueError:
                continue
            average = _numeric_or_none(row.get("historical_avg_price"))
            if average is None or not start <= purchase_date <= end:
                continue
            candidates.append((start, row, average))
        candidates.sort(key=lambda candidate: candidate[0])
        match = None
        for _start, row, average in candidates:
            saving = (average - paid) * quantity
            if saving > 0:
                match = (row, average, _money(saving))
                break
        if match is None:
            continue
        row, average, saving = match
        matches.append(
            {
                "record_id": purchase.get("record_id") or "",
                "item_id": item_id,
                "item_code": str(code),
                "item_name": row.get("item_name") or code,
                "festival_id": row.get("festival_id"),
                "festival_name_en": row.get("name_en"),
                "festival_name_zh": row.get("name_zh"),
                "purchased_on": purchase_date.isoformat(),
                "quantity": quantity,
                "paid_unit_price_rm": float(_money(paid)),
                "historical_avg_price_rm": float(_money(average)),
                "saving_rm": float(saving),
                "baseline_quality": row.get("baseline_quality"),
                "sample_status": row.get("sample_status"),
                "history_window_start": row.get("baseline_window_start"),
                "history_window_end": row.get("baseline_window_end"),
            }
        )
    total = _money(sum((Decimal(str(item["saving_rm"])) for item in matches), Decimal("0")))
    return {
        "state": state,
        "dataset": _dataset_metadata(payloads),
        "method_version": (
            historical.get("historical_price_method_version") or "4i.7.5-v1"
        ),
        "purchase_count": len(purchases),
        "qualifying_count": len(matches),
        "excluded_count": max(0, len(purchases) - len(matches)),
        "total_early_purchase_savings_rm": float(total),
        "items": matches,
    }


FORECAST_METHOD_VERSION = "4i.3.5-v1"
EARLY_PURCHASE_PREVIEW_METHOD_VERSION = "4i.3.6-v1"


def _forecast_payload(payloads, alert, item):
    rise = _numeric_or_none(item.get("rise_pct"))
    baseline = _numeric_or_none(item.get("baseline_price"))
    price_range = item.get("price_range") or {}
    low = _numeric_or_none(price_range.get("min"))
    high = _numeric_or_none(price_range.get("max"))
    if rise is None or low is None or high is None:
        return None
    rise_min = Decimal("0")
    rise_max = rise
    if baseline is not None and baseline > 0:
        calculated_min = (low - baseline) / baseline * Decimal("100")
        calculated_max = (high - baseline) / baseline * Decimal("100")
        rise_min, rise_max = sorted((calculated_min, calculated_max))
        rise_min = max(Decimal("0"), rise_min)
        rise_max = max(rise_min, rise_max)
    return {
        "festival_id": alert.get("festival_id"),
        "festival_name_en": alert.get("name_en"),
        "festival_name_zh": alert.get("name_zh"),
        "festival_name_ms": alert.get("name_ms"),
        "state": alert.get("state") or item.get("state"),
        "rise_start": alert.get("rise_start"),
        "rise_end": alert.get("rise_end"),
        "item_code": item.get("item_code"),
        "item_name": item.get("item_name"),
        "unit": item.get("unit") or "",
        "data_quality": item.get("data_quality"),
        "rise_pct_min": str(round(rise_min, 2)),
        "rise_pct_max": str(round(rise_max, 2)),
        "price_range": {
            "min": str(round(low, 2)),
            "max": str(round(high, 2)),
        },
        "history_start": item.get("history_start"),
        "history_end": item.get("history_end"),
        "method_version": FORECAST_METHOD_VERSION,
    }


def _active_item_forecasts(
    payloads,
    state=None,
    on_date=None,
    median_price_provider=None,
):
    alerts_payload = get_active_alerts(payloads, state=state, on_date=on_date)
    forecasts = {}
    for alert in alerts_payload.get("alerts") or []:
        festival_state = alert.get("state") or state
        items_payload = get_festival_items(
            payloads,
            alert.get("festival_id"),
            state=festival_state,
            median_price_provider=median_price_provider,
        )
        if not items_payload:
            continue
        for item in items_payload.get("items") or []:
            code = str(item.get("item_code"))
            if code in forecasts:
                continue
            forecast = _forecast_payload(payloads, alert, item)
            if forecast is not None:
                forecasts[code] = forecast
    return forecasts


def get_festival_item_forecast(
    payloads,
    item_code,
    state=None,
    on_date=None,
    median_price_provider=None,
):
    forecasts = _active_item_forecasts(
        payloads,
        state=state,
        on_date=on_date,
        median_price_provider=median_price_provider,
    )
    return {
        "state": state,
        "on": on_date,
        "method_version": FORECAST_METHOD_VERSION,
        "forecast": forecasts.get(str(item_code)),
    }


def get_early_purchase_preview(
    payloads,
    state,
    lines,
    item_code_provider=None,
    median_price_provider=None,
    on_date=None,
):
    item_ids = []
    for line in lines:
        try:
            item_ids.append(int(str(line.get("item_id"))))
        except (TypeError, ValueError):
            continue
    code_by_id = {}
    if item_code_provider is not None and item_ids:
        try:
            code_by_id = item_code_provider(item_ids) or {}
        except Exception:
            code_by_id = {}
    forecasts = _active_item_forecasts(
        payloads,
        state=state,
        on_date=on_date,
        median_price_provider=median_price_provider,
    )
    results = []
    total = Decimal("0")
    for line in lines:
        item_id = str(line.get("item_id"))
        code = code_by_id.get(item_id)
        if not code:
            continue
        forecast = forecasts.get(str(code))
        if not forecast:
            continue
        actual = _numeric_or_none(line.get("actual_unit_price_rm"))
        maximum = _numeric_or_none((forecast.get("price_range") or {}).get("max"))
        try:
            quantity = int(line.get("quantity") or 0)
        except (TypeError, ValueError):
            quantity = 0
        if actual is None or maximum is None or quantity < 1:
            continue
        saving = max(Decimal("0"), (maximum - actual) * quantity)
        if saving <= 0:
            continue
        total += saving
        results.append(
            {
                "item_id": item_id,
                "item_code": str(code),
                "item_name": forecast.get("item_name"),
                "festival_id": forecast.get("festival_id"),
                "festival_name_en": forecast.get("festival_name_en"),
                "festival_name_zh": forecast.get("festival_name_zh"),
                "actual_unit_price_rm": float(_money(actual)),
                "forecast_max_price_rm": float(_money(maximum)),
                "quantity": quantity,
                "estimated_saving_rm": float(_money(saving)),
            }
        )
    return {
        "state": state,
        "on": on_date,
        "method_version": EARLY_PURCHASE_PREVIEW_METHOD_VERSION,
        "line_count": len(lines),
        "qualifying_count": len(results),
        "total_early_purchase_estimated_saving_rm": float(_money(total)),
        "items": results,
    }
