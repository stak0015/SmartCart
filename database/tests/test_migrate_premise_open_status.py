from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd


DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from migrate_premise_open_status import (  # noqa: E402
    load_premise_coordinates,
    load_premise_open_status,
)


class PremiseOpenStatusSnapshotTests(unittest.TestCase):
    def write_snapshot(self, directory: Path, rows: str) -> Path:
        path = directory / "premises.csv"
        path.write_text(
            "premise_code,place_id,open_closed_status\n" + rows,
            encoding="utf-8",
        )
        path.with_suffix(".provenance.json").write_text(
            json.dumps({"generated_at": "2026-09-09T09:41:07Z"}),
            encoding="utf-8",
        )
        return path

    @staticmethod
    def write_cache(directory: Path, results: dict[str, dict]) -> Path:
        path = directory / "premises.cache.json"
        path.write_text(
            json.dumps(
                {
                    "generated_at": "2026-09-08T14:16:50Z",
                    "results": results,
                }
            ),
            encoding="utf-8",
        )
        return path

    def test_loads_valid_rows_and_preserves_missing_status(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = self.write_snapshot(
                Path(temporary_directory),
                "10.0,place-10,OPEN\n11.0,,\n",
            )

            result = load_premise_open_status(path)

        self.assertEqual(result["premise_code"].tolist(), ["10", "11"])
        self.assertEqual(result.iloc[0]["open_closed_status"], "open")
        self.assertTrue(pd.isna(result.iloc[1]["open_closed_status"]))
        self.assertEqual(
            str(result.iloc[0]["place_status_refreshed_at"]),
            "2026-09-09 09:41:07+00:00",
        )

    def test_rejects_an_unrecognized_status(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = self.write_snapshot(
                Path(temporary_directory), "10,place-10,maybe_open\n"
            )
            with self.assertRaisesRegex(ValueError, "invalid statuses"):
                load_premise_open_status(path)

    def test_rejects_duplicate_codes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = self.write_snapshot(
                Path(temporary_directory),
                "10,place-a,open\n10.0,place-b,closed_permanently\n",
            )
            with self.assertRaisesRegex(ValueError, "duplicate premise_code"):
                load_premise_open_status(path)

    def test_coordinates_use_selected_place_not_postcode_geocode(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            csv_path = self.write_snapshot(directory, "10,place-10,open\n")
            status_rows = load_premise_open_status(csv_path)
            cache_path = self.write_cache(
                directory,
                {
                    "0": {
                        "premise_code": "10.0",
                        "place_id": "place-10",
                        "place_open_closed_status": "open",
                        "geocode_latitude": 1.0,
                        "geocode_longitude": 101.0,
                        "place_latitude": 3.139,
                        "place_longitude": 101.6869,
                    }
                },
            )

            result = load_premise_coordinates(cache_path, status_rows)

        self.assertEqual(result["premise_code"].tolist(), ["10"])
        self.assertEqual(result.iloc[0]["latitude"], 3.139)
        self.assertEqual(result.iloc[0]["longitude"], 101.6869)
        self.assertEqual(result.iloc[0]["location_provider"], "google")
        self.assertEqual(
            str(result.iloc[0]["location_refreshed_at"]),
            "2026-09-08 14:16:50+00:00",
        )

    def test_missing_selected_place_coordinates_prepare_a_clear(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            csv_path = self.write_snapshot(directory, "10,,\n")
            status_rows = load_premise_open_status(csv_path)
            cache_path = self.write_cache(
                directory,
                {
                    "0": {
                        "premise_code": "10",
                        "place_id": "",
                        "place_open_closed_status": "",
                        "geocode_latitude": 3.14,
                        "geocode_longitude": 101.69,
                        "place_latitude": None,
                        "place_longitude": None,
                    }
                },
            )

            result = load_premise_coordinates(cache_path, status_rows)

        self.assertEqual(len(result), 1)
        self.assertTrue(pd.isna(result.iloc[0]["latitude"]))
        self.assertTrue(pd.isna(result.iloc[0]["longitude"]))
        self.assertTrue(pd.isna(result.iloc[0]["location_provider"]))
        self.assertTrue(pd.isna(result.iloc[0]["location_refreshed_at"]))

    def test_coordinates_require_the_companion_csv_place_id(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            csv_path = self.write_snapshot(directory, "10,new-place,open\n")
            status_rows = load_premise_open_status(csv_path)
            cache_path = self.write_cache(
                directory,
                {
                    "0": {
                        "premise_code": "10",
                        "place_id": "old-place",
                        "place_open_closed_status": "open",
                        "place_latitude": 3.139,
                        "place_longitude": 101.6869,
                    }
                },
            )

            with self.assertRaisesRegex(ValueError, "do not match"):
                load_premise_coordinates(cache_path, status_rows)

    def test_coordinates_reject_partial_pairs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            csv_path = self.write_snapshot(directory, "10,place-10,open\n")
            status_rows = load_premise_open_status(csv_path)
            cache_path = self.write_cache(
                directory,
                {
                    "0": {
                        "premise_code": "10",
                        "place_id": "place-10",
                        "place_open_closed_status": "open",
                        "place_latitude": 3.139,
                        "place_longitude": None,
                    }
                },
            )

            with self.assertRaisesRegex(ValueError, "incomplete coordinate pair"):
                load_premise_coordinates(cache_path, status_rows)

    def test_cache_codes_may_be_a_subset_of_csv_codes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            csv_path = self.write_snapshot(
                directory, "-1,,\n10,place-10,open\n"
            )
            status_rows = load_premise_open_status(csv_path)
            cache_path = self.write_cache(
                directory,
                {
                    "0": {
                        "premise_code": "",
                        "place_id": "",
                        "place_open_closed_status": "",
                        "place_latitude": None,
                        "place_longitude": None,
                    },
                    "1": {
                        "premise_code": "10",
                        "place_id": "place-10",
                        "place_open_closed_status": "open",
                        "place_latitude": 3.139,
                        "place_longitude": 101.6869,
                    },
                },
            )

            result = load_premise_coordinates(cache_path, status_rows)

        self.assertEqual(result["premise_code"].tolist(), ["10"])

    def test_coordinates_require_matching_business_status(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            csv_path = self.write_snapshot(directory, "10,place-10,open\n")
            status_rows = load_premise_open_status(csv_path)
            cache_path = self.write_cache(
                directory,
                {
                    "0": {
                        "premise_code": "10",
                        "place_id": "place-10",
                        "place_open_closed_status": "closed_permanently",
                        "place_latitude": 3.139,
                        "place_longitude": 101.6869,
                    }
                },
            )

            with self.assertRaisesRegex(ValueError, "business status"):
                load_premise_coordinates(cache_path, status_rows)


if __name__ == "__main__":
    unittest.main()
