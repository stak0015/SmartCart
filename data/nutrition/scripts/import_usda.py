"""Import USDA FoodData Central generic food archives.

This importer intentionally keeps the USDA datasets together as one source while
retaining the original dataset name on every record.  It imports nutrient values
as reported per 100 g and does not attempt to match catalogue items.

Usage (from the repository root)::

    python data/nutrition/scripts/import_usda.py --download
    python data/nutrition/scripts/import_usda.py

The download step is optional once the two archives exist in ``raw``.  Raw ZIPs
are retained so that the generated JSON can be recreated and audited later.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[3] / "research/nutrition_coverage"
RAW_DIR = ROOT / "raw"
OUTPUT_PATH = ROOT / "usda_foods.json"
SOURCE_DOWNLOAD_PAGE = "https://fdc.nal.usda.gov/download-datasets/"

DATASETS = (
    {
        "key": "foundation",
        "name": "Foundation Foods",
        "json_key": "FoundationFoods",
        "release": "April 2026",
        "archive_name": "foundation.zip",
        "archive_url": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip",
    },
    {
        "key": "sr_legacy",
        "name": "SR Legacy",
        "json_key": "SRLegacyFoods",
        "release": "April 2018",
        "archive_name": "sr_legacy.zip",
        "archive_url": "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip",
    },
)

# USDA FoodData Central nutrient numbers (the legacy-compatible ``number``
# field, rather than the internal numeric ``id``).  These numbers are stable
# across the two selected data types and avoid fragile matching on names.
NUTRIENTS = {
    "energy_kcal": "208",
    "energy_kj": "268",
    "protein_g": "203",
    "fat_g": "204",
    "carbohydrate_g": "205",
    "sugars_g": "269",
    "fiber_g": "291",
    "sodium_mg": "307",
    "saturated_fat_g": "606",
    "calcium_mg": "301",
}

MINIMUM_FIELDS = ("energy_kcal", "protein_g", "fat_g", "carbohydrate_g")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_archives() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for dataset in DATASETS:
        target = RAW_DIR / dataset["archive_name"]
        temporary = target.with_suffix(target.suffix + ".part")
        print(f"Downloading {dataset['name']} -> {target}")
        try:
            urllib.request.urlretrieve(dataset["archive_url"], temporary)
            temporary.replace(target)
        finally:
            if temporary.exists():
                temporary.unlink()


def _archive_json(path: Path) -> tuple[str, dict[str, Any]]:
    with zipfile.ZipFile(path) as archive:
        members = [name for name in archive.namelist() if name.lower().endswith(".json")]
        if len(members) != 1:
            raise ValueError(f"Expected one JSON member in {path}, found {members!r}")
        member = members[0]
        with archive.open(member) as stream:
            return member, json.load(stream)


def _nutrient_rows(food: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for row in food.get("foodNutrients") or []:
        if isinstance(row, dict) and isinstance(row.get("nutrient"), dict):
            yield row


def _value_by_number(food: dict[str, Any], number: str) -> float | None:
    """Return the first reported amount for a USDA nutrient number."""
    for row in _nutrient_rows(food):
        nutrient = row["nutrient"]
        if str(nutrient.get("number")) == number and row.get("amount") is not None:
            try:
                return float(row["amount"])
            except (TypeError, ValueError):
                continue
    return None


def _normalise_nutrients(food: dict[str, Any]) -> tuple[dict[str, float | None], dict[str, str]]:
    values = {name: _value_by_number(food, number) for name, number in NUTRIENTS.items()}
    provenance: dict[str, str] = {}

    # A small number of records report energy only in kJ.  Preserve the raw kJ
    # value and provide a clearly marked, deterministic kcal conversion so every
    # record can still satisfy the app's energy field when the source is complete.
    if values["energy_kcal"] is not None:
        provenance["energy_kcal"] = "USDA nutrient 208 (reported kcal)"
    elif values["energy_kj"] is not None:
        values["energy_kcal"] = round(values["energy_kj"] / 4.184, 4)
        provenance["energy_kcal"] = "derived from USDA nutrient 268 kJ using 1 kcal = 4.184 kJ"

    for field, number in NUTRIENTS.items():
        if field == "energy_kcal" or values[field] is None:
            continue
        unit = "kJ" if field == "energy_kj" else "USDA reported unit"
        provenance[field] = f"USDA nutrient {number} ({unit})"
    return values, provenance


def _record(dataset: dict[str, Any], food: dict[str, Any]) -> dict[str, Any]:
    values, nutrient_provenance = _normalise_nutrients(food)
    fdc_id = food.get("fdcId")
    if fdc_id is None:
        raise ValueError(f"USDA record has no fdcId: {food.get('description')!r}")
    complete = all(values[field] is not None for field in MINIMUM_FIELDS)
    category = food.get("foodCategory")
    if isinstance(category, dict):
        category = category.get("description")
    return {
        "fdc_id": int(fdc_id),
        "dataset": dataset["name"],
        "data_type": food.get("dataType"),
        "description": food.get("description"),
        "category": category,
        "ndb_number": food.get("ndbNumber"),
        "publication_date": food.get("publicationDate"),
        "source_url": f"https://fdc.nal.usda.gov/food-details/{int(fdc_id)}/nutrients",
        "basis": "per 100 g",
        "complete_minimum": complete,
        "nutrients": values,
        "nutrient_provenance": nutrient_provenance,
    }


def _provenance(dataset: dict[str, Any], archive_path: Path, member: str) -> dict[str, Any]:
    return {
        "dataset": dataset["name"],
        "release": dataset["release"],
        "archive_url": dataset["archive_url"],
        "download_page": SOURCE_DOWNLOAD_PAGE,
        "raw_archive": f"raw/{dataset['archive_name']}",
        "raw_archive_sha256": sha256_file(archive_path),
        "raw_json_member": member,
    }


def build_output(retrieved_at: str | None = None) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    provenance: list[dict[str, Any]] = []
    for dataset in DATASETS:
        archive_path = RAW_DIR / dataset["archive_name"]
        if not archive_path.exists():
            raise FileNotFoundError(
                f"Missing {archive_path}. Run with --download or place the official archive in raw/"
            )
        member, payload = _archive_json(archive_path)
        foods = payload.get(dataset["json_key"])
        if not isinstance(foods, list):
            raise ValueError(f"{archive_path} did not contain list key {dataset['json_key']!r}")
        provenance.append(_provenance(dataset, archive_path, member))
        records.extend(_record(dataset, food) for food in foods if isinstance(food, dict))

    records.sort(key=lambda row: (row["dataset"], row["fdc_id"]))
    coverage = {
        "minimum_fields": list(MINIMUM_FIELDS),
        "complete_minimum_count": sum(row["complete_minimum"] for row in records),
        "nutrient_counts": {
            field: sum(row["nutrients"].get(field) is not None for row in records)
            for field in NUTRIENTS
        },
    }
    return {
        "schema_version": "1.0",
        "source": "USDA FoodData Central",
        "source_url": SOURCE_DOWNLOAD_PAGE,
        "retrieved_at": retrieved_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "basis": "per 100 g",
        "nutrient_units": {
            "energy_kcal": "kcal",
            "energy_kj": "kJ",
            "protein_g": "g",
            "fat_g": "g",
            "carbohydrate_g": "g",
            "fiber_g": "g",
            "sodium_mg": "mg",
            "saturated_fat_g": "g",
            "calcium_mg": "mg",
        },
        "coverage": coverage,
        "provenance": provenance,
        "record_count": len(records),
        "records": records,
    }


def write_output(payload: dict[str, Any], path: Path = OUTPUT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    with temporary.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(payload, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="download the two official USDA archives first")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH, help="output JSON path")
    args = parser.parse_args()
    if args.download:
        download_archives()
    payload = build_output()
    write_output(payload, args.output)
    print(
        f"Wrote {payload['record_count']} USDA records to {args.output} "
        f"({payload['coverage']['complete_minimum_count']} complete minimum records)"
    )


if __name__ == "__main__":
    main()

