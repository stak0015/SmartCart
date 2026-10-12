"""Refresh national histories and rolling-tested forecasts from official data.

Run offline in the weekly job. No dates are relabelled to make old data fresh.
"""
import argparse
from collections import Counter
from copy import deepcopy
from datetime import date, datetime, timedelta
import hashlib
import json
import math
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from smartcart.forecast_rules import DEFAULT_RULES, eligibility

BASE_URL = 'https://storage.data.gov.my/pricecatcher/'
HORIZONS = (4, 8, 12)


def month_names(start, end):
    current = date(start.year, start.month, 1)
    names = []
    while current <= end:
        names.append(f'pricecatcher_{current:%Y-%m}.parquet')
        current = date(current.year + (current.month == 12), current.month % 12 + 1, 1)
    return names


def download(name, directory):
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    temporary = path.with_suffix('.download')
    try:
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        session = requests.Session()
        session.mount('https://', HTTPAdapter(max_retries=Retry(total=3, backoff_factor=2,
            status_forcelist=(429,500,502,503,504), allowed_methods=('GET',))))
        with session, session.get(BASE_URL + name, stream=True, timeout=(15, 120)) as response:
            response.raise_for_status()
            with temporary.open('wb') as file:
                for chunk in response.iter_content(1024 * 1024):
                    file.write(chunk)
        # Validate before replacing an earlier download.
        pd.read_parquet(temporary, engine='fastparquet')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def source_frames(directory, names, item_codes, premise_codes, as_of):
    """Reject invalid values and count records without inventing lookup entries."""
    frames, sources = [], []
    counts = Counter()
    for name in names:
        path = directory / name
        frame = pd.read_parquet(path, engine='fastparquet')
        required = ['date', 'item_code', 'premise_code', 'price']
        if not set(required) <= set(frame):
            raise ValueError(f'{name}: missing required PriceCatcher columns')
        frame = frame[required].copy()
        counts['source_rows'] += len(frame)
        frame['date'] = pd.to_datetime(frame.date, errors='coerce')
        for column in ['price', 'item_code', 'premise_code']:
            frame[column] = pd.to_numeric(frame[column], errors='coerce')
        valid = (frame.date.notna() & (frame.date <= pd.Timestamp(as_of))
                 & np.isfinite(frame.price) & (frame.price > 0)
                 & frame.item_code.isin(item_codes) & frame.premise_code.isin(premise_codes))
        counts['skipped_rows'] += int((~valid).sum())
        frame = frame[valid]
        frames.append(frame)
        sources.append({'file': name, 'url': BASE_URL + name,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'accepted_rows': len(frame)})
    if not frames or not any(len(f) for f in frames):
        raise ValueError('No valid official observations to refresh')
    return pd.concat(frames, ignore_index=True), sources, dict(counts)


