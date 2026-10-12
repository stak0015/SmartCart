"""Follow item foreign keys without any runtime mapping file dependency."""
from contextlib import contextmanager
import pytest
from smartcart import item_nutrition, nutrition_repository as repository
from smartcart.errors import AppError


class Cursor:
    def __init__(self, result_sets):
        self.result_sets = iter(result_sets)
        self.queries = []
    def execute(self, query, params=None):
        self.queries.append((query, params))
        if not query.startswith('SET TRANSACTION'):
            self.rows = next(self.result_sets)
    def fetchall(self):
        return self.rows


def cursor_fixture(monkeypatch, result_sets):
    cursor = Cursor(result_sets)
    @contextmanager
    def connection():
        yield cursor
    monkeypatch.setattr(repository, 'database_cursor', connection)
    return cursor


def test_item_fk_sources_nulls_and_basis_variants_without_file(monkeypatch, tmp_path):
    source = {'id': 'source', 'name': 'Source', 'url': 'https://example.com', 'license': 'test'}
    food = {'id': 'mass', 'source': 'source', 'source_code': 'record', 'description': 'Milk',
        'basis': 'per_100g', 'nutrients': {'energy_kcal': 40, 'protein_g': 3, 'fat_g': 1,
        'carbohydrate_g': 5, 'sodium_mg': None}}
    volume = {**food, 'id': 'volume', 'basis': 'per_100ml'}
    mapping = {'item_code': '007', 'food_id': 'mass', 'status': 'approved',
        'match_type': 'generic', 'rationale': 'Reviewed', 'basis_variants': {'per_100ml': 'volume'}}
    monkeypatch.setattr(item_nutrition, 'DATA_PATH', tmp_path / 'does-not-exist.json')
    cursor = cursor_fixture(monkeypatch, [[(mapping,)], [(food, source), (volume, source)]])
    monkeypatch.setattr(item_nutrition, 'load_item_dataset', repository.load_item_dataset)
    result = item_nutrition.get_item_nutrition('007', basis='per_100ml')
    assert result['food']['id'] == 'volume'
    assert result['food']['nutrients']['sodium_mg'] is None
    assert result['source']['url'] == source['url']
    assert result['match_type'] == 'generic'
    assert cursor.queries[1][1] == ('007',)
    assert 'f.nutrition_id = i.nutrition_food_id' in cursor.queries[1][0]
    assert set(cursor.queries[-1][1][0]) == {'mass', 'volume'}


def test_database_failure_does_not_serve_snapshot(monkeypatch):
    def failed(item_code=None):
        raise AppError('DATABASE_NOT_CONFIGURED', 'Not configured', 503)
    monkeypatch.setattr(item_nutrition, 'load_item_dataset', failed)
    with pytest.raises(AppError):
        item_nutrition.get_item_nutrition('1')


def test_missing_database_mapping_does_not_use_snapshot(monkeypatch):
    monkeypatch.setattr(item_nutrition, 'load_item_dataset', lambda code=None: {'sources': [], 'foods': [], 'mappings': []})
    assert item_nutrition.get_item_nutrition('1')['available'] is False


def test_database_mapping_not_process_cached(monkeypatch):
    cursor = cursor_fixture(monkeypatch, [[], [], [('new',)], []])
    assert repository.load_item_dataset()['mappings'] == []
    cursor.result_sets = iter([[({'item_code': '1', 'food_id': 'new'},)], []])
    assert repository.load_item_dataset()['mappings'][0]['food_id'] == 'new'
    assert len([q for q,p in cursor.queries if 'FROM item i JOIN' in q]) == 2
