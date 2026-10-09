"""Import the official AFCD Release 3 workbook without filling missing values."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import pandas as pd
import requests

URL = 'https://www.foodstandards.gov.au/sites/default/files/2025-12/AFCD%20Release%203%20-%20Nutrient%20profiles.xlsx'
SOURCE = {
    'id': 'AFCD', 'name': 'Australian Food Composition Database, Release 3',
    'url': 'https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files',
    'license': 'FSANZ published reference data; see publisher copyright and attribution conditions.',
    'retrieved_at': '2026-10-09',
}


def number(value):
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return None


def run(path, output):
    fields = {
        'energy_kcal': 'Energy with dietary fibre, equated',
        'protein_g': 'Protein ', 'fat_g': 'Fat, total ',
        'carbohydrate_g': 'Available carbohydrate, without sugar alcohols',
        'fibre_g': 'Total dietary fibre ', 'sodium_mg': 'Sodium (Na)',
        'calcium_mg': 'Calcium (Ca)',
        'saturated_fat_g': 'Total saturated fatty acids, equated \n(g)',
        'monounsaturated_fat_g': 'Total monounsaturated fatty acids, equated \n(g)',
        'polyunsaturated_fat_g': 'Total polyunsaturated fatty acids, equated \n(g)',
        'sugars_g': 'Total sugars (g)',
    }
    foods = []
    for sheet, basis in [('All solids & liquids per 100 g', 'per_100g'), ('Liquids only per 100 mL', 'per_100ml')]:
        table = pd.read_excel(path, sheet_name=sheet, header=2)
        columns = {key: next(c for c in table.columns if str(c).startswith(prefix)) for key, prefix in fields.items()}
        for _, row in table.iterrows():
            code = row['Public Food Key']
            if not isinstance(code, str) or not code.startswith('F'):
                continue
            values = {key: number(row[column]) for key, column in columns.items()}
            if values['energy_kcal'] is not None:
                values['energy_kcal'] = round(values['energy_kcal'] / 4.184, 4)
            foods.append({'id': f'AFCD-{code}-{basis}', 'source': 'AFCD', 'source_code': code,
                          'description': row['Food Name'], 'basis': basis, 'nutrients': values,
                          'derivation': row['Derivation'], 'url': f'https://afcd.foodstandards.gov.au/fooddetails.aspx?PFKID={code}',
                          'carbohydrate_definition': 'available carbohydrate, excluding sugar alcohols',
                          'energy_conversion': 'publisher kJ divided by 4.184'})
    SOURCE['download_url'] = URL
    SOURCE['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    output.write_text(json.dumps({'sources': [SOURCE], 'foods': foods}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Imported {len(foods)} AFCD profiles')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true', help='refresh the official AFCD workbook')
    parser.add_argument('--workbook', type=Path, default=Path('research/nutrition_coverage/raw/afcd_nutrients.xlsx'))
    parser.add_argument('--output', type=Path, default=Path('research/nutrition_coverage/afcd_foods.json'))
    args = parser.parse_args()
    args.workbook.parent.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.download or not args.workbook.exists():
        response = requests.get(URL, timeout=60)
        response.raise_for_status()
        args.workbook.write_bytes(response.content)
    run(args.workbook, args.output)