def update_histories(snapshot, frame, lookup, as_of):
    """Recompute complete recent weeks, including weeks spanning month boundaries."""
    if not len(frame):
        raise ValueError('No source observations')
    latest = pd.Timestamp(frame.date.max()).date()
    # Sunday is complete; otherwise exclude the partial Monday-Sunday week.
    complete_end = latest - timedelta(days=(latest.weekday() + 1) % 7)
    cutoff = date.fromisoformat(snapshot['data_cutoff'])
    if complete_end <= cutoff:
        raise ValueError(f'No newer complete week: latest complete source date {complete_end}, snapshot cutoff {cutoff}')
    if (as_of - complete_end).days > DEFAULT_RULES['max_age_days']:
        raise ValueError('Newest complete source week is already stale')
    start = frame.date.min().date()
    # The first source month may begin midweek. Preserve that boundary week
    # from the prior snapshot rather than manufacture an incomplete median.
    replace_from = start + timedelta(days=(-start.weekday()) % 7)
    frame = frame[(frame.date >= pd.Timestamp(replace_from)) & (frame.date <= pd.Timestamp(complete_end))].copy()
    frame['week'] = frame.date.dt.normalize() - pd.to_timedelta(frame.date.dt.dayofweek, unit='D')
    stores = frame.groupby(['item_code', 'premise_code', 'week']).agg(
        price=('price', 'median'), observations=('price', 'size'), latest=('date', 'max')).reset_index()
    national = stores.groupby(['item_code', 'week']).agg(
        price=('price', 'median'), stores=('premise_code', 'nunique'),
        observations=('observations', 'sum'), latest=('latest', 'max')).reset_index()
    stores = stores.sort_values(['item_code', 'premise_code', 'week'])
    grouped = stores.groupby(['item_code', 'premise_code'])
    adjacent = grouped.week.diff().dt.days == 7
    stores['paired_delta'] = grouped.price.diff().where(adjacent)
    paired = stores.groupby(['item_code', 'week']).paired_delta.median()
    prior = {r['item_code']: r for r in snapshot['records'] if r['region_id'] == 'national::'}
    first_week = min(h['week'] for r in prior.values() for h in r['history'])
    calendar = pd.date_range(first_week, complete_end, freq='W-MON')
    records = []
    for row in lookup.itertuples(index=False):
        code = str(int(row.item_code))
        old = prior.get(code, {})
        record = deepcopy(old)
        record.update(item_code=code, item=str(row.item), unit=str(row.unit),
                      region_id='national::', region='Malaysia (national)', scope='national')
        existing = {h['week']: h for h in old.get('history', [])}
        recent = national[national.item_code == int(code)].set_index('week')
        history = []
        for week in calendar:
            key = week.date().isoformat()
            if week.date() < replace_from:
                history.append(deepcopy(existing.get(key, {'week': key, 'price': None, 'stores': 0, 'observations': 0})))
            elif week in recent.index:
                value = recent.loc[week]
                history.append({'week': key, 'price': round(float(value.price), 4),
                                'stores': int(value.stores), 'observations': int(value.observations)})
            else:
                history.append({'week': key, 'price': None, 'stores': 0, 'observations': 0})
        current_latest = recent.latest.max() if len(recent) else pd.NaT
        previous_latest = old.get('latest_observation')
        latest_observation = current_latest.date().isoformat() if pd.notna(current_latest) else (
            previous_latest if previous_latest and previous_latest < replace_from.isoformat() else None)
        observed = np.array([h['price'] if h['price'] is not None else np.nan for h in history])
        # Audit the actual recent store panel; retained historic diagnostics
        # are not silently reused as current composition evidence.
        recent_series = recent.price.reindex(calendar[-12:])
        item_paired = paired.loc[int(code)] if int(code) in paired.index.get_level_values(0) else pd.Series(dtype=float)
        shifts = (recent_series.diff() - item_paired.reindex(recent_series.index)).abs()
        distortion = shifts.median() if shifts.notna().sum() >= 9 else float('nan')
        coverage = {'history_weeks': int(np.isfinite(observed).sum()),
                    'missing_weeks': int((~np.isfinite(observed)).sum()),
                    'observations': sum(h['observations'] for h in history),
                    'recent_coverage': float(np.isfinite(observed[-12:]).mean()),
                    'recent_stores': float(np.median([h['stores'] for h in history[-12:]])),
                    'composition_shift_rm': float(distortion) if pd.notna(distortion) else None,
                    'definition_consistent': ('PELBAGAI' not in str(row.item).upper()
                        and (not old or (str(old.get('item','')).strip()==str(row.item).strip()
                            and str(old.get('unit','')).strip()==str(row.unit).strip()))),
                    'test_paths': 0, 'test_complete_paths': 0, 'test_relative_mae': None,
                    'test_baseline_mae_ratio': None,
                    'require_annual_validation': False, 'require_current_shape': False}
        record.update(history=history, latest_observation=latest_observation, coverage=coverage,
                      forecast=[], status='not_evaluated', reasons=[], model='chronos_2_small_ridge')
        records.append(record)
    result = deepcopy(snapshot)
    result.update(records=records, data_cutoff=complete_end.isoformat())
    return result, {'latest_source_observation': latest.isoformat(),
                    'complete_week_cutoff': complete_end.isoformat(), 'recomputed_from': replace_from.isoformat()}


