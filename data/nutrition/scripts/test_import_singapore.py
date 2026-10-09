"""Offline checks for the SG FoodID importer contract."""

import json
import sys
import unittest
from pathlib import Path

# Support both unittest discovery with this directory as the start directory
# and module invocation from the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_singapore import normalize, number


REPO_ROOT = Path(__file__).resolve().parents[3]
RESEARCH = REPO_ROOT / "research" / "nutrition_coverage"


class ImportSingaporeTest(unittest.TestCase):
    def test_minus_one_is_a_missing_sentinel(self):
        self.assertIsNone(number(-1))
        self.assertIsNone(number(-1.0))
        self.assertEqual(number(0), 0.0)

    def test_drink_uses_publisher_evidenced_per_100g_basis(self):
        detail = {
            "crId": "D-test",
            "name": "Test drink",
            "description": "Test drink",
            "category": "Drink",
            "baseFoodNutrients": {
                "energy": 10,
                "protein": 1,
                "fat": 2,
                "carbohydrate": 3,
            },
        }
        self.assertEqual(normalize(detail)["basis"], "per_100g")
        evidence = next(RESEARCH.glob("raw/sgfoodid_DPJmFok4.chunk.js"), None)
        self.assertIsNotNone(evidence, "saved SG FoodID UI evidence is required")
        self.assertIn("Per 100g", evidence.read_text(encoding="utf-8"))

    def test_generated_output_has_complete_core_values(self):
        output = RESEARCH / "singapore_foods.json"
        self.assertTrue(output.exists(), "run import_singapore.py before this check")
        payload = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(payload["sources"][0]["id"], "SG-HPB")
        for food in payload["foods"]:
            self.assertEqual(food["basis"], "per_100g")
            self.assertTrue(
                all(
                    isinstance(food["nutrients"].get(name), (int, float))
                    and food["nutrients"][name] >= 0
                    for name in ("energy_kcal", "protein_g", "fat_g", "carbohydrate_g")
                )
            )


if __name__ == "__main__":
    unittest.main()
