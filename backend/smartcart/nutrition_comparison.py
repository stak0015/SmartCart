"""Transparent category comparison of approved substitutes, not a health score."""
import json
from pathlib import Path

POLICY_PATH = Path(__file__).resolve().parents[2] / 'data/nutrition/comparison_policy.json'


def compare_category(rule_id, original, alternative, policy=None):
    policy = policy or json.loads(POLICY_PATH.read_text(encoding='utf-8'))
    category = next((name for name, profile in policy['categories'].items() if rule_id in profile['rules']), None)
    if category is None:
        return None, 'no_category_policy'
    profile = policy['categories'][category]
    if not profile.get('enabled', True):
        return None, 'preparation_not_comparable'
    if original['basis'] != alternative['basis']:
        return None, 'incompatible_basis'
    left, right = original['nutrients'], alternative['nutrients']
    available = lambda key: left.get(key) is not None and right.get(key) is not None
    if any(not available(key) for key in profile['required']):
        return None, 'missing_required_nutrients'

    def meaningful(key, worsening=False):
        if not available(key):
            return False
        spec = policy['nutrients'][key]
        delta = (right[key] - left[key]) if spec['direction'] == 'higher_is_better' else (left[key] - right[key])
        if worsening:
            delta = -delta
        relative = policy['relative_worsening' if worsening else 'relative_improvement']
        # Absolute floors prevent near-zero percentages producing trivial claims.
        return delta >= spec['absolute_delta'] and delta >= abs(left[key]) * relative

    if any(meaningful(key, worsening=True) for key in profile['guards']):
        return None, 'material_tradeoff'
    primary = next((key for key in profile['priorities'] if meaningful(key)), None)
    if primary is None:
        return None, 'no_meaningful_improvement'
    return {'category': category, 'nutrient': primary,
            'direction': policy['nutrients'][primary]['direction'],
            'missing_guard_nutrients': [key for key in profile['guards'] if not available(key)]}, None