def evaluate_paths(records, predictor, settings, as_of):
    """Three disjoint recent holdouts; hyperparameters remain frozen."""
    data = np.array([[h['price'] if h['price'] is not None else np.nan for h in r['history']] for r in records])
    length = data.shape[1]
    origins = [length - offset for offset in (36, 24, 12)]
    if min(origins) < 104:
        raise ValueError('Not enough aligned history for three complete rolling holdouts')
    evidence = [[] for _ in records]
    for origin in origins:
        # Passing only the prefix is a second barrier against future leakage.
        prefix = [dict(r, history=r['history'][:origin]) for r in records]
        paths = np.asarray(predictor(prefix, origin, settings), dtype=float)
        if paths.shape != (len(records), 52):
            raise ValueError('Invalid model path dimensions')
        for i in range(len(records)):
            past, truth = data[i, :origin], data[i, origin:origin+12]
            if not np.isfinite(paths[i, :12]).all() or not np.isfinite(past[-1]):
                continue
            scale = np.nanmedian(past)
            if not np.isfinite(scale) or scale <= 0:
                continue
            rows = []
            for horizon in HORIZONS:
                mask = np.isfinite(truth[:horizon])
                if mask.sum() < math.ceil(.9 * horizon):
                    break
                mae = float(np.abs(paths[i, :horizon][mask] - truth[:horizon][mask]).mean())
                baseline = float(np.abs(past[-1] - truth[:horizon][mask]).mean())
                rows.append({'origin': origin, 'horizon': horizon, 'mae': mae,
                             'relative_mae': mae / scale, 'baseline_mae': baseline})
            if len(rows) == 3:
                evidence[i].extend(rows)
        print(f'Rolling backtest origin {origin} complete', flush=True)
    current = np.asarray(predictor(records, length, settings), dtype=float)
    if current.shape != (len(records), 52):
        raise ValueError('Invalid current forecast dimensions')
    for i, record in enumerate(records):
        proof = evidence[i]
        ratios = []
        for horizon in HORIZONS:
            rows = [r for r in proof if r['horizon'] == horizon]
            error, baseline = sum(r['mae'] for r in rows), sum(r['baseline_mae'] for r in rows)
            if rows:
                ratios.append(error / baseline if baseline > 1e-10 else (1.0 if error <= 1e-10 else float('inf')))
        count = len({r['origin'] for r in proof})
        ratio = max(ratios) if len(ratios) == 3 else None
        record['coverage'].update(test_paths=count, test_complete_paths=count,
            test_relative_mae=max((r['relative_mae'] for r in proof), default=None),
            test_baseline_mae_ratio=ratio if ratio is not None and math.isfinite(ratio) else None)
        status, reasons = eligibility(record['coverage'], record['latest_observation'], as_of)
        path = current[i]
        if status == 'available' and (not np.isfinite(path).all() or not (path > 0).all()):
            raise ValueError(f'Invalid available model path: {record["item_code"]}')
        start = date.fromisoformat(record['history'][-1]['week'])
        record.update(status=status, reasons=reasons,
            forecast=[{'week': (start + timedelta(weeks=j+1)).isoformat(), 'price': float(price)}
                      for j, price in enumerate(path)] if status == 'available' else [],
            forecast_horizon_weeks=52, validated_horizon_weeks=12, annual_forecast_experimental=True,
            short_diagnostics={'horizons': list(HORIZONS), 'origins': origins,
                               'test_paths': count, 'historical_archive_reused': False,
                               'worst_relative_mae': record['coverage']['test_relative_mae'],
                               'baseline_mae_ratio': record['coverage']['test_baseline_mae_ratio']})
        # Old per-record annual/trend claims were not validated in this refresh.
        record.pop('annual_diagnostics', None)
        record.pop('trend_type', None)
    return origins, [{'item_code': r['item_code'], 'tests': proof} for r, proof in zip(records, evidence)]


