"""Read-only export of the app catalogue for nutrition coverage measurement."""
import csv
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]


def main():
    load_dotenv(ROOT / 'backend/.env')
    load_dotenv(ROOT / 'database/.env')
    translations = {}
    with (ROOT / 'database/data/item_name_en.csv').open(encoding='utf-8-sig', newline='') as stream:
        translations = {row['item_code']: row['item_name_en'] for row in csv.DictReader(stream)}
    with psycopg2.connect(os.environ['DATABASE_URL'], connect_timeout=10) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT item_code, item_name, unit, item_category FROM item ORDER BY item_code')
            rows = cursor.fetchall()
    output = ROOT / '.tmp/nutrition_active_catalogue.csv'
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['item_code', 'item_name', 'unit', 'item_category', 'item_name_en'])
        writer.writeheader()
        for code, name, unit, category in rows:
            writer.writerow({'item_code': str(code), 'item_name': name or '', 'unit': unit or '',
                             'item_category': category or '', 'item_name_en': translations.get(str(code), '')})
    print(f'Exported {len(rows)} item-table rows to {output.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
