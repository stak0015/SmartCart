"""Real PostgreSQL transaction checks in an isolated disposable schema."""
from copy import deepcopy
import os
from pathlib import Path
from uuid import uuid4
import pytest

from forecasting.store import publish,export_snapshot
from forecasting.tests.test_refresh import qualified,TODAY

pytestmark=pytest.mark.skipif(not os.environ.get('FORECAST_TEST_DATABASE_URL'),
    reason='Explicit isolated PostgreSQL test connection required')


@pytest.fixture
def database():
    import psycopg
    from psycopg import sql
    schema='forecast_test_'+uuid4().hex
    with psycopg.connect(os.environ['FORECAST_TEST_DATABASE_URL'],autocommit=True) as connection:
        connection.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
        connection.execute(sql.SQL('SET search_path TO {}').format(sql.Identifier(schema)))
        connection.execute((Path(__file__).resolve().parents[2]/'database/migrations/003_price_forecasts.sql').read_text())
        try:yield connection
        finally:connection.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))


def test_active_version_switch_export_and_retention(database):
    first=qualified()
    first_id=publish(database,first,today=TODAY,expected_active='none')
    second=deepcopy(first);second['generated_at']='2026-10-12T09:00:00+08:00'
    second['records'][0]['forecast'][0]['price']=11.
    second_id=publish(database,second,today=TODAY,expected_active=first_id)
    returned,active_id=export_snapshot(database)
    assert active_id==second_id and returned['records'][0]['forecast'][0]['price']==11.
    third=deepcopy(second);third['generated_at']='2026-10-12T10:00:00+08:00'
    third_id=publish(database,third,today=TODAY,expected_active=second_id)
    assert database.execute('SELECT count(*) FROM price_forecast_batch').fetchone()[0]==2
    assert export_snapshot(database)[1]==third_id
    assert database.execute('SELECT count(*) FROM price_forecast_record WHERE batch_id=%s',(second_id,)).fetchone()[0]==1


def test_stale_publisher_and_older_generation_cannot_replace_active(database):
    first=qualified()
    first_id=publish(database,first,today=TODAY,expected_active='none')
    newer=deepcopy(first);newer['generated_at']='2026-10-12T09:00:00+08:00'
    new_id=publish(database,newer,today=TODAY,expected_active=first_id)
    with pytest.raises(ValueError,match='changed during generation'):
        publish(database,newer,today=TODAY,expected_active=first_id)
    with pytest.raises(ValueError,match='older'):
        publish(database,first,today=TODAY,expected_active=new_id)
    assert export_snapshot(database)[1]==new_id


def test_failed_record_insert_rolls_back_batch_and_active_pointer(database):
    import psycopg
    first=qualified()
    first_id=publish(database,first,today=TODAY)
    database.execute("ALTER TABLE price_forecast_record ADD CONSTRAINT reject_fixture CHECK(item_code <> '2')")
    broken=deepcopy(first);broken['generated_at']='2026-10-12T09:00:00+08:00'
    extra=deepcopy(broken['records'][0]);extra['item_code']='2'
    broken['records'].append(extra)
    with pytest.raises(psycopg.errors.CheckViolation):
        publish(database,broken,today=TODAY,expected_active=first_id)
    assert database.execute('SELECT count(*) FROM price_forecast_batch').fetchone()[0]==1
    assert database.execute('SELECT count(*) FROM price_forecast_record').fetchone()[0]==1
    assert export_snapshot(database)[1]==first_id
