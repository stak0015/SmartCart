"""Reapply eligibility to saved model paths without fitting or changing history."""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from smartcart.forecast_rules import DEFAULT_RULES, eligibility


def requalify(source, paths_file, as_of):
    snapshot = json.loads(source.read_text(encoding='utf-8'))
    if snapshot['model_policy']['name'] != 'chronos_2_small_ridge':
        raise ValueError('Cached paths must belong to the serving shared short model.')
    paths = {}
    with paths_file.open(encoding='utf-8', newline='') as file:
        for row in csv.DictReader(file):
            code, horizon = str(int(row['item_code'])), int(row['horizon'])
            item_paths = paths.setdefault(code, {})
            if horizon in item_paths:
                raise ValueError(f'Duplicate horizon for item {code}')
            item_paths[horizon] = float(row['predicted'])
    rules = {**snapshot['quality_policy']['rules'], **DEFAULT_RULES}
    for record in snapshot['records']:
        status, reasons = eligibility(record['coverage'], record['latest_observation'], as_of, rules)
        forecast = []
        if status == 'available':
            saved = paths[record['item_code']]
            if set(saved) != set(range(1, 53)) or not all(math.isfinite(p) and p > 0 for p in saved.values()):
                raise ValueError(f'Incomplete or invalid model path for item {record["item_code"]}')
            start = date.fromisoformat(record['history'][-1]['week'])
            forecast = [dict(week=(start + timedelta(weeks=h)).isoformat(), price=saved[h]) for h in range(1, 53)]
            if not all(p['week'] > snapshot['data_cutoff'] for p in forecast):
                raise ValueError('Cached forecast does not follow the data cutoff.')
            if record['forecast'] and (len(record['forecast']) != 52 or any(
                old['week'] != new['week'] or not math.isclose(old['price'], new['price'], rel_tol=0, abs_tol=1e-9)
                for old, new in zip(record['forecast'], forecast)
            )):
                raise ValueError('Cached paths differ from previously served forecasts.')
        record.update(status=status, reasons=reasons, forecast=forecast)
    snapshot['quality_policy'].update(rules=rules, assessed_at=as_of.isoformat())
    snapshot['quality_policy']['requalification'] = dict(
        model_refitted=False, paths_sha256=hashlib.sha256(paths_file.read_bytes()).hexdigest())
    temporary = source.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(snapshot, separators=(',', ':')), encoding='utf-8')
    temporary.replace(source)
    return dict(Counter(r['status'] for r in snapshot['records']))


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=root / 'backend/data/price_forecasts.json')
    parser.add_argument('--paths', type=Path, default=root / 'research/price_forecasting/unified_results/current_shared_short_head_paths.csv')
    parser.add_argument('--as-of', type=date.fromisoformat, default=datetime.now(ZoneInfo('Asia/Kuala_Lumpur')).date())
    args = parser.parse_args()
    print(json.dumps(requalify(args.source, args.paths, args.as_of)))