def validate_snapshot(snapshot, as_of):
    seen, calendar = set(), None
    cutoff = date.fromisoformat(snapshot['data_cutoff'])
    if cutoff > as_of:
        raise ValueError('Future cutoff')
    for record in snapshot['records']:
        key = (record['item_code'], record['region_id'])
        if key in seen:
            raise ValueError('Duplicate item/region')
        seen.add(key)
        weeks = [h['week'] for h in record['history']]
        expected = pd.date_range(weeks[0], cutoff, freq='W-MON').date.astype(str).tolist()
        if weeks != expected or (calendar is not None and weeks != calendar):
            raise ValueError('Unaligned history or gaps omitted')
        calendar = weeks
        for point in record['history']:
            if point['price'] is not None and (not math.isfinite(point['price']) or point['price'] <= 0):
                raise ValueError('Invalid historical price')
        if record['latest_observation'] and record['latest_observation'] > snapshot['data_cutoff']:
            raise ValueError('Latest observation after cutoff')
        status, _ = eligibility(record['coverage'], record['latest_observation'], as_of)
        if status != record['status']:
            raise ValueError('Eligibility inconsistent with assessment date')
        forecast = record['forecast']
        if record['status'] == 'available':
            start = date.fromisoformat(weeks[-1])
            expected_forecast = [(start + timedelta(weeks=i)).isoformat() for i in range(1, 53)]
            if [p['week'] for p in forecast] != expected_forecast:
                raise ValueError('Forecast weeks do not follow cutoff')
            if any(not math.isfinite(p['price']) or p['price'] <= 0 for p in forecast):
                raise ValueError('Invalid forecast price')
        elif forecast:
            raise ValueError('Withheld record contains forecast')
    if not seen or not any(r['status'] == 'available' for r in snapshot['records']):
        raise ValueError('No qualified forecasts; keep previous published version')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'backend/data/price_forecasts.json')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--raw-dir', type=Path, default=ROOT / '.tmp/forecast-refresh/raw')
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--as-of', type=date.fromisoformat,
                        default=datetime.now(ZoneInfo('Asia/Kuala_Lumpur')).date())
    parser.add_argument('--model-cache', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        raise ValueError('Generate a candidate; do not overwrite the reference snapshot')
    source_bytes = args.source.read_bytes()
    previous = json.loads(source_bytes)
    if previous['model_policy']['name'] != 'chronos_2_small_ridge':
        raise ValueError('Unsupported reference model')
    names = month_names(date.fromisoformat(previous['data_cutoff']) - timedelta(weeks=12), args.as_of)
    if not args.offline:
        for name in ['lookup_item.parquet', 'lookup_premise.parquet', *names]:
            download(name, args.raw_dir)
    lookup = pd.read_parquet(args.raw_dir / 'lookup_item.parquet', engine='fastparquet')
    premises = pd.read_parquet(args.raw_dir / 'lookup_premise.parquet', engine='fastparquet')
    lookup = lookup[lookup.item_code > 0]
    premises = premises[premises.premise_code > 0]
    if lookup.item_code.duplicated().any() or premises.premise_code.duplicated().any():
        raise ValueError('Duplicate official lookup IDs')
    frame, sources, counts = source_frames(args.raw_dir, names, set(lookup.item_code), set(premises.premise_code), args.as_of)
    candidate, dates = update_histories(previous, frame, lookup, args.as_of)
    del frame
    from forecasting.model import forecast, load_pipeline, MODEL_ID, MODEL_REVISION
    adapter = load_pipeline(str(args.model_cache) if args.model_cache else None, args.offline)
    settings = previous['model_policy']['shared_ridge']
    if {k: settings[k] for k in ('alpha','weight','decay')} != {'alpha':100.,'weight':.5,'decay':12.}:
        raise ValueError('Reference parameters differ from validated fixed configuration')
    from threadpoolctl import threadpool_limits
    with threadpool_limits(limits=4):
        origins, proof = evaluate_paths(candidate['records'],
            lambda items, origin, settings: forecast(items, origin, adapter, settings), settings, args.as_of)
    now = datetime.now(ZoneInfo('Asia/Kuala_Lumpur'))
    candidate.update(generated_at=now.isoformat(),
        quality_policy={'rules': dict(DEFAULT_RULES), 'scope':'national', 'assessed_at':args.as_of.isoformat()},
        forecast_window_policy={'horizon_weeks':52,'validated_horizon_weeks':12,'experimental':True},
        model_policy={'name':'chronos_2_small_ridge','checkpoint':MODEL_ID,'checkpoint_revision':MODEL_REVISION,
                      'shared_ridge': {k:settings[k] for k in ('alpha','weight','decay')},
                      'validation_horizons':list(HORIZONS),'validation_origins':origins,
                      'batch_generated':True,'request_time_inference':False,
                      'weekly_refresh':True,'hyperparameters_reselected':False})
    candidate['refresh_provenance'] = {'previous_snapshot_sha256':hashlib.sha256(source_bytes).hexdigest(),
        'sources':sources,'lookup_sha256':{n:hashlib.sha256((args.raw_dir/n).read_bytes()).hexdigest()
        for n in ('lookup_item.parquet','lookup_premise.parquet')},'dates':dates,'counts':counts,
        'composition_audit':'paired-store changes over latest 12 complete weeks',
        'history_policy':'preserve prefix, recompute downloaded complete recent weeks; new items retain null past gaps'}
    combined_sources = {s['file']:s for s in previous.get('sources',[])}
    combined_sources.update({s['file']:s for s in sources})
    for name in ('lookup_item.parquet','lookup_premise.parquet'):
        combined_sources[name] = {'file':name,'url':BASE_URL+name,
            'sha256':hashlib.sha256((args.raw_dir/name).read_bytes()).hexdigest()}
    candidate['sources'] = list(combined_sources.values())
    validate_snapshot(candidate, args.as_of)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output_bytes = json.dumps(candidate, allow_nan=False, separators=(',', ':')).encode()
    temporary = args.output.with_suffix('.json.tmp')
    temporary.write_bytes(output_bytes)
    temporary.replace(args.output)
    report = {'as_of':args.as_of.isoformat(),'generated_at':now.isoformat(),**dates,**counts,
              'records':len(candidate['records']), 'status_counts':dict(Counter(r['status'] for r in candidate['records'])),
              'snapshot_sha256':hashlib.sha256(output_bytes).hexdigest(), 'origins':origins,
              'model':candidate['model_policy'], 'backtests':proof}
    args.output.with_suffix('.report.json').write_text(json.dumps(report,allow_nan=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ('backtests','model')},indent=2))


if __name__ == '__main__':
    main()
