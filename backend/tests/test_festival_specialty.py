"""Tests for AC 4i.7.7 festival-specific key commodity analysis."""

from __future__ import annotations

from decimal import Decimal

from smartcart.festival_specialty import (
    compute_specialty_rows,
    compute_specialty_summary,
    item_matches_specialty,
    match_specialty_items,
)


def test_item_matches_by_category_group_and_keyword():
    metadata = {
        "item": "MINYAK MASAK CAP X",
        "item_group": "BARANGAN BERBUNGKUS",
        "item_category": "MINYAK DAN LEMAK",
    }
    assert item_matches_specialty(metadata, {"match_categories": ["MINYAK DAN LEMAK"]})
    assert item_matches_specialty(metadata, {"match_groups": ["BARANGAN BERBUNGKUS"]})
    assert item_matches_specialty(metadata, {"match_name_keywords": ["MINYAK"]})
    assert not item_matches_specialty(metadata, {"match_categories": ["GULA"]})


def test_match_specialty_items_returns_union():
    lookup = {
        "A": {"item": "MINYAK", "item_group": "G1", "item_category": "C1"},
        "B": {"item": "GULA", "item_group": "G2", "item_category": "C2"},
    }
    assert match_specialty_items(
        lookup,
        {"match_categories": ["C2"], "match_name_keywords": ["MINYAK"]},
    ) == {"A", "B"}


def test_specialty_summary_flags_above_average():
    rows = [
        {
            "item_code": str(index),
            "state": "S",
            "status": "ok",
            "rise_status": "rise",
            "rise_pct": "20",
            "observation_count": 10,
            "excluded_observation_count": 1,
        }
        for index in range(4)
    ]
    summary = compute_specialty_summary(
        rows,
        matched_item_codes={"0", "1", "2", "3"},
        festival_avg_rise_ratio="10",
        thresholds={
            "minimum_items": 3,
            "flag_difference_pct_points": 2,
            "flag_relative_lift": 1.2,
        },
    )
    assert summary["status"] == "ok"
    assert summary["specialty_avg_rise_ratio"] == Decimal("20")
    assert summary["difference_pct_points"] == Decimal("10")
    assert summary["significant_above_average"] is True


def test_specialty_summary_marks_insufficient_items():
    rows = [
        {
            "item_code": "A",
            "state": "S",
            "status": "ok",
            "rise_status": "rise",
            "rise_pct": "20",
        }
    ]
    summary = compute_specialty_summary(
        rows,
        matched_item_codes={"A"},
        festival_avg_rise_ratio="10",
        thresholds={"minimum_items": 3},
    )
    assert summary["status"] == "insufficient_items"
    assert summary["significant_above_average"] is False


def test_compute_specialty_rows_outputs_festival_and_state_rows():
    item_rows = [
        {
            "festival_id": "f",
            "state": "S",
            "item_code": "A",
            "status": "ok",
            "rise_status": "rise",
            "rise_pct": "20",
            "observation_count": 10,
            "excluded_observation_count": 1,
        }
    ]
    ratios = {
        "festival_rise_ratios": [
            {"festival_id": "f", "avg_rise_ratio": "10", "ratio_status": "ok"}
        ],
        "festival_state_rise_ratios": [
            {
                "festival_id": "f",
                "state": "S",
                "avg_rise_ratio": "10",
                "ratio_status": "ok",
            }
        ],
    }
    specialty_map = {
        "thresholds": {
            "minimum_items": 1,
            "flag_difference_pct_points": 2,
            "flag_relative_lift": 1.2,
        },
        "festivals": {
            "f": [
                {
                    "specialty_id": "oil",
                    "name_en": "Oil",
                    "name_zh": "油",
                    "match_categories": [],
                    "match_groups": [],
                    "match_name_keywords": [],
                    "item_codes": ["A"],
                }
            ]
        },
    }
    lookup = {"A": {"item": "Oil", "item_group": "", "item_category": ""}}
    result = compute_specialty_rows(item_rows, ratios, specialty_map, lookup)
    assert len(result["festival_specialties"]) == 1
    assert len(result["festival_state_specialties"]) == 1
    assert result["festival_specialties"][0]["significant_above_average"] is True
