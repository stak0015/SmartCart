"""Regression checks for reviewed catalogue-to-source nutrition mappings."""

from __future__ import annotations

import unittest

from map_ingredient_nutrition import build


class IngredientMappingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.mappings, cls.unmatched = build()
        cls.by_code = {row["item_code"]: row for row in cls.mappings}
        cls.unmatched_by_code = {row["item_code"]: row for row in cls.unmatched}

    def test_mappings_have_joinable_ids_and_required_macros(self) -> None:
        self.assertGreaterEqual(len(self.mappings), 300)
        required = {"energy_kcal", "protein_g", "fat_g", "carbohydrate_g"}
        for row in self.mappings:
            self.assertEqual(row["match_type"], "generic")
            self.assertEqual(row["status"], "approved")
            self.assertTrue(row["food_id"].startswith(("USDA-", "AFCD-", "MFC-")))
            if row["source"] == "afcd":
                self.assertTrue(row["food_id"].endswith("-per_100g"))
                self.assertEqual(row["food_id"], row["source_record_id"])
            elif row["source"] == "myfcd":
                self.assertEqual(row["food_id"], row["source_record_id"])
                self.assertTrue(row["food_id"].startswith("MFC-"))
            else:
                self.assertEqual(row["food_id"], f"USDA-{row['source_record_id']}")
            self.assertTrue(row["source_url"])
            self.assertTrue(required.issubset(row["nutrients"]))
            self.assertTrue(all(row["nutrients"][name] is not None for name in required))

    def test_nonfoods_and_parent_owned_categories_stay_unmatched(self) -> None:
        for code in ("1017", "1025", "1652"):
            self.assertNotIn(code, self.by_code)
            self.assertIn(code, self.unmatched_by_code)
            self.assertEqual(self.unmatched_by_code[code]["reason"], "non_food")
        # A prepared-meal category is intentionally left for the parent pass.
        parent_rows = [
            row for row in self.unmatched
            if row["reason"] == "parent_owned_category"
        ]
        self.assertTrue(parent_rows)

    def test_coconut_and_flour_do_not_cross_map(self) -> None:
        coconut = self.by_code["101"]
        flour = self.by_code["1498"]
        self.assertIn("coconut", coconut["source_description"].lower())
        self.assertIn("flour", flour["source_description"].lower())
        self.assertNotEqual(coconut["food_id"], flour["food_id"])
        self.assertTrue(coconut["food_id"].startswith("AFCD-"))
        self.assertTrue(flour["food_id"].startswith("USDA-"))

    def test_live_animals_and_ambiguous_species_are_not_filled_by_fuzzy_rules(self) -> None:
        for code in ("3", "1364", "1384"):
            self.assertNotIn(code, self.by_code)
            self.assertIn(code, self.unmatched_by_code)
        # The mapper must not silently collapse an unrepresented fish species
        # into a broad generic fish profile.
        self.assertNotIn("54", self.by_code)

    def test_brewed_and_dry_beverage_states_are_not_collapsed(self) -> None:
        # Loose tea and ground coffee are not interchangeable with instant
        # powders; tea bags also require brewing before nutrition is defined.
        for code in ("1084", "1647", "180", "1650", "1645", "1646", "1851", "1856"):
            self.assertNotIn(code, self.by_code)
        self.assertEqual(self.by_code["929"]["food_id"], "USDA-171893")

    def test_expanded_packaged_and_noodle_categories_are_owned_here(self) -> None:
        expected = {
            "1355": "MFC-CUR-R113024",
            "1493": "MFC-97-101028",
            "1483": "MFC-97-101062",
            "1484": "MFC-97-101026",
            "1050": "AFCD-F006055-per_100g",
            "1905": "AFCD-F006055-per_100g",
        }
        for code, food_id in expected.items():
            self.assertEqual(self.by_code[code]["food_id"], food_id)
            self.assertNotIn(code, self.unmatched_by_code)


if __name__ == "__main__":
    unittest.main()
