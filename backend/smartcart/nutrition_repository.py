"""Read nutrient values and embedded publisher provenance from PostgreSQL.

Item mappings live on item rows; alternative rules/policy remain in files.
No database failure is silently replaced with older file-based values.
"""
from .database import database_cursor


def load_nutrition_records(food_ids=None):
    """Fetch current item profiles, optionally restricted to mapped food IDs."""
    with database_cursor() as cursor:
        cursor.execute("""SELECT document || jsonb_build_object(
            'id', food_id, 'source', source_id, 'source_code', source_record_code,
            'description', description, 'basis', basis, 'nutrients', nutrients),
            source_metadata
            FROM nutrition_food WHERE dataset = 'items'"""
            + ("" if food_ids is None else " AND food_id = ANY(%s)") + " ORDER BY food_id",
            None if food_ids is None else (list(food_ids),))
        foods, sources = [], {}
        for food, source in cursor.fetchall():
            foods.append(food)
            sources[source['id']] = source
    return {'sources': list(sources.values()), 'foods': foods}


def load_item_dataset(item_code=None):
    """Follow item.nutrition_food_id; never open mapping snapshot files."""
    with database_cursor() as cursor:
        cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        cursor.execute("""SELECT i.nutrition_mapping_metadata || jsonb_build_object(
            'item_code', i.item_code, 'food_id', f.food_id)
            FROM item i JOIN nutrition_food f ON f.nutrition_id = i.nutrition_food_id
            WHERE f.dataset = 'items' AND i.nutrition_mapping_metadata IS NOT NULL"""
            + ("" if item_code is None else " AND i.item_code = %s") + " ORDER BY i.item_code",
            None if item_code is None else (item_code,))
        mappings = [r[0] for r in cursor.fetchall()]
        food_ids = {r['food_id'] for r in mappings}
        for mapping in mappings:
            variants = mapping.get('basis_variants', {})
            if isinstance(variants, dict):
                food_ids.update(variants.values())
        cursor.execute("""SELECT document || jsonb_build_object(
            'id', food_id, 'source', source_id, 'source_code', source_record_code,
            'description', description, 'basis', basis, 'nutrients', nutrients), source_metadata
            FROM nutrition_food WHERE dataset = 'items' AND food_id = ANY(%s) ORDER BY food_id""",
            (list(food_ids),))
        foods, sources = [], {}
        for food, source in cursor.fetchall():
            foods.append(food)
            sources[source['id']] = source
    return {'sources': list(sources.values()), 'foods': foods, 'mappings': mappings}
