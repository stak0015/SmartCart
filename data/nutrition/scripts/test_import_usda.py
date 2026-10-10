"""Small offline checks for the USDA research import."""

import json
import unittest
from pathlib import Path

from import_usda import _normalise_nutrients


class ImportUSDATest(unittest.TestCase):
    def test_nutrient_numbers_and_kcal_fallback(self):
        food = {
            "foodNutrients": [
                {"nutrient": {"number": "268"}, "amount": 418.4},
                {"nutrient": {"number": "203"}, "amount": 10},
                {"nutrient": {"number": "204"}, "amount": 2},
                {"nutrient": {"number": "205"}, "amount": 5},
            ]
        }
        values, provenance = _normalise_nutrients(food)
        self.assertEqual(values["energy_kj"], 418.4)
        self.assertEqual(values["energy_kcal"], 100.0)
        self.assertEqual(values["protein_g"], 10.0)
        self.assertIn("derived", provenance["energy_kcal"])

    def test_total_sugar_is_reported_measurement_not_carbohydrate(self):
        values, _ = _normalise_nutrients({'foodNutrients': [
            {'nutrient': {'number': '205'}, 'amount': 10},
            {'nutrient': {'number': '269'}, 'amount': 4},
        ]})
        self.assertEqual(values['sugars_g'], 4)
        missing, _ = _normalise_nutrients({'foodNutrients': [{'nutrient': {'number': '205'}, 'amount': 10}]})
        self.assertIsNone(missing['sugars_g'])

    def test_generated_output_has_coherent_provenance(self):
        output = Path(__file__).with_name("usda_foods.json")
        if not output.exists():
            # Tracked copies of the scripts keep generated research data in
            # research/nutrition_coverage rather than beside the script.
            output = Path(__file__).resolve().parents[3] / "research" / "nutrition_coverage" / "usda_foods.json"
        self.assertTrue(output.exists(), "run import_usda.py before this check")
        payload = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(payload["source"], "USDA FoodData Central")
        self.assertEqual(payload["record_count"], len(payload["records"]))
        self.assertEqual(len(payload["provenance"]), 2)
        for record in payload["records"]:
            self.assertTrue(record["source_url"].startswith("https://fdc.nal.usda.gov/food-details/"))
            self.assertEqual(record["basis"], "per 100 g")
            if record["complete_minimum"]:
                self.assertTrue(
                    all(record["nutrients"][name] is not None for name in payload["coverage"]["minimum_fields"])
                )


if __name__ == "__main__":
    unittest.main()
