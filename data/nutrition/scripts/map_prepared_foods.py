"""Materialize reviewed prepared-food references; no fuzzy auto-approval."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RESEARCH = ROOT / 'research/nutrition_coverage'
RULES = Path(__file__).with_name('prepared_rules.json')


def main():
    rules = json.loads(RULES.read_text(encoding='utf-8'))
    mappings = []
    for rule in rules:
        for code in rule['item_codes']:
            mappings.append({'item_code': code, 'food_id': rule['food_id'],
                             'match_type': 'generic', 'status': 'approved',
                             'rationale': rule['rationale']})
    (RESEARCH / 'prepared_mappings.json').write_text(json.dumps(mappings, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Prepared food mappings: {len(mappings)}')


if __name__ == '__main__':
    main()
