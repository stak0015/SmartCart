from contextlib import contextmanager
from copy import deepcopy
import pytest
from smartcart import price_history
from smartcart.errors import AppError


def cursor_for(monkeypatch,row):
    class Cursor:
        def execute(self,query,params):
            assert params==('1',)
            assert 'LEFT JOIN price_forecast_record' in query
        def fetchone(self):return row
    @contextmanager
    def connection():yield Cursor()
    monkeypatch.setattr(price_history,'database_cursor',connection)


def test_postgres_reads_active_item_without_full_snapshot_cache(monkeypatch):
    metadata={'generated_at':'2026-10-12T00:00:00+08:00','data_cutoff':'2026-10-11',
              'source':'fixture','aggregation':'median'}
    record={'item_code':'1','region_id':'national::','region':'Malaysia','status':'no_history',
            'reasons':['No history'],'history':[],'forecast':[]}
    cursor_for(monkeypatch,(metadata,record))
    monkeypatch.setenv('SMARTCART_FORECAST_SOURCE','postgres')
    monkeypatch.setattr(price_history,'load_snapshot',lambda:pytest.fail('File cache must not be used'))
    assert price_history.item_history('1')['status']=='no_history'
    assert price_history.item_history('1')['generated_at']==metadata['generated_at']


def test_missing_postgres_item_remains_not_evaluated(monkeypatch):
    metadata={'generated_at':'2026-10-12T00:00:00+08:00','data_cutoff':'2026-10-11',
              'source':'fixture','aggregation':'median'}
    cursor_for(monkeypatch,(metadata,None))
    monkeypatch.setenv('SMARTCART_FORECAST_SOURCE','postgres')
    assert price_history.item_history('1')['status']=='not_evaluated'


def test_empty_postgres_never_silently_serves_old_file(monkeypatch):
    cursor_for(monkeypatch,None)
    monkeypatch.setenv('SMARTCART_FORECAST_SOURCE','postgres')
    with pytest.raises(AppError):price_history.item_history('1')
