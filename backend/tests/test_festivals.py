"""Tests for the US 4i.1 read-only festival service."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from smartcart.festival_service import (
    FestivalDatasetError,
    get_active_alerts,
    get_early_purchase_preview,
    get_early_purchase_savings,
    get_festival_detail,
    get_festival_item_forecast,
    get_festival_items,
    get_festival_top_items,
    list_festivals,
    load_dataset,
)


def write_dataset(tmp_path: Path, *, drop=None):
    significance = {
        "method_version": "4i.7-v1",
        "window_method_version": "4i.7.2-v1",
        "rows": [
            {
                "festival_id": "f",
                "name_en": "Test Festival",
                "name_zh": "测试节日",
                "scope": "national",
                "state": "S1",
                "start": "2026-01-01",
                "end": "2026-03-01",
                "observance_start": "2026-02-01",
                "observance_end": "2026-02-01",
                "significant": True,
                "window_status": "ok",
                "sample_items": 50,
                "observation_days": 10,
                "rise_pct": "12.5",
                "rise_start": "2026-01-10",
                "rise_end": "2026-01-20",
                "recovery_start": "2026-01-20",
                "recovery_end": "2026-02-10",
                "daily_index": [
                    {"date": "2026-01-01", "value": "10.00"},
                    {"date": "2026-01-02", "value": "10.50"},
                ],
            },
            {
                "festival_id": "f",
                "name_en": "Test Festival",
                "name_zh": "测试节日",
                "scope": "national",
                "state": "S2",
                "start": "2026-01-01",
                "end": "2026-03-01",
                "observance_start": "2026-02-01",
                "observance_end": "2026-02-01",
                "significant": False,
                "window_status": "no_rise",
                "sample_items": 50,
                "observation_days": 20,
                "daily_index": [],
            },
        ],
    }
    payloads = {
        "festival_significance.json": significance,
        "festival_price_stats.json": {
            "price_stats_method_version": "4i.7.3-v1",
            "items": [
                {
                    "festival_id": "f",
                    "state": "S1",
                    "item_code": "A",
                    "item_name": "Item A",
                    "unit": "1kg",
                    "status": "ok",
                    "rise_status": "rise",
                    "rise_pct": "20",
                    "baseline_price": "10",
                    "baseline_date": "2026-01-01",
                    "peak_price": "12",
                    "peak_date": "2026-01-10",
                    "observation_count": 120,
                    "observed_days": 10,
                    "sample_status": "full",
                    "broad_category_id": "protein",
                    "broad_category_label_en": "Protein",
                    "broad_category_label_ms": "Protein",
                },
                {
                    "festival_id": "f",
                    "state": "S1",
                    "item_code": "C",
                    "item_name": "Item C",
                    "unit": "1kg",
                    "status": "insufficient_baseline",
                    "rise_status": None,
                    "rise_pct": None,
                    "observation_count": 2,
                    "observed_days": 2,
                    "sample_status": "insufficient",
                    "broad_category_id": "other",
                    "broad_category_label_en": "Other",
                    "broad_category_label_ms": "Other",
                },
                {
                    "festival_id": "f",
                    "state": "S1",
                    "item_code": "B",
                    "item_name": "Item B",
                    "unit": "1kg",
                    "status": "ok",
                    "rise_status": "rise",
                    "rise_pct": "10",
                    "baseline_price": "5",
                    "baseline_date": "2026-01-01",
                    "peak_price": "6",
                    "peak_date": "2026-01-10",
                    "observation_count": 80,
                    "observed_days": 10,
                    "sample_status": "full",
                    "broad_category_id": "staples",
                    "broad_category_label_en": "Staples",
                    "broad_category_label_ms": "Staples",
                },
            ],
        },
        "festival_rise_ratios.json": {
            "rise_ratio_method_version": "4i.7.4-v1",
            "festival_rise_ratios": [
                {"festival_id": "f", "avg_rise_ratio": "15", "ratio_status": "ok"}
            ],
            "festival_state_rise_ratios": [
                {"festival_id": "f", "state": "S1", "avg_rise_ratio": "15", "ratio_status": "ok"}
            ],
        },
        "festival_historical_prices.json": {
            "historical_price_method_version": "4i.7.5-v1",
            "rows": [
                {
                    "festival_id": "f",
                    "name_en": "Test Festival",
                    "name_zh": "测试节日",
                    "state": "S1",
                    "item_code": "A",
                    "item_name": "Item A",
                    "current_rise_start": "2026-01-10",
                    "current_rise_end": "2026-01-20",
                    "observance_start": "2026-02-01",
                    "baseline_method": "previous_year_same_window",
                    "baseline_quality": "historical_partial",
                    "baseline_window_start": "2025-01-10",
                    "baseline_window_end": "2025-01-20",
                    "historical_avg_price": "12",
                    "sample_status": "full",
                },
                {
                    "festival_id": "f",
                    "name_en": "Test Festival",
                    "name_zh": "测试节日",
                    "state": "S1",
                    "item_code": "B",
                    "item_name": "Item B",
                    "current_rise_start": "2026-01-10",
                    "current_rise_end": "2026-01-20",
                    "observance_start": "2026-02-01",
                    "baseline_method": "current_rise_window_fallback",
                    "baseline_quality": "current_fallback",
                    "historical_avg_price": "12",
                    "sample_status": "full",
                },
            ],
        },
        "festival_specialty_stats.json": {
            "specialty_analysis_method_version": "4i.7.7-v1",
            "festival_specialties": [
                {
                    "festival_id": "f",
                    "state": None,
                    "specialty_id": "new-year-favourite",
                    "name_en": "New year favourite",
                    "name_zh": "新年特色商品",
                    "significant_above_average": True,
                    "item_codes": ["A"],
                },
                {
                    "festival_id": "f",
                    "state": None,
                    "specialty_id": "avoid-override",
                    "name_en": "Avoid override",
                    "name_zh": "避免误标记",
                    "significant_above_average": True,
                    "item_codes": ["B"],
                }
            ],
            "festival_state_specialties": [
                {
                    "festival_id": "f",
                    "state": "S1",
                    "specialty_id": "new-year-favourite",
                    "name_en": "New year favourite",
                    "name_zh": "新年特色商品",
                    "significant_above_average": True,
                    "item_codes": ["A"],
                },
                {
                    "festival_id": "f",
                    "state": "S1",
                    "specialty_id": "avoid-override",
                    "name_en": "Avoid override",
                    "name_zh": "避免误标记",
                    "significant_above_average": False,
                    "item_codes": ["B"],
                }
            ],
        },
        "festival_method_registry.json": {
            "dataset_id": "US4i.7",
            "dataset_version": "4i.7-dataset-v3",
            "effective_date": "2026-10-04",
            "methods": [],
        },
        "festival_dataset_manifest.json": {
            "dataset_id": "US4i.7",
            "dataset_version": "4i.7-dataset-v3",
            "effective_date": "2026-10-04",
        },
    }
    for file_name, payload in payloads.items():
        if file_name == drop:
            continue
        (tmp_path / file_name).write_text(json.dumps(payload), encoding="utf-8")
    return tmp_path


def test_load_dataset_rejects_missing_files(tmp_path):
    write_dataset(tmp_path, drop="festival_price_stats.json")
    with pytest.raises(FestivalDatasetError):
        load_dataset(tmp_path)


def test_list_festivals_marks_significant_state(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = list_festivals(payloads)
    assert result["count"] == 1
    festival = result["festivals"][0]
    assert festival["significant"] is True
    assert festival["significant_state_count"] == 1
    assert festival["state_count"] == 2


def test_detail_uses_significant_state_and_marks_insufficient(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    detail = get_festival_detail(payloads, "f")
    assert detail["selected_state"] == "S1"
    selected = detail["selected"]
    assert selected["insufficient_sample"] is True
    assert selected["sample_notice"]["en"] == "Insufficient sample — indicative only"
    assert selected["daily_index"][0]["value"] == "10.00"


def test_detail_state_selection_and_error(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    detail = get_festival_detail(payloads, "f", state="S2")
    assert detail["selected_state"] == "S2"
    with pytest.raises(KeyError):
        get_festival_detail(payloads, "f", state="missing")


def test_detail_defaults_to_best_sample_when_no_state_is_significant(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    for row in payloads["significance"]["rows"]:
        row["significant"] = False
    detail = get_festival_detail(payloads, "f")
    assert detail["selected_state"] == "S2"
    assert detail["selected"]["observation_days"] == 20

def test_active_alerts_in_window(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = get_active_alerts(payloads, state="S1", on_date="2026-01-15")
    assert result["count"] == 1
    alert = result["alerts"][0]
    assert alert["festival_id"] == "f"
    assert alert["affected_item_count"] == 2
    assert alert["evidence_url"] == "/festivals?festival=f&state=S1"
    assert alert["affected_items"][0]["item_code"] == "A"


def test_active_alerts_outside_window(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    assert get_active_alerts(payloads, state="S1", on_date="2026-03-01")["count"] == 0


def test_active_alerts_respect_state_significance(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    assert get_active_alerts(payloads, state="S2", on_date="2026-01-15")["count"] == 0


def test_festival_items_marks_measured_and_derived(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = get_festival_items(
        payloads,
        "f",
        state="S1",
        median_price_provider=lambda _codes: {"C": 5.0},
    )
    assert result["item_count"] == 3
    by_code = {item["item_code"]: item for item in result["items"]}
    assert by_code["A"]["data_quality"] == "measured"
    assert by_code["A"]["rise_pct"] == "20.00"
    assert by_code["A"]["history_start"] == "2026-01-01"
    assert by_code["A"]["history_end"] == "2026-01-10"
    assert by_code["C"]["data_quality"] == "derived"
    assert by_code["C"]["rise_pct"] == "15.00"
    assert by_code["C"]["price_range"] == {"min": "5.00", "max": "5.75"}
    assert by_code["C"]["quality_label"]["en"] == "Estimated from the festival average rise"


def test_festival_items_marks_unavailable_without_median(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = get_festival_items(payloads, "f", state="S1")
    by_code = {item["item_code"]: item for item in result["items"]}
    assert by_code["C"]["data_quality"] == "unavailable"
    assert by_code["C"]["rise_pct"] is None
    assert by_code["C"]["history_start"] is None
    assert by_code["C"]["history_end"] is None


def test_festival_top_items_returns_specialty_and_current_price(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = get_festival_top_items(
        payloads,
        "f",
        state="S1",
        item_summary_provider=lambda _codes: {
            "A": {
                "item_id": "101",
                "item_name": "Item A",
                "unit": "1kg",
                "current_price_rm": 10.0,
                "category": {"id": "protein"},
                "source_category": {"id": "AYAM"},
            }
        },
    )
    assert result["items"][0]["item_code"] == "A"
    assert result["items"][0]["item_id"] == "101"
    assert result["items"][0]["current_price_rm"] == 10.0
    assert result["items"][0]["is_specialty"] is True
    assert result["items"][0]["historical_rise_pct"] == "20.00"
    by_code = {item["item_code"]: item for item in result["items"]}
    assert by_code["B"]["is_specialty"] is False


def test_early_purchase_savings_uses_only_historical_baselines(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = get_early_purchase_savings(
        payloads,
        state="S1",
        purchases=[
            {
                "item_id": "101",
                "item_name": "Item A",
                "quantity": 2,
                "unit_price_rm": 10.0,
                "purchased_on": "2026-01-15",
            },
            {
                "item_id": "102",
                "item_name": "Item B",
                "quantity": 1,
                "unit_price_rm": 10.0,
                "purchased_on": "2026-01-15",
            },
        ],
        item_code_provider=lambda _ids: {"101": "A", "102": "B"},
    )
    assert result["qualifying_count"] == 1
    assert result["excluded_count"] == 1
    assert result["total_early_purchase_savings_rm"] == 4.0
    assert result["items"][0]["festival_id"] == "f"


def test_festival_item_forecast_uses_active_window_and_price_range(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = get_festival_item_forecast(
        payloads,
        "A",
        state="S1",
        on_date="2026-01-15",
        median_price_provider=lambda _codes: {},
    )
    forecast = result["forecast"]
    assert forecast["festival_id"] == "f"
    assert forecast["rise_pct_min"] == "0.00"
    assert forecast["rise_pct_max"] == "20.00"
    assert forecast["price_range"] == {"min": "10.00", "max": "12.00"}


def test_early_purchase_preview_uses_actual_price_and_forecast_max(tmp_path):
    payloads = load_dataset(write_dataset(tmp_path))
    result = get_early_purchase_preview(
        payloads,
        state="S1",
        on_date="2026-01-15",
        lines=[
            {
                "item_id": "101",
                "quantity": 2,
                "actual_unit_price_rm": 10.0,
            }
        ],
        item_code_provider=lambda _ids: {"101": "A"},
        median_price_provider=lambda _codes: {},
    )
    assert result["qualifying_count"] == 1
    assert result["total_early_purchase_estimated_saving_rm"] == 4.0
    assert result["items"][0]["forecast_max_price_rm"] == 12.0
