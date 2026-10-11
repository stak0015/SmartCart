"""Explain every curated recommendation's outcome against shared nutrition."""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'backend'))
from smartcart.item_nutrition import get_item_nutrition
from smartcart.nutrition_comparison import compare_category


def audit():
    data = ROOT / 'data/nutrition'
    catalogue = {r['item_code']: r for r in json.loads((data / 'catalogue_snapshot.json').read_text())['items']}
    mappings = json.loads((data / 'mappings.json').read_text())['mappings']
    records = []
    for mapping in mappings:
        if not mapping.get('approved'):
            continue
        code, target = mapping['original_item_code'], mapping['alternative_item_code']
        original = get_item_nutrition(code)
        alternative = get_item_nutrition(target, basis=original['food']['basis']) if original['available'] else get_item_nutrition(target)
        reason = ('inactive_catalogue_item' if code not in catalogue or target not in catalogue else
                  'missing_original_profile' if not original['available'] else
                  'missing_alternative_profile' if not alternative['available'] else None)
        decision = None
        if reason is None:
            decision, reason = compare_category(mapping['rule'], original['food'], alternative['food'])
        records.append({'item_code': code, 'item_name': catalogue.get(code, {}).get('item_name'),
                        'alternative_item_code': target, 'rule': mapping['rule'],
                        'status': 'available' if decision else 'suppressed', 'reason': reason,
                        'decision': decision})
    result = {'policy_version': 1, 'evaluated_pairs': len(records),
              'available_pairs': sum(r['status'] == 'available' for r in records),
              'outcomes': dict(Counter(r['reason'] or 'available' for r in records)), 'pairs': records}
    (data / 'recommendation_audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'pairs'}))


if __name__ == '__main__':
    audit()
