from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
import psycopg2

from smartcart import api, database, nutrition, nutrition_repository
from smartcart.models import RecommendationResponse, TravelPreferences
from smartcart import shared_candidates


class Connection:
    closed = False
    rollbacks = 0

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True

    @contextmanager
    def cursor(self):
        yield SimpleNamespace()


def test_connection_reuse_resets_transaction_and_discards_broken_connection(monkeypatch):
    created = []
    def connect():
        value = Connection()
        created.append(value)
        return value
    pool = database.ConnectionPool(1)
    monkeypatch.setattr(database, "get_connection", connect)
    monkeypatch.setattr(database, "_connection_pool", lambda url: pool)
    with database.database_cursor():
        pass
    with database.database_cursor():
        pass
    assert len(created) == 1 and created[0].rollbacks == 2
    with pytest.raises(psycopg2.OperationalError):
        with database.database_cursor():
            raise psycopg2.OperationalError("lost connection")
    assert created[0].closed
    with database.database_cursor():
        pass
    assert len(created) == 2


def test_failed_connection_creation_releases_pool_slot(monkeypatch):
    pool = database.ConnectionPool(1)
    monkeypatch.setattr(database, "get_connection", lambda: (_ for _ in ()).throw(RuntimeError("connect")))
    with pytest.raises(RuntimeError):
        pool.acquire()
    replacement = Connection()
    monkeypatch.setattr(database, "get_connection", lambda: replacement)
    assert pool.acquire() is replacement
    pool.release(replacement)


def test_nutrition_batch_filters_original_and_alternatives(monkeypatch):
    calls = []
    class Cursor:
        def execute(self, sql, params=None):
            calls.append((sql, params))
        def fetchall(self):
            return []
    @contextmanager
    def cursor():
        yield Cursor()
    monkeypatch.setattr(nutrition_repository, "database_cursor", cursor)
    nutrition_repository.load_item_dataset(["1", "2"])
    assert "i.item_code = ANY(%s::text[])" in calls[1][0]
    assert calls[1][1] == (["1", "2"],)


def test_healthier_alternatives_do_not_load_unrelated_profiles(monkeypatch):
    calls = []
    monkeypatch.setattr(nutrition, "nutrition_dataset", lambda: {
        "rules": {}, "by_item": {"1": [{"alternative_item_code": "2"}]}})
    def profiles(*, item_code):
        calls.append(item_code)
        return {"sources": [], "foods": [], "mappings": []}
    monkeypatch.setattr(nutrition, "load_item_nutrition", profiles)
    assert nutrition.healthier_alternatives("1").count == 0
    assert calls == [["1", "2"]]


def test_store_snapshot_survives_worker_change_and_checks_travel(monkeypatch):
    travel = TravelPreferences.model_validate({
        "origin": {"label": "Test", "latitude": 3, "longitude": 101, "source": "search"},
        "transportMode": "walk", "limit": {"type": "distance", "value": 5}, "saraFilter": "any"})
    response = RecommendationResponse(
        recommendations=[], total_candidates_evaluated=0, total_reachable=0,
        generated_at=datetime.now(timezone.utc), ranking_method="Test", cost_assumptions={}, route_warning=None)
    stored = {}
    monkeypatch.setattr(api, "save_snapshot", lambda key, fingerprint, response, expiry:
                        stored.update({key: (100, fingerprint, response)}))
    monkeypatch.setattr(api, "load_snapshot", lambda key: stored.get(key))
    api._candidate_cache.clear()
    key, _ = api._store_candidate_snapshot(travel, response)
    api._candidate_cache.clear()
    assert api._get_candidate_snapshot(key, travel) == response
    changed = travel.model_copy(update={"transport_mode": "car"})
    assert api._get_candidate_snapshot(key, changed) is None
    api._candidate_cache.clear()


def test_shared_snapshot_round_trip_and_expiry(monkeypatch):
    from datetime import timedelta
    stored = {}
    commits = []
    class Cursor:
        connection = SimpleNamespace(commit=lambda: commits.append(True))
        def execute(self, sql, params=None):
            if sql.startswith("INSERT"):
                key, fingerprint, value, expiry = params
                stored[key] = (fingerprint, value, expiry)
            elif sql.startswith("SELECT"):
                self.row = stored.get(params[0])
        def fetchone(self):
            return self.row
    @contextmanager
    def cursor():
        yield Cursor()
    monkeypatch.setattr(shared_candidates, "database_cursor", cursor)
    monkeypatch.setattr(shared_candidates, "_ensure_table", lambda url: None)
    monkeypatch.setattr(shared_candidates, "get_settings", lambda: SimpleNamespace(database_url="configured"))
    response = RecommendationResponse(
        recommendations=[], total_candidates_evaluated=0, total_reachable=0,
        generated_at=datetime.now(timezone.utc), ranking_method="Test", cost_assumptions={}, route_warning=None)
    key = "a" * 32
    shared_candidates.save_snapshot(key, "fingerprint", response, datetime.now(timezone.utc) + timedelta(minutes=30))
    remaining, fingerprint, loaded = shared_candidates.load_snapshot(key)
    assert 0 < remaining <= 1800
    assert fingerprint == "fingerprint" and loaded == response
    assert len(commits) == 1
    stored[key] = (*stored[key][:2], datetime.now(timezone.utc) - timedelta(seconds=1))
    assert shared_candidates.load_snapshot(key) is None
    assert shared_candidates.load_snapshot("invalid") is None
