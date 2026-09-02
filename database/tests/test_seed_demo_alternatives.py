from __future__ import annotations

import sys
import unittest
from decimal import Decimal
from pathlib import Path


DATABASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = DATABASE_DIR.parent
sys.path.insert(0, str(DATABASE_DIR))
sys.path.insert(0, str(PROJECT_DIR / "backend"))

from ingest_pricecatcher import parse_pack_quantity  # noqa: E402
from seed_demo_alternatives import DEMO_ITEMS  # noqa: E402
from smartcart.alternatives import package_basis, product_family  # noqa: E402


class DemoAlternativeFixtureTests(unittest.TestCase):
    def test_fixture_contains_strict_cheaper_equivalent_pairs(self) -> None:
        for size in ("155 g", "425 g"):
            source = next(
                item
                for item in DEMO_ITEMS
                if "AYAM" in item.item_name and item.unit == size
            )
            alternative = next(
                item
                for item in DEMO_ITEMS
                if "KING CUP" in item.item_name and item.unit == size
            )
            self.assertEqual(source.item_category, alternative.item_category)
            self.assertEqual(
                package_basis(source.item_name, source.unit),
                package_basis(alternative.item_name, alternative.unit),
            )
            self.assertEqual(
                product_family(source.item_name), product_family(alternative.item_name)
            )
            self.assertLess(alternative.current_price, source.current_price)

    def test_fixture_contains_lower_unit_value_pack_options(self) -> None:
        sardines = [item for item in DEMO_ITEMS if "SARDIN" in item.item_name]
        best_sardine = min(
            sardines,
            key=lambda item: item.current_price / item.quantity_value,
        )
        self.assertEqual(best_sardine.unit, "850 g")
        self.assertEqual(
            best_sardine.current_price / best_sardine.quantity_value,
            Decimal("19"),
        )

        oils = [item for item in DEMO_ITEMS if "MINYAK JAGUNG" in item.item_name]
        best_oil = min(oils, key=lambda item: item.current_price / item.quantity_value)
        self.assertEqual(best_oil.unit, "2 litre")
        self.assertEqual(
            best_oil.current_price / best_oil.quantity_value,
            Decimal("10"),
        )

    def test_fixture_quantities_match_parser(self) -> None:
        for item in DEMO_ITEMS:
            self.assertEqual(
                parse_pack_quantity(item.item_name, item.unit),
                (float(item.quantity_value), item.quantity_unit),
            )


if __name__ == "__main__":
    unittest.main()
