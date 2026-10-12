"""Offline checks for the official FNDDS import and reviewed supplement."""

import json
import unittest
from pathlib import Path

from import_fndds import build_mappings, build_output


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "fndds_foods.json"
MAPPINGS = ROOT / "fndds_mappings.json"
if not OUTPUT.exists():
    # The tracked script copy writes generated artifacts to research/.
    ROOT = Path(__file__).resolve().parents[3] / "research" / "nutrition_coverage"
    OUTPUT = ROOT / "fndds_foods.json"
    MAPPINGS = ROOT / "fndds_mappings.json"


class ImportFNDDS(unittest.TestCase):
    def test_workbook_output_has_complete_per_100g_records(self):
        self.assertTrue(OUTPUT.exists(), "run import_fndds.py before this check")
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        self.assertEqual(payload["source"], "USDA-FNDDS-2021-2023")
        self.assertEqual(payload["basis"], "per_100g")
        self.assertEqual(payload["record_count"], len(payload["records"]))
        self.assertGreater(payload["record_count"], 5000)
        self.assertEqual(payload["coverage"]["complete_minimum_count"], payload["record_count"])
        for record in payload["records"]:
            self.assertTrue(record["id"].startswith("FNDDS-"))
            self.assertTrue(record["source_url"].startswith("https://www.ars.usda.gov/"))
            self.assertEqual(record["basis"], "per_100g")
            self.assertTrue(
                all(
                    record["nutrients"][name] is not None
                    for name in ("energy_kcal", "protein_g", "fat_g", "carbohydrate_g")
                )
            )

    def test_kilojoule_conversion_and_mapping_targets(self):
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        by_id = {record["id"]: record for record in payload["records"]}
        milk = by_id["FNDDS-11111000"]
        self.assertAlmostEqual(
            milk["nutrients"]["energy_kj"], milk["nutrients"]["energy_kcal"] * 4.184, places=3
        )
        mappings = json.loads(MAPPINGS.read_text(encoding="utf-8"))
        self.assertEqual(len(mappings), 9)
        self.assertTrue(all(mapping["match_type"] == "generic" for mapping in mappings))
        self.assertTrue(all(mapping["status"] == "approved" for mapping in mappings))
        self.assertEqual(
            {mapping["item_code"]: mapping["food_id"] for mapping in mappings}["1517"],
            "FNDDS-63101120",
        )
        self.assertEqual(
            {mapping["item_code"]: mapping["food_id"] for mapping in mappings}["1635"],
            "FNDDS-12210400",
        )
        self.assertEqual(
            {mapping["item_code"]: mapping["food_id"] for mapping in mappings}["1685"],
            "FNDDS-71200140",
        )
        self.assertTrue(
            {"1199", "1210", "1278", "1757", "1776", "1777"}.isdisjoint(
                str(row["item_code"]) for row in mappings
            )
        )

    def test_supplement_does_not_duplicate_existing_mappings_or_infant_formula(self):
        mappings = json.loads(MAPPINGS.read_text(encoding="utf-8"))
        existing_codes = set()
        for path in (
            ROOT / "ingredient_mappings.json",
            ROOT / "prepared_mappings.json",
        ):
            if path.exists():
                existing_codes.update(str(row["item_code"]) for row in json.loads(path.read_text(encoding="utf-8")))
        self.assertTrue(existing_codes.isdisjoint(str(row["item_code"]) for row in mappings))
        self.assertTrue(
            all("infant formula" not in row["source_description"].lower() for row in mappings)
        )


if __name__ == "__main__":
    unittest.main()
