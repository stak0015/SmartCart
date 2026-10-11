"""Import nutrient records and embedded source provenance into one table.

Item references and mapping metadata are imported onto existing item rows.
Alternative rules and comparison policy stay in files/scripts.
Credentials come from the environment or an ignored dotenv file, not CLI args.
The import, prototype-table cleanup and exact parity check are transactional.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extras import Json, execute_values
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from smartcart.item_nutrition import _valid_food, _valid_source, _valid_nutrient

FILES = {'items': 'item_nutrition.json', 'foods': 'foods.json'}
REMOVED_TABLES = ('item_nutrition_basis_variant', 'nutrition_alternative_mapping',
    'item_nutrition_mapping', 'nutrition_alternative_rule', 'nutrition_comparison_policy',
    'nutrition_source', 'nutrition_dataset')


def unique(records):
    result = {}
    for record in records:
        if record['id'] in result:
            raise ValueError(f"Duplicate nutrition identity: {record['id']}")
        result[record['id']] = record
    return result


def read_snapshots(directory):
    documents, hashes = {}, {}
    for dataset, filename in FILES.items():
        raw = (directory / filename).read_bytes()
        documents[dataset] = json.loads(raw)
        hashes[dataset] = hashlib.sha256(raw).hexdigest()
        sources = unique(documents[dataset]['sources'])
        foods = unique(documents[dataset]['foods'])
        if not all(_valid_source(r) for r in sources.values()):
            raise ValueError(f'Invalid sources in {dataset}')
        for food in foods.values():
            valid = (_valid_food(food) if dataset == 'items' else
                all(isinstance(food.get(k), str) and food[k].strip() for k in ('id', 'source', 'source_code', 'description'))
                and food.get('basis') in ('per_100g', 'per_100ml')
                and isinstance(food.get('nutrients'), dict)
                and all(_valid_nutrient(v) for v in food['nutrients'].values()))
            if not valid or food['source'] not in sources:
                raise ValueError(f'Invalid food or source reference: {dataset}, {food.get("id")}')
        json.dumps(documents[dataset], allow_nan=False)
    foods = {r['id']: r for r in documents['items']['foods']}
    seen = set()
    for mapping in documents['items']['mappings']:
        code = mapping['item_code']
        if code in seen:
            raise ValueError(f'Duplicate item nutrition mapping: {code}')
        seen.add(code)
        food = foods[mapping['food_id']]
        if mapping['status'] not in ('approved', 'pending', 'rejected') or mapping['match_type'] not in ('generic', 'product') or not mapping['rationale'].strip():
            raise ValueError(f'Invalid mapping metadata: {code}')
        for basis, variant_id in mapping.get('basis_variants', {}).items():
            variant = foods[variant_id]
            if variant['basis'] != basis or (food['source'], food['source_code']) != (variant['source'], variant['source_code']):
                raise ValueError(f'Invalid basis variant: {code}')
    return documents, hashes


def import_snapshots(cursor, documents, hashes):
    cursor.execute((ROOT / 'database/migrations/001_nutrition.sql').read_text(encoding='utf-8'))
    cursor.execute((ROOT / 'database/migrations/002_item_nutrition.sql').read_text(encoding='utf-8'))
    codes = [r['item_code'] for r in documents['items']['mappings']]
    cursor.execute('SELECT item_code FROM item WHERE item_code = ANY(%s)', (codes,))
    missing = set(codes) - {r[0] for r in cursor.fetchall()}
    if missing:
        raise ValueError(f'Target catalogue is missing {len(missing)} mapped items')
    # Clear and repopulate mapping columns in this transaction. Upserts preserve
    # stable food keys, including across repeated imports.
    cursor.execute('UPDATE item SET nutrition_food_id = NULL, nutrition_mapping_metadata = NULL WHERE nutrition_food_id IS NOT NULL OR nutrition_mapping_metadata IS NOT NULL')
    rows = []
    for dataset, doc in documents.items():
        sources = {r['id']: r for r in doc['sources']}
        rows.extend((dataset, r['id'], r['source'], r['source_code'], r['description'],
            r['basis'], Json(r['nutrients']), Json(sources[r['source']]), Json(r), hashes[dataset])
            for r in doc['foods'])
    if rows:
        execute_values(cursor, """INSERT INTO nutrition_food
            (dataset, food_id, source_id, source_record_code, description, basis,
             nutrients, source_metadata, document, snapshot_sha256) VALUES %s
             ON CONFLICT (dataset, food_id) DO UPDATE SET source_id = EXCLUDED.source_id,
             source_record_code = EXCLUDED.source_record_code, description = EXCLUDED.description,
             basis = EXCLUDED.basis, nutrients = EXCLUDED.nutrients,
             source_metadata = EXCLUDED.source_metadata, document = EXCLUDED.document,
             snapshot_sha256 = EXCLUDED.snapshot_sha256, imported_at = CURRENT_TIMESTAMP""", rows)
    for dataset, doc in documents.items():
        cursor.execute('DELETE FROM nutrition_food WHERE dataset = %s AND NOT (food_id = ANY(%s))',
                       (dataset, [r['id'] for r in doc['foods']]))
    mapping_rows = [(r['item_code'], r['food_id'], Json({k: v for k, v in r.items() if k not in ('item_code', 'food_id')}))
                    for r in documents['items']['mappings']]
    if mapping_rows:
        execute_values(cursor, """UPDATE item i SET nutrition_food_id = f.nutrition_id,
            nutrition_mapping_metadata = v.metadata::jsonb
            FROM (VALUES %s) AS v(item_code, food_id, metadata), nutrition_food f
            WHERE i.item_code = v.item_code AND f.dataset = 'items' AND f.food_id = v.food_id""", mapping_rows)


def verify_snapshots(cursor, documents, hashes):
    cursor.execute("""SELECT dataset, food_id, source_id, source_record_code, description,
        basis, nutrients, source_metadata, document, snapshot_sha256 FROM nutrition_food""")
    actual = {(r[0], r[1]): tuple(r[2:]) for r in cursor.fetchall()}
    expected = {}
    for dataset, doc in documents.items():
        sources = {r['id']: r for r in doc['sources']}
        expected.update({(dataset, r['id']): (r['source'], r['source_code'], r['description'],
            r['basis'], r['nutrients'], sources[r['source']], r, hashes[dataset]) for r in doc['foods']})
    if actual != expected:
        raise ValueError('Food/nutrient/provenance parity mismatch')
    cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY(%s)", (list(REMOVED_TABLES),))
    if cursor.fetchall():
        raise ValueError('Unexpected prototype nutrition tables remain')
    cursor.execute("""SELECT i.item_code, f.food_id, i.nutrition_mapping_metadata
        FROM item i LEFT JOIN nutrition_food f ON f.nutrition_id = i.nutrition_food_id
        WHERE i.nutrition_food_id IS NOT NULL OR i.nutrition_mapping_metadata IS NOT NULL""")
    if {r[0]: (r[1], r[2]) for r in cursor.fetchall()} != {
            r['item_code']: (r['food_id'], {k: v for k, v in r.items() if k not in ('item_code', 'food_id')})
            for r in documents['items']['mappings']}:
        raise ValueError('Item nutrition reference/metadata parity mismatch')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=ROOT / 'data/nutrition')
    parser.add_argument('--env-file', type=Path, default=ROOT / 'database/.env')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    values = dotenv_values(args.env_file) if args.env_file.exists() else {}
    url = os.getenv('DATABASE_URL_UNPOOLED') or os.getenv('DATABASE_URL') or values.get('DATABASE_URL_UNPOOLED') or values.get('DATABASE_URL')
    if not url:
        raise ValueError('Set DATABASE_URL_UNPOOLED or DATABASE_URL in the environment or ignored dotenv file')
    documents, hashes = read_snapshots(args.data_dir)
    connection = psycopg2.connect(url, connect_timeout=10)
    try:
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL lock_timeout = '10s'")
                cursor.execute("SET LOCAL statement_timeout = '60s'")
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext('smartcart_nutrition_import'))")
                if not args.verify_only:
                    import_snapshots(cursor, documents, hashes)
                verify_snapshots(cursor, documents, hashes)
        print(json.dumps({'status': 'verified' if args.verify_only else 'imported_and_verified',
            'nutrition_tables': ['nutrition_food'], 'item_foods': len(documents['items']['foods']),
            'reference_foods': len(documents['foods']['foods']),
            'mapped_items': len(documents['items']['mappings'])}))
    finally:
        connection.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        detail = str(error) if isinstance(error, (ValueError, KeyError)) else type(error).__name__
        print(f'Nutrition import failed; no import committed: {detail}', file=sys.stderr)
        sys.exit(1)
