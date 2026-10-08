from datetime import date
import asyncio
import httpx
import pytest
from fastapi import FastAPI
from smartcart.api import router
from smartcart.errors import register_error_handlers
from smartcart.errors import AppError
from smartcart.forecast_rules import eligibility
from smartcart import price_history

def request(url):
    app = FastAPI()
    app.include_router(router)
    register_error_handlers(app)
    async def get():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
            return await client.get(url)
    return asyncio.run(get())

def coverage(**changes):
    return dict(history_weeks=200,recent_coverage=1,recent_stores=8,test_paths=3,
                test_relative_mae=.04,definition_consistent=True,composition_shift_rm=.1,
                test_complete_paths=3,test_baseline_mae_ratio=1.0,**changes)

def test_eligibility_states_and_configurable_rules():
    c = coverage()
    assert eligibility(c,None,date(2026,10,7))[0]=='no_history'
    assert eligibility({**c,'history_weeks':20},'2026-09-27',date(2026,10,7))[0]=='insufficient'
    assert eligibility(c,'2026-09-27',date(2026,10,7))[0]=='available'
    for field,value in [('recent_coverage',.2),('recent_stores',1),('test_relative_mae',.101),('definition_consistent',False),('test_paths',1),('test_complete_paths',2),('test_baseline_mae_ratio',1.01),('composition_shift_rm',2)]:
        assert eligibility({**c,field:value},'2026-09-27',date(2026,10,7))[0]=='rejected'
    assert eligibility(c,'2026-01-01',date(2026,10,7))[0]=='rejected'
    assert eligibility(c,'2026-09-27',date(2026,10,7),{'max_age_days':1})[0]=='rejected'

def test_old_snapshot_without_accuracy_evidence_is_withdrawn(monkeypatch):
    source = snapshot()
    source['records'][0]['coverage'].pop('test_complete_paths')
    monkeypatch.setattr(price_history,'load_snapshot',lambda: source)
    result = price_history.item_history('1')
    assert result['status'] == 'rejected' and result['history'] and not result['forecast']

def test_shared_annual_policy_requires_both_price_and_shape_evidence(monkeypatch):
    source=snapshot()
    source['quality_policy']={'rules':{'require_annual_validation':True}}
    monkeypatch.setattr(price_history,'load_snapshot',lambda:source)
    assert price_history.item_history('1')['status']=='rejected'
    c=source['records'][0]['coverage']
    c.update(test_annual_paths=1,test_annual_relative_mae=.04,
        test_annual_baseline_mae_ratio=.9,test_annual_shape_pass=True)
    assert price_history.item_history('1')['status']=='available'
    for field,value in [('test_annual_paths',0),('test_annual_relative_mae',.101),
        ('test_annual_relative_mae',float('nan')),('test_annual_baseline_mae_ratio',1.01),
        ('test_annual_baseline_mae_ratio',float('inf')),('test_annual_shape_pass',False)]:
        original=c[field];c[field]=value
        result=price_history.item_history('1')
        assert result['status']=='rejected' and result['history'] and not result['forecast']
        c[field]=original
    assert source['records'][0]['forecast']

def test_current_shape_gate_withdraws_a_historically_qualified_forecast(monkeypatch):
    source=snapshot()
    source['quality_policy']={'rules':{'require_current_shape':True}}
    monkeypatch.setattr(price_history,'load_snapshot',lambda:source)
    result=price_history.item_history('1')
    assert result['status']=='rejected' and result['history'] and not result['forecast']
    source['records'][0]['coverage']['current_forecast_shape_pass']=True
    assert price_history.item_history('1')['status']=='available'

def snapshot(status='available'):
    return dict(generated_at='2026-10-07',data_cutoff='2026-09-27',source='PriceCatcher',aggregation='store medians',records=[dict(item_code='1',region_id='national::',region='Malaysia',status=status,reasons=[],history=[{'week':'2026-09-21','price':2}],forecast=[{'week':'2026-09-28','price':3}],coverage=coverage(),latest_observation='2026-09-27')])

def test_api_region_selection_missing_item_and_snapshot_integrity(monkeypatch):
    source = snapshot()
    monkeypatch.setattr(price_history,'load_snapshot',lambda: source)
    response = request('/api/items/1/price-history')
    assert response.status_code==200
    assert response.json()['region']=='Malaysia'
    assert request('/api/items/1/price-history?region=district:Selangor:Petaling').status_code==400
    assert request('/api/items/99/price-history').json()['status']=='not_evaluated'
    assert len(source['records'][0]['forecast'])==1

def test_runtime_freshness_preserves_history(monkeypatch):
    source = snapshot()
    source['records'][0]['latest_observation']='2022-01-01'
    monkeypatch.setattr(price_history,'load_snapshot',lambda: source)
    result=price_history.item_history('1')
    assert result['status']=='rejected' and result['history'] and not result['forecast']
    assert source['records'][0]['forecast']

def test_api_exposes_only_national_item_results(monkeypatch):
    source=snapshot()
    regional={**source['records'][0],'region_id':'state:Selangor:','region':'Selangor'}
    source['records'].append(regional)
    monkeypatch.setattr(price_history,'load_snapshot',lambda:source)
    result=price_history.item_history('1')
    assert [r['id'] for r in result['regions']]==['national::']
    assert request('/api/items/1/price-history?region=state:Selangor:').status_code==400

def test_failed_forecast_preserves_history(monkeypatch):
    source=snapshot('failed')
    source['records'][0]['forecast']=[]
    monkeypatch.setattr(price_history,'load_snapshot',lambda: source)
    assert price_history.item_history('1')['history']

def test_missing_or_corrupt_snapshot_is_a_safe_service_failure(monkeypatch,tmp_path):
    file=tmp_path/'snapshot.json'
    monkeypatch.setenv('SMARTCART_FORECAST_PATH',str(file))
    try:
        for corrupt in (False,True):
            if corrupt: file.write_text('{broken',encoding='utf-8')
            price_history.load_snapshot.cache_clear()
            with pytest.raises(AppError) as error:
                price_history.load_snapshot()
            assert error.value.status==503
            assert error.value.code=='HISTORY_UNAVAILABLE'
    finally:
        price_history.load_snapshot.cache_clear()


def test_promoted_shared_snapshot_gates_year_display_on_short_evidence(monkeypatch):
    import json
    from pathlib import Path
    from datetime import datetime

    source=json.loads((Path(__file__).parents[1]/'data/price_forecasts.json').read_text())
    assert source['model_policy']['name']=='chronos_2_small_ridge'
    assert len(source['records'])==796
    class Clock:
        @staticmethod
        def now(zone):
            return datetime.fromisoformat(source['quality_policy']['assessed_at']).replace(tzinfo=zone)
    monkeypatch.setattr(price_history,'datetime',Clock)
    monkeypatch.setattr(price_history,'load_snapshot',lambda:source)
    qualified=[]
    for record in source['records']:
        result=price_history.item_history(record['item_code'])
        assert result['history']==record['history']
        assert result['model']=='chronos_2_small_ridge'
        assert result['validated_horizon_weeks']==12
        if result['status']=='available':
            qualified.append(record['item_code'])
            c=result['coverage']
            assert c['test_complete_paths']==3 and c['test_relative_mae']<=.1 and c['test_baseline_mae_ratio']<=1
            assert not c['require_annual_validation'] and not c['require_current_shape']
            assert len(result['forecast'])==52
            assert result['annual_forecast_experimental'] is True
            assert all(p['price']>0 and p['week']>source['data_cutoff'] for p in result['forecast'])
        else:
            assert result['forecast']==[]
    assert len(qualified)==80
