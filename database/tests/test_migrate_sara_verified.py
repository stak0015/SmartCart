from __future__ import annotations

import sys
import json
import tempfile
import unittest
from pathlib import Path


DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from migrate_sara_verified import (  # noqa: E402
    PriceCatcherPremise,
    SaraMerchant,
    match_premises,
    write_match_audit,
)


class SaraMatchingTests(unittest.TestCase):
    def merchant(
        self,
        *,
        name: str = "99 Speedmart Sdn Bhd (Taman Aman)",
        postal_code: str = "43000",
        state: str = "Selangor",
        latitude: float = 3.1001,
        longitude: float = 101.6001,
    ) -> SaraMerchant:
        return SaraMerchant(
            source_id="sara-1",
            name=name,
            address="Address",
            city="City",
            postal_code=postal_code,
            state=state,
            latitude=latitude,
            longitude=longitude,
        )

    def premise(
        self,
        *,
        code: str = "10",
        name: str = "99 SPEEDMART TAMAN AMAN",
        address: str = "Address",
        postal_code: str = "43000",
        state: str = "Selangor",
        latitude: float = 3.1000,
        longitude: float = 101.6000,
        decision: str = "accepted",
    ) -> PriceCatcherPremise:
        return PriceCatcherPremise(
            code, name, address, "District", state, postal_code,
            latitude, longitude, decision,
        )

    def test_matches_close_store_with_name_and_postcode_agreement(self) -> None:
        matches = match_premises([self.premise()], [self.merchant()])

        self.assertEqual(len(matches), 1)
        self.assertTrue(matches[0].postcode_match)
        self.assertLess(matches[0].distance_meters, 20)

    def test_rejects_postcode_conflict_even_when_coordinates_are_close(self) -> None:
        matches = match_premises(
            [self.premise(postal_code="43000")],
            [self.merchant(postal_code="43010")],
        )

        self.assertEqual(matches, [])

    def test_rejects_name_conflict_even_when_postcode_matches(self) -> None:
        matches = match_premises(
            [self.premise(name="UNRELATED FRESH MART")],
            [self.merchant()],
        )

        self.assertEqual(matches, [])

    def test_does_not_accept_a_shared_branch_word_as_the_name_match(self) -> None:
        matches = match_premises(
            [self.premise(name="99 SPEED MART TAMAN INTAN")],
            [self.merchant(name="Intan 88 Mart")],
        )

        self.assertEqual(matches, [])

    def test_allows_small_fuzzy_name_variations(self) -> None:
        matches = match_premises(
            [self.premise(name="K CERIA KANGR")],
            [self.merchant(name="PASARAYA K-CERIA (KANGAR) SDN. BHD.")],
        )

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].shared_name_token_count, 2)
        self.assertEqual(matches[0].matched_brand_token_count, 2)
        self.assertGreaterEqual(matches[0].name_score, 0.9)

    def test_tesco_matches_the_lotuss_sara_brand_alias(self) -> None:
        matches = match_premises(
            [self.premise(name="TESCO SEREMBAN 2")],
            [self.merchant(name="Lotuss Seremban 2")],
        )

        self.assertEqual(len(matches), 1)
        self.assertTrue(matches[0].postcode_match)

    def test_rejects_location_only_overlap_when_brand_name_differs(self) -> None:
        premise = self.premise(
            name="PASAR AWAM KUALA KUBU BHARU",
            address="Kuala Kubu Bharu 44000",
            postal_code="44000",
        )
        merchant = self.merchant(
            name="99 Speedmart Sdn Bhd (Kuala Kubu Bharu)",
            postal_code="44000",
        )

        self.assertEqual(match_premises([premise], [merchant]), [])

    def test_requires_stricter_name_and_state_checks_without_postcode(self) -> None:
        matches = match_premises(
            [self.premise(postal_code="")],
            [self.merchant(postal_code="")],
        )
        self.assertEqual(len(matches), 1)

        state_mismatch = match_premises(
            [self.premise(postal_code="", state="Johor")],
            [self.merchant(postal_code="", state="Selangor")],
        )
        self.assertEqual(state_mismatch, [])

    def test_excludes_non_accepted_place_candidates(self) -> None:
        matches = match_premises(
            [self.premise(decision="needs_review")], [self.merchant()]
        )

        self.assertEqual(matches, [])

    def test_default_radius_is_conservative(self) -> None:
        matches = match_premises(
            [self.premise()],
            [self.merchant(latitude=3.1015)],
        )

        self.assertEqual(matches, [])

    def test_audit_contains_every_premise_and_full_candidate_details(self) -> None:
        premises = [
            self.premise(),
            self.premise(code="11", decision="needs_review"),
        ]
        merchants = [self.merchant()]
        matches = match_premises(premises, merchants)

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "audit.json"
            summary = write_match_audit(output, premises, merchants, matches, 150)
            body = json.loads(output.read_text(encoding="utf-8"))

        self.assertEqual(summary["pricecatcher_premises"], 2)
        self.assertEqual(summary["matched"], 1)
        self.assertEqual(len(body["records"]), 2)
        matched = body["records"][0]
        self.assertEqual(matched["matched_sara_candidate"]["address"], "Address")
        self.assertIn("latitude", matched["matched_sara_candidate"])
        self.assertIn("longitude", matched["matched_sara_candidate"])
        self.assertEqual(
            body["records"][1]["match_status"],
            "no_accepted_place_coordinate",
        )
        self.assertIsNotNone(body["records"][1]["matched_sara_candidate"])


if __name__ == "__main__":
    unittest.main()
