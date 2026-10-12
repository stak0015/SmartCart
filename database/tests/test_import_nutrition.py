"""Validate food records and reviewed item references before importing them."""
import json
import sys
from copy import deepcopy
from pathlib import Path
import pytest
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'database'))
from import_nutrition import FILES, read_snapshots


@pytest.fixture
def snapshots():
    return read_snapshots(ROOT / 'data/nutrition')[0]


def write_snapshots(tmp_path, snapshots):
    for key, filename in FILES.items():
        (tmp_path / filename).write_text(json.dumps(snapshots[key]), encoding='utf-8')
    return tmp_path


def test_preserves_differing_source_records_and_sparse_legacy_nutrients(snapshots):
    a = {r['id']: r for r in snapshots['items']['sources']}
    b = {r['id']: r for r in snapshots['foods']['sources']}
    assert any(a[k] != b[k] for k in a.keys() & b.keys())
    assert any(r['nutrients']['energy_kcal'] is None for r in snapshots['foods']['foods'])


def test_duplicate_food_rejected(tmp_path, snapshots):
    snapshots['items']['foods'].append(deepcopy(snapshots['items']['foods'][0]))
    with pytest.raises(ValueError, match='Duplicate nutrition identity'):
        read_snapshots(write_snapshots(tmp_path, snapshots))


def test_missing_source_rejected(tmp_path, snapshots):
    snapshots['items']['foods'][0]['source'] = 'missing'
    with pytest.raises(ValueError, match='source reference'):
        read_snapshots(write_snapshots(tmp_path, snapshots))


def test_mapping_basis_variant_must_match_publisher_record(tmp_path, snapshots):
    mapping = next(r for r in snapshots['items']['mappings'] if r.get('basis_variants'))
    food_id = next(iter(mapping['basis_variants'].values()))
    next(r for r in snapshots['items']['foods'] if r['id'] == food_id)['source_code'] = 'different-record'
    with pytest.raises(ValueError, match='Invalid basis variant'):
        read_snapshots(write_snapshots(tmp_path, snapshots))


def test_negative_and_nonfinite_nutrients_rejected(tmp_path, snapshots):
    for value in (-1, float('nan')):
        snapshots['items']['foods'][0]['nutrients']['energy_kcal'] = value
        with pytest.raises(ValueError, match='Invalid food'):
            read_snapshots(write_snapshots(tmp_path, snapshots))
