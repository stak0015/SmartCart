"""Read-only API parity check of single-table nutrition against import snapshots.

Owner: Shun
"""
import argparse
import json
import os
import sys
from pathlib import Path
from unittest.mock import patch
from dotenv import dotenv_values
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from smartcart import nutrition
from smartcart.item_nutrition import get_item_nutrition, load_item_nutrition
from import_nutrition import read_snapshots


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=ROOT / 'database/.env')
    args = parser.parse_args()
    values = dotenv_values(args.env_file) if args.env_file.exists() else {}
    url = os.getenv('DATABASE_URL_UNPOOLED') or os.getenv('DATABASE_URL') or values.get('DATABASE_URL_UNPOOLED') or values.get('DATABASE_URL')
    if not url:
        raise ValueError('Database URL is not configured')
    os.environ['DATABASE_URL'] = url
    documents, _ = read_snapshots(ROOT / 'data/nutrition')
    profiles = load_item_nutrition()
    checked = 0
    for mapping in documents['items']['mappings']:
        code = mapping['item_code']
        for basis in (None, *mapping.get('basis_variants', {})):
            if get_item_nutrition(code, dataset=profiles, basis=basis) != get_item_nutrition(code, dataset=documents['items'], basis=basis):
                raise ValueError(f'Item API parity mismatch: {code}, {basis}')
            checked += 1
    for code in (documents['items']['mappings'][0]['item_code'], '__unmapped__'):
        if get_item_nutrition(code) != get_item_nutrition(code, dataset=documents['items']):
            raise ValueError(f'Default item API parity mismatch: {code}')
    alternatives = nutrition.nutrition_dataset()
    codes = sorted({r['alternative_item_code'] for rows in alternatives['by_item'].values() for r in rows})
    catalogue = nutrition._catalogue_rows(codes)
    def outcomes(dataset):
        with patch.object(nutrition, 'load_item_nutrition', return_value=dataset), patch.object(nutrition, '_catalogue_rows', side_effect=lambda codes: {c: catalogue[c] for c in codes if c in catalogue}), patch.object(nutrition, 'catalogue_price_ranges', return_value={}):
            return {code: nutrition.healthier_alternatives(code).model_dump() for code in alternatives['by_item']}
    expected, actual = outcomes(documents['items']), outcomes(profiles)
    if actual != expected:
        raise ValueError('Healthier-alternative API parity mismatch')
    example = next((code for code, result in expected.items() if result['count']), None)
    if example and nutrition.healthier_alternatives(example).model_dump() != expected[example]:
        raise ValueError('Default healthier-alternative API parity mismatch')
    print(json.dumps({'status': 'runtime_parity_verified', 'profile_responses': checked,
        'alternative_item_responses': len(actual), 'served_alternatives': sum(r['count'] for r in actual.values())}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        detail = str(error) if isinstance(error, ValueError) else type(error).__name__
        print(f'Nutrition runtime verification failed: {detail}', file=sys.stderr)
        sys.exit(1)
