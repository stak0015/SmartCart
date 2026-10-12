"""Runtime alternative data must work without the repository's offline data."""
import json
from pathlib import Path
import shutil
import subprocess
import sys


def test_alternative_rules_and_policy_load_from_backend_only(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    shutil.copytree(backend / "smartcart", tmp_path / "smartcart", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copytree(backend / "data" / "nutrition", tmp_path / "data" / "nutrition")
    result = subprocess.run(
        [sys.executable, "-c", """
import json
from smartcart.nutrition import nutrition_dataset
from smartcart.nutrition_comparison import compare_category
original = {'basis': 'per_100g', 'nutrients': {'sugars_g': 10, 'energy_kcal': 40, 'sodium_mg': 0, 'fat_g': 0, 'saturated_fat_g': 0}}
alternative = {'basis': 'per_100g', 'nutrients': {'sugars_g': 0, 'energy_kcal': 0, 'sodium_mg': 0, 'fat_g': 0, 'saturated_fat_g': 0}}
decision, reason = compare_category('P3', original, alternative)
assert decision is not None, reason
dataset = nutrition_dataset()
print(json.dumps({'rules': len(dataset['rules']), 'mapped_items': len(dataset['by_item'])}))
"""],
        cwd=tmp_path, capture_output=True, text=True, check=True,
    )
    loaded = json.loads(result.stdout)
    assert loaded["rules"] > 0
    assert loaded["mapped_items"] > 0
