"""Build a bounded catalogue nutrition dataset from reviewed source mappings.

Run from the repository root after the source imports and mapping review.
No fuzzy candidate is promoted here. All selected profiles must contain the
four core measurements on an explicit comparison basis.
"""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/nutrition'
RESEARCH = ROOT / 'research/nutrition_coverage'
CORE = ('energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g')
NONFOOD = {
    'ALAT TULIS DAN BAHAN BACAAN', 'BERUS GIGI', 'LAMPIN PAKAI BUANG',
    'MAJALAH', 'MOUTH WASH', 'PENGHALAU NYAMUK', 'PENJAGAAN DIRI',
    'PENJAGAAN RUMAH', 'PEWANGI RUMAH', 'SABUN BADAN', 'SYAMPU', 'TISU',
    'TUALA WANITA', 'UBAT GIGI', 'UBAT-UBATAN',
}
# User deferred prepared dishes and made-to-order drinks from this coverage target.
PREPARED = {'LAUK', 'NASI', 'MINUMAN', 'LAIN-LAIN', 'MEE / BIHUN / KUEY TEOW'}
# Plain drinking water has no recipe; this basic beverage is not a prepared dish.
BASIC_BEVERAGES = {'1322'}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def load_sources():
    usda = read(RESEARCH / 'usda_foods.json')
    sources = [{'id': 'USDA-FDC', 'name': 'USDA FoodData Central (Foundation and SR Legacy)',
                'url': usda['source_url'], 'license': 'Public domain / CC0',
                'retrieved_at': usda['retrieved_at'], 'provenance': usda['provenance']}]
    foods = []
    for record in usda['records']:
        nutrients = dict(record['nutrients'])
        nutrients['fibre_g'] = nutrients.pop('fiber_g', None)
        nutrients.pop('energy_kj', None)
        foods.append({'id': f"USDA-{record['fdc_id']}", 'source': 'USDA-FDC',
                      'source_code': str(record['fdc_id']), 'description': record['description'],
                      'basis': 'per_100g', 'nutrients': nutrients, 'url': record['source_url'],
                      'data_type': record['data_type'], 'nutrient_provenance': record['nutrient_provenance']})
    for name in ('afcd_foods.json', 'myfcd_foods.json', 'fndds_foods.json'):
        path = RESEARCH / name
        if path.exists():
            doc = read(path)
            if name == 'fndds_foods.json':
                sources[0].setdefault('additional_imports', []).append({
                    'name': 'USDA FNDDS 2021-2023', 'url': doc['source_url'],
                    'provenance': doc['provenance'], 'retrieved_at': doc['retrieved_at']})
                for food in doc['foods']:
                    food = dict(food)
                    food['source_edition'] = food['source']
                    food['source'] = 'USDA-FDC'
                    food['nutrients'] = dict(food['nutrients'])
                    food['nutrients'].pop('energy_kj', None)
                    food.setdefault('url', food.get('source_url', doc['source_url']))
                    foods.append(food)
                continue
            if doc.get('provenance'):
                for source in doc['sources']:
                    source['provenance'] = doc['provenance']
            if name == 'myfcd_foods.json':
                source = dict(doc['sources'][0])
                source.update(id='MyFCD', name='Malaysian Food Composition Database (current and 1997 editions)',
                              editions=doc['sources'])
                sources.append(source)
                for food in doc['foods']:
                    food = dict(food)
                    food['source_edition'] = food['source']
                    food['source'] = 'MyFCD'
                    foods.append(food)
            else:
                for source in doc['sources']:
                    previous = next((s for s in sources if s['id'] == source['id']), None)
                    if previous:
                        previous.setdefault('additional_imports', []).append(source)
                    else:
                        sources.append(source)
                foods.extend(doc['foods'])
    return sources, {food['id']: food for food in foods}


