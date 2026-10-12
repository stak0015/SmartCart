from copy import deepcopy
from datetime import date
import json

import numpy as np
import pandas as pd
import pytest

from forecasting.refresh import update_histories, evaluate_paths, validate_snapshot, source_frames

TODAY=date(2026,10,12)


def snapshot():
    history=[{'week':w.date().isoformat(),'price':10.,'stores':4,'observations':4}
             for w in pd.date_range('2022-01-03','2026-09-20',freq='W-MON')]
    return {'generated_at':'2026-09-21T00:00:00+08:00','data_cutoff':'2026-09-20',
            'source':'fixture','aggregation':'per-store weekly median, then national median',
            'records':[{'item_code':'1','item':'Item','unit':'1kg','region_id':'national::',
                        'region':'Malaysia (national)','history':history,
                        'latest_observation':'2026-09-20','coverage':{},'forecast':[]}]}


def lookup():
    return pd.DataFrame([{'item_code':1,'item':'Item','unit':'1kg'}])


def observations(extra=None):
    rows=[{'date':day,'item_code':1,'premise_code':store,'price':10.}
          for day in pd.date_range('2026-06-01','2026-10-11',freq='D') for store in range(1,5)]
    if extra:rows.extend(extra)
    return pd.DataFrame(rows)


def constant_predictor(items, origin, settings):
    assert all(len(r['history']) == origin for r in items)
    return np.full((len(items),52),10.)


def qualified():
    result,_=update_histories(snapshot(),observations(),lookup(),TODAY)
    evaluate_paths(result['records'],constant_predictor,{},TODAY)
    result['generated_at']='2026-10-12T08:00:00+08:00'
    return result


def test_refresh_uses_real_complete_new_weeks_and_preserves_older_history():
    old=snapshot()
    candidate,dates=update_histories(old,observations(),lookup(),TODAY)
    assert candidate['data_cutoff']=='2026-10-11'
    assert candidate['records'][0]['latest_observation']=='2026-10-11'
    assert candidate['records'][0]['history'][0]==old['records'][0]['history'][0]
    assert len(candidate['records'][0]['history'])==len(old['records'][0]['history'])+3
    assert dates['recomputed_from']=='2026-06-01'


def test_partial_week_is_excluded_and_no_new_week_fails():
    frame=observations()
    partial=frame[frame.date <= '2026-10-08']
    candidate,_=update_histories(snapshot(),partial,lookup(),TODAY)
    assert candidate['data_cutoff']=='2026-10-04'
    assert candidate['records'][0]['latest_observation']=='2026-10-04'
    with pytest.raises(ValueError,match='No newer complete week'):
        update_histories(snapshot(),frame[frame.date <= '2026-09-20'],lookup(),TODAY)


def test_store_balanced_median_combines_month_boundary_observations():
    frame=observations()
    frame=frame[~frame.date.between('2026-09-28','2026-10-04')]
    frame=pd.concat([frame,pd.DataFrame([
        {'date':pd.Timestamp('2026-09-30'),'item_code':1,'premise_code':1,'price':10.},
        {'date':pd.Timestamp('2026-10-01'),'item_code':1,'premise_code':1,'price':30.},
        {'date':pd.Timestamp('2026-10-04'),'item_code':1,'premise_code':2,'price':100.}])])
    candidate,_=update_histories(snapshot(),frame,lookup(),TODAY)
    week=next(h for h in candidate['records'][0]['history'] if h['week']=='2026-09-28')
    assert week=={'week':'2026-09-28','price':60.,'stores':2,'observations':3}


def test_missing_weeks_and_new_items_are_not_filled_or_inherited():
    frame=observations()
    frame=frame[~frame.date.between('2026-09-28','2026-10-04')]
    labels=pd.concat([lookup(),pd.DataFrame([{'item_code':2,'item':'New','unit':'1kg'}])])
    candidate,_=update_histories(snapshot(),frame,labels,TODAY)
    gap=next(h for h in candidate['records'][0]['history'] if h['week']=='2026-09-28')
    assert gap['price'] is None and gap['observations']==0
    assert all(h['price'] is None for h in candidate['records'][1]['history'])
    assert candidate['records'][1]['latest_observation'] is None


def test_changed_package_definition_is_withheld():
    changed=lookup();changed['unit']='500g'
    candidate,_=update_histories(snapshot(),observations(),changed,TODAY)
    evaluate_paths(candidate['records'],constant_predictor,{},TODAY)
    assert candidate['records'][0]['status']=='rejected'
    assert not candidate['records'][0]['forecast']
    assert candidate['records'][0]['coverage']['definition_consistent'] is False


def test_rolling_validation_withholds_bad_model_and_never_passes_future_to_predictor():
    result,_=update_histories(snapshot(),observations(),lookup(),TODAY)
    seen=[]
    def bad(items,origin,settings):
        assert all(len(r['history'])==origin for r in items)
        seen.append(origin)
        return np.full((len(items),52),20.)
    origins,_=evaluate_paths(result['records'],bad,{},TODAY)
    assert seen==origins+[len(result['records'][0]['history'])]
    assert result['records'][0]['status']=='rejected'
    assert not result['records'][0]['forecast']
    assert any('quality limit' in r for r in result['records'][0]['reasons'])


def test_good_paths_pass_then_corrupt_or_duplicate_paths_cannot_publish():
    result=qualified()
    validate_snapshot(result,TODAY)
    invalid=deepcopy(result)
    invalid['records'][0]['forecast'][0]['price']=float('nan')
    with pytest.raises(ValueError,match='Invalid forecast price'):validate_snapshot(invalid,TODAY)
    duplicate=deepcopy(result)
    duplicate['records'].append(deepcopy(result['records'][0]))
    with pytest.raises(ValueError,match='Duplicate'):validate_snapshot(duplicate,TODAY)


def test_source_validation_rejects_unknown_invalid_and_future_rows(tmp_path):
    frame=pd.DataFrame([
        ['2026-10-11',1,1,10.],['2026-10-11',999,1,10.],
        ['2026-10-11',1,999,10.],['2026-10-11',1,1,0.],
        ['2026-10-11',1,1,float('inf')],['2026-10-13',1,1,10.] ],
        columns=['date','item_code','premise_code','price'])
    frame.to_parquet(tmp_path/'fixture.parquet',engine='fastparquet')
    accepted,sources,counts=source_frames(tmp_path,['fixture.parquet'],{1},{1},TODAY)
    assert len(accepted)==1 and counts=={'source_rows':6,'skipped_rows':5}
    assert len(sources[0]['sha256'])==64
