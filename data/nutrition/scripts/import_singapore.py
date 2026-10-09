"""Fetch reviewed SG FoodID records from Singapore HPB's public API.

The SG FoodID site is a JavaScript application.  Its public bundle exposes
the API used by the food search and details pages; this importer records the
raw responses and converts only the publisher's base nutrient values.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import time
from pathlib import Path
from urllib.parse import quote

import requests

API_BASE = 'https://pphtpc.hpb.gov.sg/bff/v1/food-portal'
SITE_BASE = 'https://pphtpc.hpb.gov.sg/web/sgfoodid'


def _research_root():
    """Return research/nutrition_coverage when run from a tracked copy."""
    script_dir = Path(__file__).resolve().parent
    for candidate in (script_dir, *script_dir.parents):
        research = candidate / 'research' / 'nutrition_coverage'
        if research.is_dir():
            return research
    return script_dir


ROOT = _research_root()
RAW_DIR = ROOT / 'raw'
DEFAULT_TERMS = [
    'coffee', 'tea', 'milo', 'malted', 'chocolate', 'juice', 'cordial',
    'soft drink', 'water', 'rice', 'noodle', 'mee', 'bihun', 'kuey',
    'soup', 'chicken', 'beef', 'mutton', 'pork', 'fish', 'prawn', 'squid',
    'vegetable', 'curry', 'roti', 'bread', 'naan', 'egg', 'pau', 'murtabak',
    'briyani', 'nasi', 'tom yam', 'satay', 'banana',
]

SOURCE = {
    'id': 'SG-HPB',
    'name': 'Singapore Health Promotion Board Singapore Food Insights Database (SG FoodID)',
    'url': 'https://www.healthhub.sg/programmes/nutrition-hub/tools-and-resources/',
    'api_url': API_BASE,
    'license': 'Official public search API; retain HPB attribution and terms of use.',
}


def get_json(session, path, params=None):
    # The public gateway returns 429 after a short burst.  Retry only a
    # bounded number of times so a refresh cannot run indefinitely.
    for attempt in range(4):
        response = session.get(f'{API_BASE}/{path}', params=params, timeout=60)
        if response.status_code != 429:
            response.raise_for_status()
            return response.json()
        if attempt == 3:
            response.raise_for_status()
        retry_after = response.headers.get('Retry-After')
        try:
            delay = max(10.0, float(retry_after)) if retry_after else 15.0 * (attempt + 1)
        except ValueError:
            delay = 15.0 * (attempt + 1)
        time.sleep(delay)


def search(session, term):
    page = 1
    found = []
    while True:
        rows = get_json(session, 'foods', {'searchText': term, 'pageNumber': page})
        if not rows:
            break
        found.extend(rows)
        if len(found) >= int(rows[0].get('totalCount', len(found))):
            break
        page += 1
    return found


def number(value):
    # SG FoodID uses -1 as a missing-value sentinel for nutrients that were
    # not reported.  Preserve real zeroes but never expose that sentinel as
    # nutrition data.
    if isinstance(value, (int, float)) and math.isfinite(value) and value >= 0:
        return float(value)
    return None


def normalize(detail):
    category = detail.get('category')
    # SG FoodID labels its nutrient table "Per 100g" for both foods and
    # drinks, defined as per 100 g edible portion.  Drink portion metadata may
    # be expressed in ml (for example, "1 regular cup = 250ml"), but that is
    # the serving-size description and does not change the reported base.
    basis = 'per_100g'
    raw = detail.get('baseFoodNutrients') or {}
    nutrients = {
        'energy_kcal': number(raw.get('energy')),
        'protein_g': number(raw.get('protein')),
        'fat_g': number(raw.get('fat')),
        'carbohydrate_g': number(raw.get('carbohydrate')),
        'fibre_g': number(raw.get('dietaryFibre')),
        'sodium_mg': number(raw.get('sodium')),
        'calcium_mg': number(raw.get('calcium')),
        'iron_mg': number(raw.get('iron')),
        'sugars_g': number(raw.get('sugar')),
        'saturated_fat_g': number(raw.get('saturatedFat')),
        'monounsaturated_fat_g': number(raw.get('monounsaturatedFat')),
        'polyunsaturated_fat_g': number(raw.get('polyunsaturatedFat')),
    }
    code = detail['crId']
    return {
        'id': f'SG-HPB-{code}-{basis}',
        'source': 'SG-HPB',
        'source_code': code,
        'description': detail.get('name') or detail.get('description') or code,
        'detail': detail.get('description'),
        'basis': basis,
        'nutrients': nutrients,
        'url': f'{SITE_BASE}/tools/food-search/details/{quote(code)}',
        'source_of_data': detail.get('sourceOfData'),
        'year_of_data': detail.get('yearOfData'),
        'default_portion': detail.get('defaultPortion'),
        'category': category,
        'food_group': detail.get('l1Category'),
        'food_subgroup': detail.get('l2Category'),
        'edible_portion_percent': detail.get('ediblePortion'),
    }


def run(output, terms, refresh=False, ids=None):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    index = {}
    if ids:
        # Selected mode is used for the reviewed mapping set.  It avoids
        # repeatedly downloading the entire search catalogue and keeps the
        # public gateway below its rate limit.
        index = {code: {'crId': code} for code in ids}
    else:
        for term in terms:
            cache = RAW_DIR / f'sgfoodid_search_{quote(term, safe="")}.json'
            if cache.exists() and not refresh:
                rows = json.loads(cache.read_text(encoding='utf-8'))
            else:
                rows = search(session, term)
                cache.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
            for row in rows:
                index[row['crId']] = row

    foods = []
    details = []
    for code in sorted(index):
        cache = RAW_DIR / f'sgfoodid_detail_{code}.json'
        if cache.exists() and not refresh:
            detail = json.loads(cache.read_text(encoding='utf-8'))
        else:
            detail = get_json(session, f'foods/details/{quote(code)}')
            cache.write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding='utf-8')
            # Be polite to the public API even when it does not return 429.
            time.sleep(0.75)
        details.append(detail)
        food = normalize(detail)
        core = ('energy_kcal', 'protein_g', 'fat_g', 'carbohydrate_g')
        if all(isinstance(food['nutrients'].get(k), (int, float)) for k in core):
            foods.append(food)

    retrieved = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    source = {**SOURCE, 'retrieved_at': retrieved,
              'search_terms': [] if ids else list(terms),
              'selected_ids': sorted(index) if ids else None,
              'record_count': len(foods)}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'sources': [source], 'foods': foods}, ensure_ascii=False, indent=2), encoding='utf-8')
    (RAW_DIR / 'sgfoodid_discovered_index.json').write_text(
        json.dumps({'retrieved_at': retrieved, 'search_terms': list(terms), 'records': list(index.values())}, ensure_ascii=False, indent=2),
        encoding='utf-8')
    print(f'Imported {len(foods)} complete SG FoodID profiles from {len(index)} search results')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'singapore_foods.json')
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--terms', nargs='*', default=DEFAULT_TERMS)
    parser.add_argument('--ids', nargs='*', help='Only import these SG FoodID crIds (skip broad search discovery)')
    args = parser.parse_args()
    run(args.output, args.terms, args.refresh, args.ids)
