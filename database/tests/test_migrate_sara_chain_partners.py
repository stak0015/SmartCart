from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from migrate_sara_chain_partners import partner_chain


class PartnerChainTests(unittest.TestCase):
    def test_named_chain_branches(self):
        for name, expected in [
            ("MYDIN MOHAMED HOLDINGS BHD (TUNJONG)", "MYDIN"),
            ("GIANT HYPERMARKET KOTA BHARU", "GIANT"),
            ("ECONSAVE CASH & CARRY SDN BHD", "ECONSAVE"),
            ("THE STORE (MALAYSIA) SDN. BHD.", "THE STORE"),
            ("PACIFIC HYPERMARKET", "PACIFIC"),
            ("MILIMEWA SUPERMARKET", "MILIMEWA"),
            ("99 SPEEDMART SDN BHD - 1234", "99 SPEEDMART"),
            ("99SPEEDMART KOTA BHARU", "99 SPEEDMART"),
            ("99 SPEED MART SDN. BHD. (BENTA)", "99 SPEEDMART"),
            ("PASAR MINI 99 SPEED MART SDN BHD", "99 SPEEDMART"),
            ("MY MYDIN TAMAN SRI MANJA", "MYDIN"),
            ("MILIMEWAH SUPERSTORE", "MILIMEWA"),
            ("PASARAYA MINI ECONSAVE", "ECONSAVE"),
            ("PASARAYA TESCO KOTA BHARU", "LOTUS'S / TESCO"),
            ("Lotus’s Kota Bharu", "LOTUS'S / TESCO"),
            ("LOTUS STORES (MALAYSIA)", "LOTUS'S / TESCO"),
        ]:
            with self.subTest(name=name):
                self.assertEqual(partner_chain(name), expected)

    def test_unrelated_and_embedded_brand_names_are_not_promoted(self):
        for name in [None, "", "TESCOO MART", "LOTUSFLOWER SHOP", "MYDINAH ENTERPRISE", "KEDAI GIANTSTAR", "KEDAI RUNCIT ALI NEAR TESCO", "SPEEDMART", "81 SPEED MART", "101 SUPERMAN SPEEDMART", "THE STORES", "AEON", "ONE INDEPENDENT SHOP", "TESCO FOOD COURT", "GIANT FOODCOURT", "PACIFIC FOOD COURT", "MEDAN SELERA MYDIN USJ"]:
            with self.subTest(name=name):
                self.assertIsNone(partner_chain(name))
