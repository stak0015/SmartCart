"""Coverage gates use the complete app catalogue, not only mapped items."""
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / 'data/nutrition'


def documents():
    return (json.loads((DATA / 'item_nutrition.json').read_text(encoding='utf-8')),
            json.loads((DATA / 'catalogue_snapshot.json').read_text(encoding='utf-8')))


def test_at_least_eighty_percent_of_the_full_grocery_scope_has_core_nutrition():
    doc, snapshot = documents()
    eligible = {r['item_code'] for r in snapshot['items'] if r['eligible']}
    mapped = {r['item_code'] for r in doc['mappings']}
    assert len(eligible) == 487, 'Re-export and explicitly review a changed catalogue denominator'
    assert mapped <= eligible
    assert len(mapped) * 100 >= len(eligible) * 80
    assert len(mapped) == len(doc['mappings']), 'Duplicate mappings cannot inflate coverage'
    foods = {f['id']: f for f in doc['foods']}
    for mapping in doc['mappings']:
        food = foods[mapping['food_id']]
        for key in ('energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g'):
            assert food['nutrients'][key] is not None, (mapping['item_code'], key)


def test_each_profile_is_traceable_and_all_values_have_a_valid_basis():
    doc, _ = documents()
    sources = {s['id']: s for s in doc['sources']}
    assert 0 < len(sources) < 5
    assert len(sources) == len(doc['sources'])
    assert {f['source'] for f in doc['foods']} == set(sources)
    for source in sources.values():
        assert source['name'] and source['url'].startswith('https://') and source['license']
    for food in doc['foods']:
        assert food['source_code'] and food['description'] and food['url'].startswith('https://')
        assert food['basis'] in ('per_100g', 'per_100ml')
        for value in food['nutrients'].values():
            assert value is None or (type(value) in (int, float) and math.isfinite(value) and value >= 0)
    for mapping in doc['mappings']:
        assert mapping['status'] == 'approved'
        assert mapping['match_type'] in ('generic', 'product')
        assert mapping['rationale'].strip()


def test_coverage_report_is_recomputed_from_actual_mappings():
    doc, snapshot = documents()
    report = doc['coverage']
    mappings = {r['item_code']: r for r in doc['mappings']}
    eligible = [r for r in snapshot['items'] if r['eligible']]
    assert report['covered_food_items'] == len(mappings)
    assert report['eligible_food_items'] == len(eligible)
    assert report['named_catalogue_items'] == len(snapshot['items']) == 756
    assert report['deferred_prepared_food_items'] == sum(r['coverage_exclusion'] == 'prepared_food_deferred' for r in snapshot['items']) == 197
    assert report['nonfood_items'] == sum(r['coverage_exclusion'] == 'nonfood' for r in snapshot['items']) == 72
    assert report['total_food_items'] == report['eligible_food_items'] + report['deferred_prepared_food_items'] == 684
    assert report['coverage_percent'] == round(100 * len(mappings) / len(eligible), 4)
    assert report['catalogue_sha256'] == hashlib.sha256((DATA / 'catalogue_snapshot.json').read_bytes()).hexdigest()
    assert {r['item_code'] for r in report['unmatched']} == {r['item_code'] for r in eligible} - set(mappings)
    assert report['match_types'] == dict(Counter(r['match_type'] for r in mappings.values()))
    for category, counts in report['by_category'].items():
        rows = [r for r in eligible if r['item_category'] == category]
        assert counts == {'total': len(rows), 'covered': sum(r['item_code'] in mappings for r in rows)}


def test_generic_matches_cannot_claim_verified_product_nutrition():
    doc, _ = documents()
    mappings = {r['item_code']: r for r in doc['mappings']}
    foods = {f['id']: f for f in doc['foods']}
    for code in ('101', '102'):
        if code in mappings:
            description = foods[mappings[code]['food_id']]['description'].lower()
            assert 'flour' not in description and 'oil' not in description
    for code in ('1', '2'):
        if code in mappings:
            description = foods[mappings[code]['food_id']]['description'].lower()
            assert 'breast' not in description, 'Whole chicken cannot inherit only skinless breast values'
    for mapping in mappings.values():
        if mapping['match_type'] == 'product':
            assert mapping.get('product_evidence_url'), 'Product match needs direct label/formulation evidence'


def test_preparation_differences_do_not_become_approved_matches():
    doc, _ = documents()
    mappings = {r['item_code']: r for r in doc['mappings']}
    foods = {f['id']: f for f in doc['foods']}
    for code in ('1757', '1761', '1777'):
        if code in mappings:
            food = foods[mappings[code]['food_id']]
            description = (food['description'] + ' ' + (food.get('detail') or '')).lower()
            assert 'battered' not in description and 'breaded' not in description
            assert food['id'] not in {'FNDDS-26141140', 'FNDDS-26158030'}
    if '1256' in mappings:
        food = foods[mappings['1256']['food_id']]
        assert 'baked' not in (food['description'] + ' ' + (food.get('detail') or '')).lower()
    for code in ('1309', '1791'):
        if code in mappings:
            assert mappings[code]['food_id'] != 'MFC-CUR-R225024', 'Concentrate cannot represent brewed kopi'
    for code in ('1877', '2019'):
        if code in mappings:
            food = foods[mappings[code]['food_id']]
            assert food.get('category') != 'Drink', 'Dry coffee mix cannot use prepared beverage values'
    for code in ('1145', '1628'):
        if code in mappings:
            assert foods[mappings[code]['food_id']]['description'] != 'Cereal', 'Infant cereal needs its own formulation family'
    for code in ('1063', '1700'):
        if code in mappings:
            assert foods[mappings[code]['food_id']]['description'] != 'Milk chocolate', 'Filled confectionery is not plain chocolate'


def test_live_route_exposes_the_actual_covered_records_and_preserves_missing_values():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from smartcart.api import router

    doc, snapshot = documents()
    expected = {m['item_code']: m for m in doc['mappings']}
    foods = {f['id']: f for f in doc['foods']}
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        available = 0
        for row in snapshot['items']:
            code = row['item_code']
            response = client.get(f'/api/items/{code}/nutrition')
            assert response.status_code == 200
            body = response.json()
            assert body['item_code'] == code
            assert body['available'] == (code in expected), code
            if body['available']:
                available += 1
                original = foods[expected[code]['food_id']]
                assert body['food']['nutrients'] == original['nutrients'], code
                assert body['food']['basis'] == original['basis']
                assert body['match_type'] == expected[code]['match_type']
                assert body['food']['url'] == original['url']
        assert available == doc['coverage']['covered_food_items']
