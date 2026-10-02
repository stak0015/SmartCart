from __future__ import annotations

import sys
import unittest
from pathlib import Path


DATABASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DATABASE_DIR))

from sara_chain_catalog import (  # noqa: E402
    build_chain_catalog,
    canonical_chain_key,
)


class SaraChainCatalogTests(unittest.TestCase):
    def test_branch_and_legal_suffixes_reduce_to_same_chain_key(self) -> None:
        self.assertEqual(
            canonical_chain_key("PASARAYA K-CERIA (KANGAR) SDN. BHD."),
            "K CERIA",
        )

    def test_tesco_is_an_alias_for_lotuss(self) -> None:
        self.assertEqual(
            canonical_chain_key("TESCO SEREMBAN 2"),
            canonical_chain_key("Lotus's Seremban 2"),
        )
        self.assertEqual(
            canonical_chain_key("K-Ceria (Kangar)"),
            "K CERIA",
        )

    def test_catalog_keeps_recurring_groups_and_samples(self) -> None:
        catalog = build_chain_catalog(
            [
                {
                    "source_id": "1",
                    "trading_name": "99 Speedmart Sdn Bhd (A)",
                    "state": "Selangor",
                },
                {
                    "source_id": "2",
                    "trading_name": "99 Speedmart Sdn Bhd (B)",
                    "state": "Johor",
                },
                {
                    "source_id": "3",
                    "trading_name": "One Independent Shop",
                    "state": "Perak",
                },
            ]
        )

        self.assertEqual(catalog["summary"]["recurring_chain_groups"], 1)
        self.assertEqual(catalog["chain_groups"][0]["chain_key"], "99 SPEEDMART")
        self.assertEqual(catalog["chain_groups"][0]["merchant_count"], 2)
        self.assertEqual(catalog["chain_groups"][0]["states"], ["Johor", "Selangor"])

    def test_catalog_cross_references_official_partner_names(self) -> None:
        catalog = build_chain_catalog(
            [
                {"source_id": "1", "trading_name": "K-Ceria (Kangar)"},
                {"source_id": "2", "trading_name": "K-Ceria (Arau)"},
            ],
            ["K-Ceria", "A One-Off Grocer"],
        )

        self.assertEqual(catalog["summary"]["official_partner_names"], 2)
        self.assertEqual(
            catalog["chain_groups"][0]["official_partner_names"], ["K-Ceria"]
        )


if __name__ == "__main__":
    unittest.main()
