"""Bounded snapshot serving. No request-time model fitting or raw-data scan."""
from copy import deepcopy
from datetime import datetime
from functools import lru_cache
import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo
from .forecast_rules import eligibility
from .errors import AppError

@lru_cache(maxsize=1)
def load_snapshot():
    path = Path(os.environ.get('SMARTCART_FORECAST_PATH', Path(__file__).resolve().parents[1]/'data/price_forecasts.json'))
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise AppError('HISTORY_UNAVAILABLE', 'Price history is temporarily unavailable.', 503) from error

def item_history(item_code, region=None):
    snapshot = load_snapshot()
    records = [r for r in snapshot['records'] if r['item_code'] == item_code and r['region_id'] == 'national::']
    base = {k: snapshot[k] for k in ('generated_at','data_cutoff','source','aggregation')}
    base['regions'] = [dict(id=r['region_id'],label=r['region'],status=r['status']) for r in records]
    if not records:
        return dict(**base, status='not_evaluated', reasons=['This item has not yet been included in the national history snapshot.'], history=[],forecast=[],region=None,region_id=None)
    selected = region or 'national::'
    record = next((r for r in records if r['region_id'] == selected), None)
    if record is None:
        raise AppError('INVALID_PRICE_REGION', 'Choose one of the available price regions.', 400)
    result = deepcopy(record)
    if result['status'] == 'available':
        status, reasons = eligibility(result['coverage'],result['latest_observation'],datetime.now(ZoneInfo('Asia/Kuala_Lumpur')).date(),
            snapshot.get('quality_policy',{}).get('rules',{}))
        if status != 'available':
            result.update(status=status,reasons=reasons,forecast=[])
    return dict(**base, **result)
