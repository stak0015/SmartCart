"""Epic 7 — approved healthier alternatives backed by static nutrition data.

The reference data lives in version control under `data/nutrition`; the
application never fetches nutrition data at runtime and never invents a
mapping. A suggestion is produced only from an approved catalogue-to-catalogue
mapping and always carries the nutrition evidence behind it (AC 7.1.3,
AC 7.3.5). Missing values stay missing (AC 7.3.11) and never become zero.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .catalogue import (
    catalogue_price_ranges,
    display_package_size,
    is_sara_category_candidate,
)
from .catalogue_image_manifest import catalogue_image_url
from .categories import category_for_raw, source_category_for_raw
from .database import database_cursor
from .models import (
    CatalogueItemSummary,
    CataloguePriceRange,
    HealthierAlternative,
    HealthierAlternativesResponse,
    NutrientComparison,
    NutritionSourceRef,
)
from .translations import catalogue_translation_joins, translation_select_columns

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "nutrition"
FOODS_PATH = DATA_DIR / "foods.json"
MAPPINGS_PATH = DATA_DIR / "mappings.json"

# Nutrients shown in the "Why this alternative?" comparison, in display order.
NUTRIENT_DISPLAY: tuple[tuple[str, str, str], ...] = (
    ("energy_kcal", "Energy", "kcal"),
    ("protein_g", "Protein", "g"),
    ("fat_g", "Total fat", "g"),
    ("saturated_fat_g", "Saturated fat", "g"),
    ("carbohydrate_g", "Carbohydrate", "g"),
    ("fibre_g", "Dietary fibre", "g"),
    ("sodium_mg", "Sodium", "mg"),
    ("calcium_mg", "Calcium", "mg"),
)

_ITEM_COLUMNS = (
    "item_id", "item_code", "item_name", "unit", "item_category", "sara_eligible",
    "item_name_en", "item_name_ms", "item_category_en", "item_category_ms",
)


@lru_cache(maxsize=1)
def nutrition_dataset() -> dict[str, Any]:
    """Load the reference foods and approved mappings once per process."""

    foods_doc = json.loads(FOODS_PATH.read_text(encoding="utf-8"))
    mappings_doc = json.loads(MAPPINGS_PATH.read_text(encoding="utf-8"))
    foods = {food["id"]: food for food in foods_doc["foods"]}
    sources = {source["id"]: source for source in foods_doc["sources"]}
    rules = {rule["id"]: rule for rule in mappings_doc["rules"]}
    by_item: dict[str, list[dict[str, Any]]] = {}
    for mapping in mappings_doc["mappings"]:
        if not mapping.get("approved"):
            continue
        by_item.setdefault(mapping["original_item_code"], []).append(mapping)
    return {"foods": foods, "sources": sources, "rules": rules, "by_item": by_item}


def _source_ref(food: dict[str, Any], sources: dict[str, dict[str, Any]]) -> NutritionSourceRef:
    source = sources[food["source"]]
    return NutritionSourceRef(
        dataset=food["source"],
        dataset_name=source["name"],
        record_code=food["source_code"],
        description=food["description"],
        basis=food["basis"],
    )


def _comparisons(original: dict[str, Any], alternative: dict[str, Any]) -> list[NutrientComparison]:
    """Compare two foods on one shared basis (AC 7.3.4/7.3.9/7.3.11)."""

    comparable_basis = original["basis"] == alternative["basis"]
    rows: list[NutrientComparison] = []
    for nutrient, label, unit in NUTRIENT_DISPLAY:
        left = original["nutrients"].get(nutrient)
        right = alternative["nutrients"].get(nutrient)
        if not comparable_basis:
            status = "non_comparable"
        elif left is None or right is None:
            status = "unavailable"
        else:
            status = "comparable"
        rows.append(NutrientComparison(nutrient=nutrient, label=label, unit=unit,
                                       original_value=left, alternative_value=right, status=status))
    return rows


def _summary(row: dict[str, Any], price_range: CataloguePriceRange | None) -> CatalogueItemSummary:
    category = category_for_raw(row["item_category"])
    source_category = source_category_for_raw(row["item_category"], row.get("item_category_en"), row.get("item_category_ms"))
    return CatalogueItemSummary(
        item_id=int(row["item_id"]),
        item_code=row["item_code"],
        item_name=row["item_name"],
        item_name_en=row.get("item_name_en"),
        item_name_ms=row.get("item_name_ms"),
        unit=row.get("unit"),
        item_category=row.get("item_category"),
        package_size=display_package_size(row["item_name"], row.get("unit")),
        image_url=catalogue_image_url(row["item_code"]),
        sara_eligible=row.get("sara_eligible"),
        sara_category_candidate=is_sara_category_candidate(row.get("item_category")),
        category=category,
        source_category=source_category,
        price_range=price_range,
    )


def _catalogue_rows(item_codes: list[str]) -> dict[str, dict[str, Any]]:
    if not item_codes:
        return {}
    with database_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT i.item_id, i.item_code, i.item_name, i.unit, i.item_category,
                   i.sara_eligible,
                   {translation_select_columns()}
            FROM item i
            {catalogue_translation_joins()}
            WHERE i.item_code = ANY(%s::text[])
            """,
            (item_codes,),
        )
        return {row[1]: dict(zip(_ITEM_COLUMNS, row)) for row in cursor.fetchall()}


def healthier_alternatives(
    item_code: str,
    premise_ids: list[str] | None = None,
) -> HealthierAlternativesResponse:
    """Approved healthier alternatives for one catalogue item (AC 7.1.x)."""

    dataset = nutrition_dataset()
    mappings = dataset["by_item"].get(item_code, [])
    if not mappings:
        return HealthierAlternativesResponse(item_code=item_code, count=0, alternatives=[])

    rows = _catalogue_rows(sorted({m["alternative_item_code"] for m in mappings}))
    # Price context matches the search row: observed prices at the cached
    # nearby stores only, and only when the caller supplied that context.
    ranges = catalogue_price_ranges(
        [int(row["item_id"]) for row in rows.values()], list(premise_ids or [])
    )
    price_ranges = {
        code: CataloguePriceRange(**ranges[int(row["item_id"])])
        for code, row in rows.items()
        if int(row["item_id"]) in ranges
    }
    alternatives: list[HealthierAlternative] = []
    for mapping in mappings:
        row = rows.get(mapping["alternative_item_code"])
        if row is None:
            # The alternative is no longer an active catalogue item; skip it
            # rather than suggesting something that cannot be opened.
            continue
        original_food = dataset["foods"].get(mapping["original_food"])
        alternative_food = dataset["foods"].get(mapping["alternative_food"])
        rule = dataset["rules"].get(mapping["rule"])
        if original_food is None or alternative_food is None or rule is None:
            continue
        alternatives.append(
            HealthierAlternative(
                item=_summary(row, price_ranges.get(row["item_code"])),
                rule=mapping["rule"],
                headline=rule["reason"],
                comparison_nutrient=rule["comparison"],
                comparison_direction=rule["direction"],
                original_source=_source_ref(original_food, dataset["sources"]),
                alternative_source=_source_ref(alternative_food, dataset["sources"]),
                # A generic entry stands in for the exact product when the
                # source dataset has no product-specific record (AC 7.3.10).
                generic_mapping=mapping["rule"] in {"H4", "H5"},
                nutrients=_comparisons(original_food, alternative_food),
            )
        )
    return HealthierAlternativesResponse(item_code=item_code, count=len(alternatives), alternatives=alternatives)
