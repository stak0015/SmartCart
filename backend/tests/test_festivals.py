"""Tests for the US 4i.1 read-only festival service."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from smartcart.festival_service import (
    FestivalDatasetError,
    get_festival_detail,
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
        "festival_price_stats.json": {"items": []},
        "festival_rise_ratios.json": {"festival_rise_ratios": []},
        "festival_historical_prices.json": {"rows": []},
        "festival_specialty_stats.json": {"row_count": 0},
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
