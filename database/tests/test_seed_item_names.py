from __future__ import annotations

import sys
import csv
import re
from pathlib import Path

DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from seed_item_names import ITEM_NAME_PATH, read_name_seeds  # noqa: E402


def test_checked_in_lookup_seed_covers_all_757_rows() -> None:
    seeds = read_name_seeds(ITEM_NAME_PATH)
    assert len(seeds) == 757
    assert seeds["-1"] is None
    assert sum(value is not None for value in seeds.values()) == 756


def test_reviewed_translations_keep_brand_detail_and_translate_catalogue_terms() -> None:
    seeds = read_name_seeds(ITEM_NAME_PATH)
    assert seeds["1"] == "Cleaned Chicken - Standard"
    assert seeds["1088"] == "Mazola Corn Oil"


def test_translation_rows_preserve_sources_and_have_no_known_corruption() -> None:
    with ITEM_NAME_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0] == {
        "item_code": "-1",
        "item_name_original": "",
        "item_name_en": "",
    }
    corrupt = re.compile(
        r"NoodlesL|NoodlesN|Souper|VerNoodles|DWater|DIced|NoodlesLO",
        re.IGNORECASE,
    )
    assert not [row for row in rows if corrupt.search(row["item_name_en"])]
    assert not [row for row in rows if "\t" in row["item_name_en"]]
    rows_by_code = {row["item_code"]: row for row in rows}
    assert rows_by_code["51"]["item_name_en"] == "Red Snapper (≥ 1 kilogram each)"
    assert max(len(row["item_name_en"]) for row in rows) <= 500