def build(catalogue_path, mapping_paths):
    with catalogue_path.open(encoding='utf-8-sig', newline='') as handle:
        catalogue = list(csv.DictReader(handle))
    catalogue = [row for row in catalogue if row['item_name'].strip()]
    for row in catalogue:
        row['coverage_exclusion'] = ('nonfood' if row['item_category'] in NONFOOD else
                                     'prepared_food_deferred' if row['item_category'] in PREPARED and row['item_code'] not in BASIC_BEVERAGES else None)
        row['eligible'] = row['coverage_exclusion'] is None
    eligible = {row['item_code']: row for row in catalogue if row['eligible']}
    sources, foods = load_sources()
    mappings = []
    for path in mapping_paths:
        doc = read(path)
        mappings.extend(doc if isinstance(doc, list) else doc['mappings'])
    seen = set()
    for mapping in mappings:
        code = str(mapping['item_code'])
        assert code in eligible, f'Ineligible item {code}'
        assert code not in seen, f'Duplicate item mapping {code}'
        seen.add(code)
        food = foods[mapping['food_id']]
        assert food['basis'] in ('per_100g', 'per_100ml')
        assert all(type(food['nutrients'].get(key)) in (int, float) and math.isfinite(food['nutrients'][key]) and food['nutrients'][key] >= 0 for key in CORE), (code, food['id'])
        assert all(value is None or (type(value) in (int, float) and math.isfinite(value) and value >= 0)
                   for value in food['nutrients'].values()), (code, food['id'])
        assert mapping['status'] == 'approved' and mapping['match_type'] in ('generic', 'product')
        assert mapping['rationale'].strip()
        mapping['item_code'] = code
    selected_ids = {m['food_id'] for m in mappings}
    for mapping in mappings:
        main = foods[mapping['food_id']]
        for basis, key in mapping.get('basis_variants', {}).items():
            variant = foods[key]
            assert variant['basis'] == basis
            assert (variant['source'], variant['source_code']) == (main['source'], main['source_code'])
            assert all(type(variant['nutrients'].get(k)) in (int, float) and math.isfinite(variant['nutrients'][k]) and variant['nutrients'][k] >= 0 for k in CORE)
            selected_ids.add(key)
    selected = [foods[key] for key in sorted(selected_ids)]
    used = {food['source'] for food in selected}
    sources = [source for source in sources if source['id'] in used]
    assert len({source['id'] for source in sources}) < 5
    assert {source['id'] for source in sources} == used
    report = {
        'measured_at': '2026-10-09', 'target_percent': 80,
        'definition': 'Approved food/form reference with non-null energy, protein, fat and carbohydrate; generic references are disclosed estimates, not verified product labels.',
        'catalogue_source': 'Local SmartCart PostgreSQL item table, read-only export',
        'scope': 'Groceries and packaged foods; prepared dishes and made-to-order drinks deferred at user request.',
        'named_catalogue_items': len(catalogue),
        'total_food_items': sum(row['item_category'] not in NONFOOD for row in catalogue),
        'nonfood_items': sum(row['coverage_exclusion'] == 'nonfood' for row in catalogue),
        'deferred_prepared_food_items': sum(row['coverage_exclusion'] == 'prepared_food_deferred' for row in catalogue),
        'eligible_food_items': len(eligible), 'covered_food_items': len(seen),
        'coverage_percent': round(100 * len(seen) / len(eligible), 4),
        'source_count': len(used), 'match_types': dict(Counter(m['match_type'] for m in mappings)),
        'by_category': {category: {'total': sum(r['item_category'] == category for r in eligible.values()),
                                  'covered': sum(eligible[code]['item_category'] == category for code in seen)}
                        for category in sorted({r['item_category'] for r in eligible.values()})},
        'unmatched': [{'item_code': code, 'item_name': row['item_name'], 'category': row['item_category']}
                      for code, row in eligible.items() if code not in seen],
        'nutrient_completeness': {key: sum(foods[m['food_id']]['nutrients'].get(key) is not None for m in mappings)
                                  for key in ('energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g', 'fibre_g', 'sodium_mg', 'saturated_fat_g', 'calcium_mg')},
    }
    snapshot = {'retrieved_at': '2026-10-09', 'source': report['catalogue_source'],
                'excluded_categories': sorted(NONFOOD | PREPARED),
                'nonfood_categories': sorted(NONFOOD), 'deferred_prepared_categories': sorted(PREPARED),
                'basic_beverage_exceptions': sorted(BASIC_BEVERAGES),
                'items': catalogue}
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / 'catalogue_snapshot.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')
    snapshot_hash = hashlib.sha256((DATA / 'catalogue_snapshot.json').read_bytes()).hexdigest()
    report['catalogue_sha256'] = snapshot_hash
    result = {'schema_version': 1, 'generated_at': '2026-10-09', 'sources': sources,
              'foods': selected, 'mappings': sorted(mappings, key=lambda m: m['item_code']),
              'coverage': report}
    (DATA / 'item_nutrition.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    (DATA / 'coverage_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Covered {len(seen)}/{len(eligible)} food items ({report['coverage_percent']}%) using {len(used)} sources")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--catalogue', type=Path, default=ROOT / '.tmp/nutrition_active_catalogue.csv')
    parser.add_argument('--mappings', type=Path, nargs='+', default=[DATA / 'scripts/approved_item_mappings.json'])
    args = parser.parse_args()
    build(args.catalogue, args.mappings)
