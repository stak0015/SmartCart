from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd


DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from ingest_pricecatcher import (  # noqa: E402
    PREMISE_ENRICHMENT_PATH,
    combine_prepared_data,
    load_premise_enrichment,
    months_for_year,
    parse_pack_quantity,
    prepare_data,
    prune_price_archives,
    retained_months,
)


class PrepareDataTests(unittest.TestCase):
    def setUp(self) -> None:
        self.items = pd.DataFrame(
            {
                "item_code": [1],
                "item": ["Rice"],
                "unit": ["1 kg"],
                "item_group": ["Food"],
                "item_category": ["Grain"],
            }
        )
        self.premises = pd.DataFrame(
            {
                "premise_code": [10],
                "premise": ["Shop"],
                "address": ["Example address"],
                "district": ["Example district"],
                "state": ["Example state"],
            }
        )

    def test_latest_observation_is_selected(self) -> None:
        prices = pd.DataFrame(
            {
                "date": ["2026-08-01", "2026-08-02"],
                "premise_code": [10, 10],
                "item_code": [1, 1],
                "price": [3.5, 3.25],
            }
        )
        result = prepare_data(prices, self.items, self.premises)
        self.assertEqual(len(result.statuses), 1)
        self.assertEqual(result.statuses.iloc[0]["current_price"], 3.25)
        self.assertEqual(str(result.statuses.iloc[0]["price_observed_date"]), "2026-08-02")

    def test_missing_lookup_rows_are_skipped_not_invented(self) -> None:
        prices = pd.DataFrame(
            {
                "date": ["2026-08-01", "2026-08-01"],
                "premise_code": [10, 10],
                "item_code": [1, 999],
                "price": [3.5, 9.0],
            }
        )
        result = prepare_data(prices, self.items, self.premises)
        self.assertEqual(result.unmatched_item_codes, 1)
        self.assertEqual(result.skipped_price_rows, 1)
        self.assertEqual(len(result.statuses), 1)

    def test_duplicate_daily_key_is_rejected(self) -> None:
        prices = pd.DataFrame(
            {
                "date": ["2026-08-01", "2026-08-01"],
                "premise_code": [10, 10],
                "item_code": [1, 1],
                "price": [3.5, 3.6],
            }
        )
        with self.assertRaisesRegex(ValueError, "duplicate date-premise-item"):
            prepare_data(prices, self.items, self.premises)

    def test_premise_enrichment_adds_candidate_without_verifying_sara(self) -> None:
        prices = pd.DataFrame(
            {
                "date": ["2026-08-01"],
                "premise_code": [10],
                "item_code": [1],
                "price": [3.5],
            }
        )
        enrichment = pd.DataFrame(
            {
                "premise_code": ["10"],
                "google_place_id": ["candidate-place-id"],
                "place_match_refreshed_at": ["2026-08-23T14:48:04Z"],
                "sara_match_candidate": [True],
            }
        )

        result = prepare_data(prices, self.items, self.premises, enrichment)

        self.assertEqual(
            result.premises.iloc[0]["google_place_id"], "candidate-place-id"
        )
        self.assertTrue(result.premises.iloc[0]["sara_match_candidate"])
        self.assertNotIn("sara_partner", result.premises.columns)

    def test_committed_premise_enrichment_matches_its_provenance(self) -> None:
        enrichment = load_premise_enrichment(PREMISE_ENRICHMENT_PATH)

        self.assertEqual(len(enrichment), 3888)
        self.assertEqual(
            int(enrichment["google_place_id"].notna().sum()),
            3803,
        )
        self.assertEqual(
            int(
                enrichment["sara_match_candidate"].sum()
            ),
            1407,
        )

    def test_current_year_months_stop_at_current_month(self) -> None:
        self.assertEqual(
            months_for_year(2026, current_month="2026-08"),
            [f"2026-{month:02d}" for month in range(1, 9)],
        )

    def test_combining_months_selects_latest_status(self) -> None:
        march = prepare_data(
            pd.DataFrame(
                {
                    "date": ["2026-03-31"],
                    "premise_code": [10],
                    "item_code": [1],
                    "price": [3.5],
                }
            ),
            self.items,
            self.premises,
        )
        august = prepare_data(
            pd.DataFrame(
                {
                    "date": ["2026-08-20"],
                    "premise_code": [10],
                    "item_code": [1],
                    "price": [3.1],
                }
            ),
            self.items,
            self.premises,
        )

        result = combine_prepared_data([march, august])

        self.assertEqual(result.source_price_rows, 2)
        self.assertEqual(len(result.statuses), 1)
        self.assertEqual(result.statuses.iloc[0]["current_price"], 3.1)
        self.assertEqual(result.source_min_date, "2026-03-31")
        self.assertEqual(result.source_max_date, "2026-08-20")

    def test_archive_retention_keeps_only_rolling_six_months(self) -> None:
        expected = {f"2026-{month:02d}" for month in range(3, 9)}
        self.assertEqual(retained_months("2026-08", 6), expected)

        with tempfile.TemporaryDirectory() as temporary_directory:
            data_dir = Path(temporary_directory)
            for month in range(1, 9):
                (data_dir / f"pricecatcher_2026-{month:02d}.parquet").touch()
            unrelated = data_dir / "sara_merchants_2026-08-23.json"
            unrelated.touch()

            removed = prune_price_archives(
                data_dir, reference_month="2026-08", keep_count=6
            )

            self.assertEqual(
                {path.name for path in removed},
                {
                    "pricecatcher_2026-01.parquet",
                    "pricecatcher_2026-02.parquet",
                },
            )
            self.assertTrue(unrelated.exists())
            self.assertEqual(
                {
                    path.name
                    for path in data_dir.glob("pricecatcher_*.parquet")
                },
                {f"pricecatcher_{month}.parquet" for month in expected},
            )


class PackQuantityTests(unittest.TestCase):
    def test_normalizes_weight_and_volume_units(self) -> None:
        self.assertEqual(parse_pack_quantity("Rice", "1 kg"), (1.0, "KG"))
        self.assertEqual(parse_pack_quantity("Milk", "500 g"), (0.5, "KG"))
        self.assertEqual(parse_pack_quantity("Oil", "1 litre"), (1.0, "L"))
        self.assertEqual(parse_pack_quantity("Juice", "750 ml"), (0.75, "L"))

    def test_handles_multipacks_before_single_pack_tokens(self) -> None:
        self.assertEqual(parse_pack_quantity("Noodles", "5X79G"), (0.395, "KG"))
        self.assertEqual(parse_pack_quantity("Drink", "6 x 250 ml"), (1.5, "L"))

    def test_prefers_unit_and_falls_back_to_item_name(self) -> None:
        self.assertEqual(
            parse_pack_quantity("Cooking oil 2 kg", "1 kg"),
            (1.0, "KG"),
        )
        self.assertEqual(parse_pack_quantity("Cooking oil 2 kg", None), (2.0, "KG"))

    def test_leaves_non_comparable_quantities_unparsed(self) -> None:
        self.assertIsNone(parse_pack_quantity("Grade A eggs", "10 pcs"))
        self.assertIsNone(parse_pack_quantity(None, None))


if __name__ == "__main__":
    unittest.main()
