from contextlib import contextmanager
from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from main import create_app
from smartcart.alternatives import AlternativePriceItem, BasketAlternative
from smartcart.models import BasketLineRequest
from smartcart.pack_ratios import get_pack_options


TODAY = date(2026, 9, 1)

# Source rows: (item_id, item_name, unit, quantity_value, quantity_unit)
SOURCE_ROWS = [
    (1, "MINYAK JAGUNG CAP MAZOLA", "1 kg", Decimal("1"), "KG"),
    (7, "ROTAN BASKET ONLY", "per bag", None, None),
]

# Premise rows: (item_id, item_name, unit, quantity_value, quantity_unit,
#                current_price, price_observed_date)
PREMISE_ROWS = [
    (1, "MINYAK JAGUNG CAP MAZOLA", "1 kg", Decimal("1"), "KG", Decimal("10.00"), TODAY),
    (2, "MINYAK JAGUNG CAP DAISY", "1 kg", Decimal("1"), "KG", Decimal("9.50"), TODAY),
    (3, "MINYAK JAGUNG CAP MAZOLA", "2 kg", Decimal("2"), "KG", Decimal("18.00"), TODAY),
    (4, "MINYAK JAGUNG CAP DAISY", "2 kg", Decimal("2"), "KG", Decimal("19.00"), TODAY),
    (5, "MINYAK MASAK TULEN CAP BURUH", "1 kg", Decimal("1"), "KG", Decimal("7.00"), TODAY),
    # Same family name prefix would never happen here; different family must be excluded.
    (6, "SANTAN KELAPA JENAMA KARA", "200 ml", Decimal("0.2"), "L", Decimal("3.00"), TODAY),
]


def fake_cursor_factory(source_rows, premise_rows):
    class Cursor:
        def __init__(self) -> None:
            self.rows = []

        def execute(self, query, _params) -> None:
            self.rows = source_rows if "WHERE item_id = ANY" in query else premise_rows

        def fetchall(self):
            return self.rows

    @contextmanager
    def fake_cursor():
        yield Cursor()

    return fake_cursor


def basket(*item_ids: int) -> list[BasketLineRequest]:
    return [BasketLineRequest(item_id=item_id, quantity=1) for item_id in item_ids]


def test_multi_size_family_lists_every_priced_pack(monkeypatch) -> None:
    monkeypatch.setattr(
        "smartcart.pack_ratios.database_cursor",
        fake_cursor_factory(SOURCE_ROWS, PREMISE_ROWS),
    )
    options = get_pack_options("10", basket(1))

    # Full-precision unit ratios: item3 9.00 < item2 9.50 = item4 9.50 < item1 10.00;
    # the 9.50 tie breaks on the smaller item id.
    packs = options["1"]
    assert [pack.item_id for pack in packs] == ["3", "2", "4", "1"]
    assert packs[0].package_size == "2 kg"
    assert packs[0].total_price_rm == 18.0
    assert packs[0].price_per_unit_rm == 9.0  # RM 18.00 / 2 kg, full precision
    assert packs[1].price_per_unit_rm == 9.5
    assert packs[0].unit_kind == "KG"
    # AC 3.2.2: exactly one Best value pick, the cheapest unit price.
    assert [pack.is_best_value for pack in packs] == [True, False, False, False]


def test_tradeoff_diffs_measured_against_best_value(monkeypatch) -> None:
    monkeypatch.setattr(
        "smartcart.pack_ratios.database_cursor",
        fake_cursor_factory(SOURCE_ROWS, PREMISE_ROWS),
    )
    packs = get_pack_options("10", basket(1))["1"]

    # Best value card (item 3: RM 18.00, RM 9.00/kg) is the baseline itself.
    assert packs[0].is_best_value
    assert packs[0].upfront_diff_rm is None
    assert packs[0].per_unit_diff_rm is None
    # Every other card: upfront diff = own total - best total; per-unit diff =
    # own ratio - best ratio. Best value is the cheapest per unit, so the
    # per-unit diff is never negative.
    assert [(p.upfront_diff_rm, p.per_unit_diff_rm) for p in packs[1:]] == [
        (-8.50, 0.50),  # item 2: RM 9.50, RM 9.50/kg
        (1.00, 0.50),   # item 4: RM 19.00, RM 9.50/kg
        (-8.00, 1.00),  # item 1: RM 10.00, RM 10.00/kg
    ]
    for pack in packs[1:]:
        assert pack.per_unit_diff_rm >= 0
        # Money identity: the displayed upfront diff reconciles with the
        # displayed totals to the sen (no separate rounding path).
        assert pack.total_price_rm - packs[0].total_price_rm == pack.upfront_diff_rm


