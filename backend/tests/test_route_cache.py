"""Route matrix caching (Epics 2 and 6): only missing legs go to Google."""
import asyncio
import threading
from contextlib import contextmanager

from smartcart import route_cache
from smartcart.maps import RouteMatrixResult

# conftest replaces _shared_put for every test; keep the real one for the SQL test.
REAL_SHARED_PUT = route_cache._shared_put
HOME = {"latitude": 3.0733, "longitude": 101.5185}


class FakeProvider:
    def __init__(self):
        self.single_calls = []
        self.multi_calls = []

    async def compute_route_matrix(self, origin, destination_place_ids, mode):
        self.single_calls.append(list(destination_place_ids))
        # "none" has no route; others are 1 km per character of the place ID.
        return [
            RouteMatrixResult(destination_index=i, distance_meters=len(pid) * 1000, duration_seconds=60)
            for i, pid in enumerate(destination_place_ids) if pid != "none"
        ]

    async def compute_route_matrix_multi_origin(self, origin_place_ids, destination_place_ids, mode):
        self.multi_calls.append((list(origin_place_ids), list(destination_place_ids)))
        return [
            RouteMatrixResult(origin_index=o, destination_index=d, distance_meters=1000 * (o + 1), duration_seconds=120)
            for o, _ in enumerate(origin_place_ids) for d, _ in enumerate(destination_place_ids)
        ]


def run(coro):
    return asyncio.run(coro)


def test_home_legs_are_reused_and_only_missing_ones_are_requested():
    provider = FakeProvider()
    first = run(route_cache.cached_route_matrix(provider, HOME, ["a", "bb"], "car"))
    again = run(route_cache.cached_route_matrix(provider, HOME, ["bb", "ccc", "a"], "car"))
    assert provider.single_calls == [["a", "bb"], ["ccc"]]
    assert [(r.destination_index, r.distance_meters) for r in first] == [(0, 1000), (1, 2000)]
    # Indexes follow the caller's list, whatever came from the cache.
    assert [(r.destination_index, r.distance_meters) for r in again] == [(0, 2000), (1, 3000), (2, 1000)]


def test_no_route_is_cached_too():
    provider = FakeProvider()
    assert run(route_cache.cached_route_matrix(provider, HOME, ["none"], "car")) == []
    assert run(route_cache.cached_route_matrix(provider, HOME, ["none"], "car")) == []
    assert provider.single_calls == [["none"]]


def test_cache_is_per_mode_and_origin():
    provider = FakeProvider()
    run(route_cache.cached_route_matrix(provider, HOME, ["a"], "car"))
    run(route_cache.cached_route_matrix(provider, HOME, ["a"], "walk"))
    run(route_cache.cached_route_matrix(provider, {"latitude": 3.1, "longitude": 101.6}, ["a"], "car"))
    assert len(provider.single_calls) == 3


def test_home_legs_never_reach_the_shared_table(monkeypatch):
    written = []
    monkeypatch.setattr(route_cache, "_shared_put", lambda entries: written.append(entries))
    run(route_cache.cached_route_matrix(FakeProvider(), HOME, ["a"], "car"))
    assert written == []


def test_store_pairs_are_shared_and_reused(monkeypatch):
    shared = {}
    monkeypatch.setattr(route_cache, "_shared_get", lambda keys: {k: shared[k] for k in keys if k in shared})
    monkeypatch.setattr(route_cache, "_shared_put", lambda entries: shared.update(entries))
    provider = FakeProvider()
    run(route_cache.cached_route_matrix_multi_origin(provider, ["s1", "s2"], ["s3"], "car"))
    route_cache.flush_shared_writes(timeout=5)
    assert set(shared) == {"pair:car:s1:s3", "pair:car:s2:s3"}
    assert all(":" in key and "." not in key for key in shared)  # place IDs only, no coordinates

    # Another worker (empty memory) reads the shared pairs and only asks for the new one.
    route_cache.clear_memory_cache()
    routes = run(route_cache.cached_route_matrix_multi_origin(provider, ["s1", "s2"], ["s3", "s4"], "car"))
    assert provider.multi_calls == [(["s1", "s2"], ["s3"]), (["s1", "s2"], ["s4"])]
    assert {(r.origin_index, r.destination_index) for r in routes} == {(0, 0), (1, 0), (0, 1), (1, 1)}


def test_store_pairs_are_returned_without_waiting_for_the_shared_write(monkeypatch):
    release = threading.Event()
    written = []

    def slow_put(entries):
        release.wait(timeout=5)
        written.append(entries)

    monkeypatch.setattr(route_cache, "_shared_put", slow_put)
    routes = run(route_cache.cached_route_matrix_multi_origin(FakeProvider(), ["s1"], ["s2"], "car"))
    assert len(routes) == 1
    assert written == []  # the response is ready while the write is still blocked

    release.set()
    route_cache.flush_shared_writes(timeout=5)
    assert written == [{"pair:car:s1:s2": (1000, 120, None)}]


def test_shared_write_sends_the_whole_matrix_in_one_statement(monkeypatch):
    calls = []

    class FakeCursor:
        connection = type("Connection", (), {"commit": lambda self: None})()

        def execute(self, sql, params=None):
            calls.append(("execute", sql))

        def executemany(self, sql, rows):
            calls.append(("executemany", len(rows)))

    @contextmanager
    def fake_cursor():
        yield FakeCursor()

    def fake_execute_values(cursor, sql, rows, template=None, page_size=100):
        calls.append(("execute_values", len(rows), page_size))

    monkeypatch.setattr(route_cache, "get_settings", lambda: type("S", (), {"database_url": "postgres://test"})())
    monkeypatch.setattr(route_cache, "_ensure_table", lambda url: None)
    monkeypatch.setattr(route_cache, "database_cursor", fake_cursor)
    monkeypatch.setattr(route_cache, "execute_values", fake_execute_values)

    entries = {f"pair:car:s{o}:s{d}": (1000.0, 60.0, None) for o in range(24) for d in range(24)}
    REAL_SHARED_PUT(entries)

    assert [call for call in calls if call[0] != "execute"] == [("execute_values", 576, 576)]
