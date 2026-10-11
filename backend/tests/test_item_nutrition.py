"""Tests for the standalone catalogue item nutrition lookup."""

from __future__ import annotations

import json
from copy import deepcopy

from smartcart import api
from smartcart import item_nutrition


def _write_dataset(tmp_path):
    path = tmp_path / "item_nutrition.json"
    path.write_text(
        json.dumps(
            {
                "sources": [
                    {
                        "id": "fdc",
                        "name": "FoodData Central",
                        "url": "https://fdc.nal.usda.gov/",
                        "license": "USDA public data",
                    }
                ],
                "foods": [
                    {
                        "id": "fdc-1",
                        "source": "fdc",
                        "source_code": "123",
                        "description": "Generic rice, cooked",
                        "basis": "per_100g",
                        "carbohydrate_definition": "Available carbohydrate",
                        "energy_conversion": "publisher kJ divided by 4.184",
                        "nutrients": {
                            "energy_kcal": 130,
                            "protein_g": 3,
                            "fat_g": 0.3,
                            "carbohydrate_g": 28,
                            "fibre_g": None,
                        },
                    }
                ],
                "mappings": [
                    {
                        "item_code": "007",
                        "food_id": "fdc-1",
                        "match_type": "generic",
                        "rationale": "The catalogue item is a generic staple.",
                        "status": "approved",
                    },
                    {
                        "item_code": "rejected",
                        "food_id": "fdc-1",
                        "match_type": "generic",
                        "rationale": "Not reviewed.",
                        "status": "candidate",
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    return path


def test_loader_resolves_approved_mapping_and_preserves_null_nutrients(tmp_path):
    result = item_nutrition.get_item_nutrition("007", _write_dataset(tmp_path))

    assert result["available"] is True
    assert result["match_type"] == "generic"
    assert result["source"]["id"] == "fdc"
    assert result["food"]["basis"] == "per_100g"
    assert result["food"]["nutrients"]["fibre_g"] is None
    assert result["food"]["carbohydrate_definition"] == "Available carbohydrate"
    assert result["food"]["energy_conversion"] == "publisher kJ divided by 4.184"


def test_loader_returns_unavailable_for_missing_or_unapproved_items(tmp_path):
    path = _write_dataset(tmp_path)

    for code in ("missing", "rejected"):
        result = item_nutrition.get_item_nutrition(code, path)
        assert result == {
            "item_code": code,
            "available": False,
            "match_type": None,
            "rationale": None,
            "source": None,
            "food": None,
        }


def test_basis_requires_an_explicit_same_source_variant(tmp_path):
    path = _write_dataset(tmp_path)
    dataset = json.loads(path.read_text())
    variant = {**deepcopy(dataset['foods'][0]), 'id': 'fdc-volume', 'basis': 'per_100ml'}
    dataset['foods'].append(variant)
    dataset['mappings'][0]['basis_variants'] = {'per_100ml': 'fdc-volume'}
    path.write_text(json.dumps(dataset))
    assert item_nutrition.get_item_nutrition('007', path, basis='per_100ml')['food']['id'] == 'fdc-volume'
    assert not item_nutrition.get_item_nutrition('007', path, basis='per_serving')['available']
    variant['source_code'] = 'different-record'
    path.write_text(json.dumps(dataset))
    assert not item_nutrition.get_item_nutrition('007', path, basis='per_100ml')['available']
    dataset['mappings'][0]['basis_variants'] = None
    path.write_text(json.dumps(dataset))
    assert not item_nutrition.get_item_nutrition('007', path, basis='per_100ml')['available']


def test_loader_rejects_incomplete_or_invalid_review_profiles(tmp_path):
    path = _write_dataset(tmp_path)
    original = json.loads(path.read_text(encoding="utf-8"))
    mutations = [
        lambda dataset: dataset["foods"][0].update({"basis": "per_serving"}),
        lambda dataset: dataset["foods"][0]["nutrients"].pop("fat_g"),
        lambda dataset: dataset["foods"][0]["nutrients"].update({"energy_kcal": -1}),
        lambda dataset: dataset["foods"][0]["nutrients"].update({"energy_kcal": float("nan")}),
        lambda dataset: dataset["sources"][0].pop("license"),
        lambda dataset: dataset["mappings"][0].update({"match_type": "guess"}),
    ]
    for mutate in mutations:
        invalid = deepcopy(original)
        mutate(invalid)
        path.write_text(json.dumps(invalid), encoding="utf-8")
        assert item_nutrition.get_item_nutrition("007", path)["available"] is False


def test_endpoint_handler_uses_the_same_shape_and_handles_missing_file(monkeypatch, tmp_path):
    monkeypatch.setattr(item_nutrition, "DATA_PATH", tmp_path / "does-not-exist.json")
    assert api.item_nutrition_endpoint("007") == {
        "item_code": "007",
        "available": False,
        "match_type": None,
        "rationale": None,
        "source": None,
        "food": None,
    }
