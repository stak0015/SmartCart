"""Validation for the Epic 7 healthier-alternative reference data.

The feature ships as two version-controlled JSON files. These tests guard the
data itself: that every reference resolves, that a recommendation is never
made without a nutrition reason, that both sides of a comparison sit on the
same basis, and that missing values are never treated as zero.
"""

from __future__ import annotations

import json
import csv
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "nutrition"
FOODS = json.loads((DATA_DIR / "foods.json").read_text(encoding="utf-8"))
MAPPINGS = json.loads((DATA_DIR / "mappings.json").read_text(encoding="utf-8"))
PRIORITY_REVIEW = json.loads((DATA_DIR / "priority-review.json").read_text(encoding="utf-8"))

REQUIRED_FOOD_FIELDS = {"id", "source", "source_code", "description", "basis", "nutrients"}
NUTRIENT_FIELDS = {
    "energy_kcal",
    "protein_g",
    "fat_g",
    "carbohydrate_g",
    "sugars_g",
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


def test_alternatives_can_cross_food_families_for_a_shared_use():
    by_original: dict[str, set[str]] = {}
    for mapping in MAPPINGS["mappings"]:
        by_original.setdefault(mapping["original_item_code"], set()).add(mapping["rule"])
    assert any({"H5", "H8"} <= rules for rules in by_original.values())
    assert any({"H6", "H9"} <= rules for rules in by_original.values())
    assert any({"H7", "H10"} <= rules for rules in by_original.values())


def test_generic_mapping_is_declared_per_mapping():
    """AC 7.3.10: the client must be able to disclose a generic entry."""
    for mapping in MAPPINGS["mappings"]:
        assert isinstance(mapping["generic_mapping"], bool), mapping


def test_selection_rule_is_documented():
    rule = MAPPINGS["selection_rule"]
    assert rule["eligibility"] and rule["ranking"] and rule["fallback"]


def test_each_rule_explains_its_inferred_use_and_preparation_in_both_languages():
    for rule in MAPPINGS["rules"]:
        for field in ("intention", "usage_note"):
            assert set(rule[field]) == {"en", "ms"}
            assert all(text.strip() for text in rule[field].values())


def test_catalogue_associations_do_not_confuse_food_forms_or_species():
    catalogue_path = DATA_DIR.parents[1] / "database" / "data" / "item_name_en.csv"
    with catalogue_path.open(encoding="utf-8-sig") as source:
        catalogue = {row["item_code"]: row for row in csv.DictReader(source)}
    for mapping in MAPPINGS["mappings"]:
        assert mapping["original_item_code"] in catalogue
        assert mapping["alternative_item_code"] in catalogue
        assert mapping["original_item_code"] != mapping["alternative_item_code"]
        assert "KRIMER" not in mapping["original_item_name"], "milk data cannot substantiate non-dairy creamers"
        if mapping["original_item_code"] == "320":
            assert mapping["original_food"] == "MFC-97-111008", "evaporated milk is not milk powder"
        if mapping["alternative_food"] == "MFC-97-110053":
            assert "KEMBUNG" in mapping["alternative_item_name"], "use an Indian mackerel catalogue entry"


def test_whole_chicken_recommendation_requires_the_nutritionally_supported_cut():
    rule = next(rule for rule in MAPPINGS["rules"] if rule["id"] == "H5")
    assert "only to its skinless breast" in rule["usage_note"]["en"]


def test_priority_review_covers_more_than_snacks_and_drinks():
    mapped_categories = {item["category"] for item in PRIORITY_REVIEW["items"] if item["status"] == "mapped"}
    assert {"salty_snacks", "sweet_snacks", "sweetened_drinks", "instant_noodles",
            "fried_main_meals", "fried_snacks", "salty_condiments", "sweet_spreads"} <= mapped_categories
    mappings_by_code: dict[str, list[dict]] = {}
    for mapping in MAPPINGS["mappings"]:
        mappings_by_code.setdefault(mapping["original_item_code"], []).append(mapping)
    review_codes = set()
    for item in PRIORITY_REVIEW["items"]:
        assert item["item_code"] not in review_codes
        review_codes.add(item["item_code"])
        if item["status"] == "mapped":
            mappings = mappings_by_code[item["item_code"]]
            assert set(item["alternative_item_codes"]) == {m["alternative_item_code"] for m in mappings}
        else:
            assert item["item_code"] not in mappings_by_code
            assert item["reason"] and item["proposed_alternative_item_codes"]


def test_ambiguous_light_and_unspecified_drink_forms_are_not_approved():
    original_codes = {m["original_item_code"] for m in MAPPINGS["mappings"]}
    assert not {"1896", "1712", "1321", "1866", "1867", "1868"} & original_codes
    fried_instant = [m for m in MAPPINGS["mappings"] if m["original_item_code"] == "1247"]
    assert fried_instant and all(m["original_food"] == "MFC-97-221010" for m in fried_instant)


def test_sugar_reasons_use_measured_total_sugars_and_keep_unknowns_missing():
    foods = _foods_by_id()
    rules = {rule["id"]: rule for rule in MAPPINGS["rules"]}
    assert foods["MFC-97-106006"]["nutrients"]["sugars_g"] is None
    assert foods["FDC-174158"]["nutrients"]["sugars_g"] == 0
    for mapping in MAPPINGS["mappings"]:
        if rules[mapping["rule"]]["comparison"] == "sugars_g":
            assert foods[mapping["original_food"]]["nutrients"]["sugars_g"] is not None
            assert foods[mapping["alternative_food"]]["nutrients"]["sugars_g"] is not None


def test_peanut_snack_options_require_plain_preparation_and_supported_benefits():
    mappings = [m for m in MAPPINGS["mappings"] if m["alternative_item_code"] == "368"]
    assert len(mappings) == 22
    assert {m["alternative_food"] for m in mappings} == {"FDC-173806"}
    assert {m["rule"] for m in mappings} == {"N1", "N2"}
    rules = {rule["id"]: rule for rule in MAPPINGS["rules"]}
    assert rules["N1"]["comparison"] == "sodium_mg"
    assert rules["N2"]["comparison"] == "protein_g"
    for rule_id in ("N1", "N2"):
        note = rules[rule_id]["usage_note"]["en"]
        assert "without salt or sugar" in note
        assert "higher in fat and energy" in note
    nutrients = _foods_by_id()["FDC-173806"]["nutrients"]
    assert nutrients["sodium_mg"] == 6
    assert nutrients["protein_g"] == 24.4


def test_new_food_evidence_is_traceable_to_primary_publishers():
    for food in FOODS["foods"]:
        if food.get("retrieved_at") == "2026-10-09":
            assert food["source_url"].startswith(("https://myfcd.moh.gov.my/", "https://fdc.nal.usda.gov/", "https://www.kinder.com/"))


def test_api_preserves_intentions_for_different_food_alternatives(monkeypatch):
    from smartcart import nutrition
    from smartcart.models import CatalogueItemSummary

    original_code = next(m["original_item_code"] for m in MAPPINGS["mappings"] if m["rule"] == "H5")
    codes = {m["alternative_item_code"] for m in MAPPINGS["mappings"] if m["original_item_code"] == original_code}
    monkeypatch.setattr(nutrition, "_catalogue_rows", lambda requested: {
        code: {"item_id": int(code), "item_code": code} for code in requested if code in codes
    })
    monkeypatch.setattr(nutrition, "catalogue_price_ranges", lambda *args: {})
    monkeypatch.setattr(nutrition, "_summary", lambda row, price: CatalogueItemSummary(
        item_id=row["item_id"], item_code=row["item_code"], item_name="Test item",
        unit=None, item_category=None, package_size=None,
    ))
    result = nutrition.healthier_alternatives(original_code)
    assert {alternative.rule for alternative in result.alternatives} == {"H8"}
    assert result.count == 1
    payload = result.model_dump()
    for alternative in payload["alternatives"]:
        assert alternative["intention"]["en"] == "the main protein in a cooked meal"
        assert alternative["usage_note"]["en"]
        assert alternative["generic_mapping"]

    # An unavailable catalogue product must not be suggested, even if its use fits.
    monkeypatch.setattr(nutrition, "_catalogue_rows", lambda requested: {})
    assert nutrition.healthier_alternatives(original_code).count == 0


@pytest.mark.parametrize("nutrient", sorted(NUTRIENT_FIELDS))
def test_nutrient_field_appears_in_the_dataset(nutrient: str):
    assert any(f["nutrients"].get(nutrient) is not None for f in FOODS["foods"])
