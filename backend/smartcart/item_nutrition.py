"""Catalogue-item nutrition lookups.

Nutrition for a catalogue item is deliberately kept separate from the
healthier-alternatives data.  Catalogue item codes are local identifiers, so
the mapping file records the reviewed relationship to a generic food or an
exact product record instead of assuming the external source uses the same
code.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any


DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "nutrition" / "item_nutrition.json"


def _records(value: Any) -> list[dict[str, Any]]:
    """Return only object records from a contract collection."""

    return [record for record in value if isinstance(record, dict)] if isinstance(value, list) else []


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _valid_source(source: dict[str, Any]) -> bool:
    return all(_text(source.get(key)) for key in ("id", "name", "url", "license"))


CORE_NUTRIENTS = ("energy_kcal", "protein_g", "fat_g", "carbohydrate_g")


def _valid_nutrient(value: Any, *, allow_null: bool = True) -> bool:
    return (allow_null and value is None) or (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
        and value >= 0
    )


def _valid_food(food: dict[str, Any]) -> bool:
    if not all(_text(food.get(key)) for key in ("id", "source", "source_code", "description")):
        return False
    if food.get("basis") not in {"per_100g", "per_100ml"}:
        return False
    nutrients = food.get("nutrients")
    if not isinstance(nutrients, dict) or any(key not in nutrients for key in CORE_NUTRIENTS):
        return False
    if not all(_valid_nutrient(nutrients[key], allow_null=False) for key in CORE_NUTRIENTS):
        return False
    if not all(_valid_nutrient(value) for value in nutrients.values()):
        return False
    return "url" not in food or food["url"] is None or _text(food["url"])


def load_item_nutrition(path: Path | str | None = None) -> dict[str, Any]:
    """Load the item nutrition contract, returning an empty dataset if absent.

    The file is version-controlled reference data rather than a runtime
    dependency.  Treating a missing or malformed file as an empty dataset
    keeps catalogue item details usable while the nutrition section reports
    that no reviewed data is available.
    """

    try:
        with Path(path or DATA_PATH).open(encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return {"sources": [], "foods": [], "mappings": []}
    if not isinstance(value, dict):
        return {"sources": [], "foods": [], "mappings": []}
    return value


def _unavailable(item_code: str) -> dict[str, Any]:
    return {
        "item_code": item_code,
        "available": False,
        "match_type": None,
        "rationale": None,
        "source": None,
        "food": None,
    }


def get_item_nutrition(item_code: str, path: Path | str | None = None, *, basis: str | None = None) -> dict[str, Any]:
    """Return the approved nutrition record for one catalogue item.

    A mapping is usable only when it is explicitly approved and points to a
    food and source that both exist.  Optional nutrient values are passed
    through as ``None`` so clients can label them unavailable rather than
    presenting a fabricated zero.
    """

    code = str(item_code)
    dataset = load_item_nutrition(path)
    sources = {
        str(source.get("id")): source
        for source in _records(dataset.get("sources", []))
        if _valid_source(source)
    }
    foods = {
        str(food.get("id")): food
        for food in _records(dataset.get("foods", []))
        if _valid_food(food)
    }

    mapping: dict[str, Any] | None = None
    for candidate in _records(dataset.get("mappings", [])):
        if (
            str(candidate.get("item_code")) == code
            and candidate.get("status") == "approved"
            and candidate.get("match_type") in {"generic", "product"}
            and _text(candidate.get("rationale"))
        ):
            mapping = candidate
            break
    if mapping is None:
        return _unavailable(code)

    food = foods.get(str(mapping.get("food_id")))
    if food is None:
        return _unavailable(code)
    if basis is not None and basis != food['basis']:
        variants = mapping.get('basis_variants', {})
        variant = foods.get(variants.get(basis)) if isinstance(variants, dict) else None
        if (variant is None or variant['basis'] != basis or
                (variant['source'], variant['source_code']) != (food['source'], food['source_code'])):
            return _unavailable(code)
        food = variant
    source = sources.get(str(food.get("source")))
    if source is None:
        return _unavailable(code)

    source_metadata = {
        "id": source.get("id"),
        "name": source.get("name"),
        "url": source.get("url"),
        "license": source.get("license"),
    }
    for key in ("carbohydrate_definition", "energy_conversion"):
        if key in source:
            source_metadata[key] = source.get(key)
    food_record = {
        "id": food.get("id"),
        "source_code": food.get("source_code"),
        "description": food.get("description"),
        "basis": food.get("basis"),
        "nutrients": food.get("nutrients") if isinstance(food.get("nutrients"), dict) else {},
    }
    if food.get("url") is not None:
        food_record["url"] = food.get("url")
    # Some sources define nutrient conventions at record level.  Keep those
    # optional notes so a downstream comparison does not silently imply that
    # differently defined carbohydrate or energy values are identical.
    for key in ("carbohydrate_definition", "energy_conversion", "source_edition"):
        if key in food:
            food_record[key] = food.get(key)
    return {
        "item_code": code,
        "available": True,
        "match_type": mapping.get("match_type"),
        "rationale": mapping.get("rationale"),
        "source": source_metadata,
        "food": food_record,
    }


# Short alias for callers that prefer the endpoint-shaped service name.
item_nutrition = get_item_nutrition