def test_best_value_tie_prefers_newest_observed_price(monkeypatch) -> None:
    old, new = date(2026, 8, 1), date(2026, 8, 27)
    sources = [(20, "MARJERIN PLANTA", "240 g", Decimal("0.24"), "KG")]
    premise_rows = [
        (20, "MARJERIN PLANTA", "240 g", Decimal("0.24"), "KG", Decimal("2.40"), old),
        (21, "MARJERIN PLANTA", "480 g", Decimal("0.48"), "KG", Decimal("4.80"), old),
        (22, "MARJERIN PLANTA", "480 g", Decimal("0.48"), "KG", Decimal("4.80"), new),
    ]
    monkeypatch.setattr(
        "smartcart.pack_ratios.database_cursor",
        fake_cursor_factory(sources, premise_rows),
    )
    options = get_pack_options("10", basket(20))

    packs = options["20"]
    # All three ratio to 10.00/kg; the newest observed 480 g pack wins.
    assert [pack.item_id for pack in packs] == ["22", "20", "21"]
    assert [pack.is_best_value for pack in packs] == [True, False, False]


def test_unparseable_source_gets_no_comparison(monkeypatch) -> None:
    monkeypatch.setattr(
        "smartcart.pack_ratios.database_cursor",
        fake_cursor_factory(SOURCE_ROWS, PREMISE_ROWS),
    )
    options = get_pack_options("10", basket(7))

    assert options["7"] == []


def test_single_size_family_and_foreign_family_excluded(monkeypatch) -> None:
    # Only one pack size of SANTAN KELAPA is priced -> no comparison block;
    # MINYAK MASAK TULEN is a different family from MINYAK JAGUNG and must not
    # leak into its options (covered by the family key itself).
    sources = [(8, "SANTAN KELAPA JENAMA KARA", "200 ml", Decimal("0.2"), "L")]
    monkeypatch.setattr(
        "smartcart.pack_ratios.database_cursor",
        fake_cursor_factory(sources, PREMISE_ROWS),
    )
    options = get_pack_options("10", basket(8))

    assert options["8"] == []


def test_unit_kinds_never_mix(monkeypatch) -> None:
    sources = [(9, "SOS CILI MAGGI", "340 g", Decimal("0.34"), "KG")]
    premise_rows = [
        (9, "SOS CILI MAGGI", "340 g", Decimal("0.34"), "KG", Decimal("4.00"), TODAY),
        (10, "SOS CILI MAGGI", "500 g", Decimal("0.5"), "KG", Decimal("5.50"), TODAY),
        # Same family but a litre-based sibling must not join the KG comparison.
        (11, "SOS CILI MAGGI", "1 l", Decimal("1"), "L", Decimal("9.00"), TODAY),
    ]
    monkeypatch.setattr(
        "smartcart.pack_ratios.database_cursor",
        fake_cursor_factory(sources, premise_rows),
    )
    options = get_pack_options("10", basket(9))

    assert [pack.item_id for pack in options["9"]] == ["10", "9"]


def test_endpoint_returns_pack_options_in_camel_case(monkeypatch) -> None:
    source = AlternativePriceItem(
        item_id="1", item_name="MINYAK JAGUNG CAP MAZOLA", unit="1 kg",
        package_size="1 kg", unit_price_rm=10.0, line_total_rm=10.0,
        observed_date=TODAY, price_observed_days_ago=0, sara_eligible=None,
        sara_category_candidate=False, is_sara_credit_candidate=False,
    )
    monkeypatch.setattr("smartcart.api.premise_exists", lambda _premise_id: True)
    monkeypatch.setattr(
        "smartcart.api.get_basket_alternatives",
        lambda _premise_id, _basket: [BasketAlternative(1, source, None, None)],
    )
    monkeypatch.setattr(
        "smartcart.api.get_pack_options",
        lambda _premise_id, _basket: {"1": []},
    )

    response = TestClient(create_app()).post(
        "/api/premises/10/basket-alternatives",
        json={"basket": [{"itemId": "1", "quantity": 1}]},
    )
    assert response.status_code == 200
    line = response.json()["lines"][0]
    assert "packOptions" in line
    assert line["packOptions"] == []
