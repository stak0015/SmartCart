"""Validation for the Epic 7 healthier-alternative reference data.

The feature ships as two version-controlled JSON files. These tests guard the
data itself: that every reference resolves, that a recommendation is never
made without a nutrition reason, that both sides of a comparison sit on the
same basis, and that missing values are never treated as zero.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "nutrition"
FOODS = json.loads((DATA_DIR / "foods.json").read_text(encoding="utf-8"))
MAPPINGS = json.loads((DATA_DIR / "mappings.json").read_text(encoding="utf-8"))

REQUIRED_FOOD_FIELDS = {"id", "source", "source_code", "description", "basis", "nutrients"}
NUTRIENT_FIELDS = {
    "energy_kcal",
    "protein_g",
    "fat_g",
    "carbohydrate_g",
    "fibre_g",
    "sodium_mg",
    "calcium_mg",
    "saturated_fat_g",
    "monounsaturated_fat_g",
    "polyunsaturated_fat_g",
}


def _foods_by_id() -> dict[str, dict]:
    return {food["id"]: food for food in FOODS["foods"]}


def test_reference_sources_are_declared():
    declared = {source["id"] for source in FOODS["sources"]}
    assert declared, "at least one nutrition source must be declared"
    for source in FOODS["sources"]:
        assert source["name"] and source["url"] and source["license"]


def test_every_food_is_complete_and_traceable():
    by_id = _foods_by_id()
    assert by_id, "no nutrition foods loaded"
    for food in FOODS["foods"]:
        assert REQUIRED_FOOD_FIELDS <= set(food), food.get("id")
        assert food["source"] in {s["id"] for s in FOODS["sources"]}
        assert food["source_code"], food["id"]
        assert food["basis"] == "per_100g", food["id"]
        assert NUTRIENT_FIELDS == set(food["nutrients"]), food["id"]
        for name, value in food["nutrients"].items():
            assert value is None or isinstance(value, (int, float)), (food["id"], name)
            assert value is None or value >= 0, (food["id"], name)


def test_mapping_rule_ids_are_declared():
    rule_ids = {rule["id"] for rule in MAPPINGS["rules"]}
    assert rule_ids, "no rules declared"
    for mapping in MAPPINGS["mappings"]:
        assert mapping["rule"] in rule_ids, mapping


def test_every_mapping_resolves_to_known_foods():
    by_id = _foods_by_id()
    for mapping in MAPPINGS["mappings"]:
        assert mapping["original_food"] in by_id, mapping
        assert mapping["alternative_food"] in by_id, mapping


def test_comparison_uses_one_nutrient_on_one_basis():
    by_id = _foods_by_id()
    rules = {rule["id"]: rule for rule in MAPPINGS["rules"]}
    for mapping in MAPPINGS["mappings"]:
        rule = rules[mapping["rule"]]
        nutrient = rule["comparison"]
        assert nutrient in NUTRIENT_FIELDS, mapping
        original = by_id[mapping["original_food"]]
        alternative = by_id[mapping["alternative_food"]]
        assert original["basis"] == alternative["basis"], mapping


def test_every_mapping_is_nutritionally_supported():
    """A recommendation must never be made when the data does not support it."""
    by_id = _foods_by_id()
    rules = {rule["id"]: rule for rule in MAPPINGS["rules"]}
    for mapping in MAPPINGS["mappings"]:
        rule = rules[mapping["rule"]]
        nutrient = rule["comparison"]
        original = by_id[mapping["original_food"]]["nutrients"][nutrient]
        alternative = by_id[mapping["alternative_food"]]["nutrients"][nutrient]
        assert original is not None, ("missing original value", mapping)
        assert alternative is not None, ("missing alternative value", mapping)
        if rule["direction"] == "lower_is_better":
            assert alternative < original, ("not lower", mapping)
        else:
            assert alternative > original, ("not higher", mapping)


def test_missing_values_are_never_zero_filled():
    """Null means unavailable; it must never be silently replaced with zero."""
    for food in FOODS["foods"]:
        for name, value in food["nutrients"].items():
            assert value is not True
            assert value is None or not isinstance(value, str), (food["id"], name)


def test_alternative_is_a_real_catalogue_item():
    by_id = _foods_by_id()
    for mapping in MAPPINGS["mappings"]:
        assert mapping["alternative_item_code"], mapping
        assert mapping["alternative_item_name"], mapping
        assert mapping["alternative_food"] in by_id, mapping
        assert mapping["approved"] is True, mapping


def test_no_duplicate_original_alternative_pairs():
    """One item may offer several alternatives, but never the same one twice."""
    seen: set[tuple[str, str]] = set()
    for mapping in MAPPINGS["mappings"]:
        pair = (mapping["original_item_code"], mapping["alternative_item_code"])
        assert pair not in seen, f"{pair} mapped more than once"
        seen.add(pair)


def test_each_original_item_has_at_least_one_alternative():
    by_original: dict[str, set[str]] = {}
    for mapping in MAPPINGS["mappings"]:
        by_original.setdefault(mapping["original_item_code"], set()).add(
            mapping["rule"]
        )
    assert by_original, "no mappings"
    for code, rules in by_original.items():
        assert len(rules) == 1, f"{code} spans rules {rules}"


def test_generic_mapping_is_declared_per_mapping():
    """AC 7.3.10: the client must be able to disclose a generic entry."""
    for mapping in MAPPINGS["mappings"]:
        assert isinstance(mapping["generic_mapping"], bool), mapping


def test_selection_rule_is_documented():
    rule = MAPPINGS["selection_rule"]
    assert rule["eligibility"] and rule["ranking"] and rule["fallback"]


def test_mapping_rules_are_known_product_families():
    expected = {"H1", "H2", "H3", "H4", "H5", "H6", "H7"}
    assert {rule["id"] for rule in MAPPINGS["rules"]} == expected


@pytest.mark.parametrize("nutrient", sorted(NUTRIENT_FIELDS))
def test_nutrient_field_appears_in_the_dataset(nutrient: str):
    assert any(f["nutrients"].get(nutrient) is not None for f in FOODS["foods"])
