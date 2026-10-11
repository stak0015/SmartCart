"""Recommendations must use the same reviewed profiles as item details."""
import json
from pathlib import Path

from smartcart import nutrition
from smartcart.item_nutrition import get_item_nutrition
from smartcart.models import CatalogueItemSummary
from smartcart.nutrition_comparison import compare_category


def fake_catalogue(monkeypatch):
    snapshot = json.loads((Path(__file__).resolve().parents[2] / 'data/nutrition/catalogue_snapshot.json').read_text())
    rows = {r['item_code']: {**r, 'item_id': int(r['item_code'])} for r in snapshot['items']}
    monkeypatch.setattr(nutrition, '_catalogue_rows', lambda codes: {c: rows[c] for c in codes if c in rows})
    monkeypatch.setattr(nutrition, 'catalogue_price_ranges', lambda *args: {})
    monkeypatch.setattr(nutrition, '_summary', lambda row, price: CatalogueItemSummary(
        item_id=row['item_id'], item_code=row['item_code'], item_name=row['item_name'],
        unit=row['unit'], item_category=row['item_category'], package_size=None,
    ))


def test_every_served_recommendation_uses_item_detail_values_and_supported_direction(monkeypatch):
    fake_catalogue(monkeypatch)
    served = 0
    for code in nutrition.nutrition_dataset()['by_item']:
        original = get_item_nutrition(code)
        result = nutrition.healthier_alternatives(code)
        expected = set()
        if original['available']:
            for mapping in nutrition.nutrition_dataset()['by_item'][code]:
                replacement = get_item_nutrition(mapping['alternative_item_code'], basis=original['food']['basis'])
                if replacement['available'] and compare_category(mapping['rule'], original['food'], replacement['food'])[0]:
                    expected.add((mapping['rule'], mapping['alternative_item_code']))
        assert {(a.rule, a.item.item_code) for a in result.alternatives} == expected, code
        for alternative in result.alternatives:
            served += 1
            replacement = get_item_nutrition(alternative.item.item_code, basis=original['food']['basis'])
            assert original['available'] and replacement['available']
            assert alternative.original_source.record_code == original['food']['source_code']
            assert alternative.alternative_source.record_code == replacement['food']['source_code']
            assert alternative.original_source.basis == original['food']['basis']
            for row in alternative.nutrients:
                assert row.original_value == original['food']['nutrients'].get(row.nutrient)
                assert row.alternative_value == replacement['food']['nutrients'].get(row.nutrient)
            headline = next(r for r in alternative.nutrients if r.nutrient == alternative.comparison_nutrient)
            assert headline.status == 'comparable'
            assert (headline.alternative_value < headline.original_value if alternative.comparison_direction == 'lower_is_better'
                    else headline.alternative_value > headline.original_value)
    assert served > 0


def test_missing_or_weaker_new_evidence_cannot_fall_back_to_old_values(monkeypatch):
    fake_catalogue(monkeypatch)
    assert nutrition.healthier_alternatives('1852').count > 0
    monkeypatch.setattr(nutrition, 'get_item_nutrition', lambda code, **kwargs: {'available': False})
    assert nutrition.healthier_alternatives('1852').count == 0

    def same_reference(code, **kwargs):
        return get_item_nutrition('1852')
    monkeypatch.setattr(nutrition, 'get_item_nutrition', same_reference)
    assert nutrition.healthier_alternatives('1852').count == 0, 'Equal values cannot support a lower-fat claim'


def test_drinks_use_reported_sugars_and_water_on_the_same_publisher_basis(monkeypatch):
    fake_catalogue(monkeypatch)
    for code in ('1355', '229', '230', '232'):
        alternatives = nutrition.healthier_alternatives(code).alternatives
        water = next(a for a in alternatives if a.item.item_code == '1322')
        assert water.comparison_nutrient == 'sugars_g'
        assert water.original_source.basis == water.alternative_source.basis
    assert nutrition.healthier_alternatives('171').count == 0, 'Undiluted cordial cannot be compared with water'
    assert not get_item_nutrition('345')['available'], 'Low-fat filled powder cannot use whole-milk powder values'
