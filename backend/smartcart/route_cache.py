"""Short-lived cache for Google route matrix results (Epics 2 and 6).

Each origin-destination pair is cached for 30 minutes as distance, duration and
transit fare only (the matrix returns no route geometry). A pair Google reports
no route for is cached too, so it is not asked again. Only the missing pairs of
a request are sent to Google.

- Home -> store legs include the shopper's location, so they stay in this
  process's memory under a hashed key and are never written to the database.
- Store -> store legs (two-store plans) hold no personal data, so they are also
  shared between serverless workers through PostgreSQL. That write runs in
  the background as one batched statement, so requests never wait on it.

Owners: Shun
"""
import asyncio
import hashlib
import logging
from concurrent.futures import Future, ThreadPoolExecutor
from functools import lru_cache
from threading import Lock
from time import monotonic
from typing import Protocol

from psycopg2.extras import execute_values

from .config import get_settings
from .database import database_cursor
from .maps import RouteMatrixResult
from .models import TransportMode

logger = logging.getLogger(__name__)

ROUTE_CACHE_TTL_SECONDS = 30 * 60
ROUTE_CACHE_MAX_ENTRIES = 20_000

# A cached leg: (distance m, duration s, transit fare RM) or None for "no route".
Leg = tuple[float, float, float | None] | None


class RouteMatrixProvider(Protocol):
    async def compute_route_matrix(self, origin: dict[str, float], destination_place_ids: list[str], mode: TransportMode) -> list[RouteMatrixResult]: ...
    async def compute_route_matrix_multi_origin(self, origin_place_ids: list[str], destination_place_ids: list[str], mode: TransportMode) -> list[RouteMatrixResult]: ...


_memory: dict[str, tuple[float, Leg]] = {}
_memory_lock = Lock()


def _memory_get(key: str) -> tuple[bool, Leg]:
    with _memory_lock:
        entry = _memory.get(key)
        if entry is None:
            return False, None
        expires_at, leg = entry
        if expires_at <= monotonic():
            del _memory[key]
            return False, None
        return True, leg


def _memory_put(entries: dict[str, Leg]) -> None:
    now = monotonic()
    with _memory_lock:
        for key, leg in entries.items():
            _memory[key] = (now + ROUTE_CACHE_TTL_SECONDS, leg)
        if len(_memory) > ROUTE_CACHE_MAX_ENTRIES:
            for key in [key for key, (expires_at, _) in _memory.items() if expires_at <= now]:
                del _memory[key]
            # Still too large: drop the oldest insertions first.
            while len(_memory) > ROUTE_CACHE_MAX_ENTRIES:
                del _memory[next(iter(_memory))]


def clear_memory_cache() -> None:
    with _memory_lock:
        _memory.clear()


def _origin_key(origin: dict[str, float], place_id: str, mode: TransportMode) -> str:
    raw = f"{origin['latitude']:.5f},{origin['longitude']:.5f}|{place_id}|{mode}"
    return "home:" + hashlib.sha256(raw.encode()).hexdigest()


def _pair_key(origin_place_id: str, destination_place_id: str, mode: TransportMode) -> str:
    return f"pair:{mode}:{origin_place_id}:{destination_place_id}"


def _leg(route: RouteMatrixResult) -> Leg:
    return (route.distance_meters, route.duration_seconds, route.transit_fare_rm)


# ── Shared store for store -> store legs ────────────────────────────────────

_schema_lock = Lock()


@lru_cache(maxsize=1)
def _ensure_table(database_url):
    with _schema_lock, database_cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(51201208)")
        cursor.execute("""CREATE TABLE IF NOT EXISTS smartcart_route_cache (
            cache_key TEXT PRIMARY KEY,
            distance_meters DOUBLE PRECISION,
            duration_seconds DOUBLE PRECISION,
            transit_fare_rm DOUBLE PRECISION,
            expires_at TIMESTAMPTZ NOT NULL
        )""")
        cursor.execute("""CREATE INDEX IF NOT EXISTS smartcart_route_cache_expiry_idx
            ON smartcart_route_cache (expires_at)""")
        cursor.connection.commit()


def _shared_get(keys: list[str]) -> dict[str, Leg]:
    url = get_settings().database_url
    if not url or not keys:
        return {}
    try:
        _ensure_table(url)
        with database_cursor() as cursor:
            cursor.execute("""SELECT cache_key, distance_meters, duration_seconds, transit_fare_rm
                FROM smartcart_route_cache WHERE cache_key = ANY(%s) AND expires_at > NOW()""", (keys,))
            rows = cursor.fetchall()
    except Exception:  # noqa: BLE001 - the cache is an optimisation only
        logger.warning("Shared route cache read failed", exc_info=True)
        return {}
    return {
        key: None if distance is None else (float(distance), float(duration), None if fare is None else float(fare))
        for key, distance, duration, fare in rows
    }


def _shared_put(entries: dict[str, Leg]) -> None:
    url = get_settings().database_url
    if not url or not entries:
        return
    rows = [
        (key, *(leg if leg is not None else (None, None, None)), ROUTE_CACHE_TTL_SECONDS)
        for key, leg in entries.items()
    ]
    try:
        _ensure_table(url)
        with database_cursor() as cursor:
            cursor.execute("DELETE FROM smartcart_route_cache WHERE expires_at <= NOW()")
            # One statement for the whole matrix: executemany costs a database
            # round trip per row, which took minutes for a cross-region database.
            execute_values(cursor, """INSERT INTO smartcart_route_cache
                (cache_key, distance_meters, duration_seconds, transit_fare_rm, expires_at)
                VALUES %s
                ON CONFLICT (cache_key) DO UPDATE SET
                    distance_meters = EXCLUDED.distance_meters,
                    duration_seconds = EXCLUDED.duration_seconds,
                    transit_fare_rm = EXCLUDED.transit_fare_rm,
                    expires_at = EXCLUDED.expires_at""", rows,
                template="(%s, %s, %s, %s, NOW() + make_interval(secs => %s))",
                page_size=len(rows))
            cursor.connection.commit()
    except Exception:  # noqa: BLE001 - the cache is an optimisation only
        logger.warning("Shared route cache write failed", exc_info=True)


# Shared writes run on one background thread so a request never waits on them.
_writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="route-cache-writer")
_pending_writes: set[Future] = set()
_pending_lock = Lock()


def _schedule_shared_put(entries: dict[str, Leg]) -> None:
    future = _writer.submit(_shared_put, entries)
    with _pending_lock:
        _pending_writes.add(future)

    def forget(done: Future) -> None:
        with _pending_lock:
            _pending_writes.discard(done)

    future.add_done_callback(forget)


def flush_shared_writes(timeout: float | None = None) -> None:
    """Wait for scheduled shared-cache writes to finish (tests and shutdown)."""
    with _pending_lock:
        pending = list(_pending_writes)
    for future in pending:
        future.result(timeout=timeout)


# ── Cached matrix calls ─────────────────────────────────────────────────────

async def cached_route_matrix(
    provider: RouteMatrixProvider,
    origin: dict[str, float],
    destination_place_ids: list[str],
    mode: TransportMode,
) -> list[RouteMatrixResult]:
    """compute_route_matrix with per-leg caching. Same result shape and order."""
    keys = [_origin_key(origin, place_id, mode) for place_id in destination_place_ids]
    legs: dict[int, Leg] = {}
    missing: list[int] = []
    for index, key in enumerate(keys):
        found, leg = _memory_get(key)
        if found:
            legs[index] = leg
        else:
            missing.append(index)

    if missing:
        fetched = await provider.compute_route_matrix(
            origin, [destination_place_ids[index] for index in missing], mode,
        )
        fresh: dict[int, Leg] = {index: None for index in missing}
        for route in fetched:
            if 0 <= route.destination_index < len(missing):
                fresh[missing[route.destination_index]] = _leg(route)
        legs.update(fresh)
        _memory_put({keys[index]: leg for index, leg in fresh.items()})

    return [
        RouteMatrixResult(destination_index=index, distance_meters=leg[0], duration_seconds=leg[1], transit_fare_rm=leg[2])
        for index, leg in sorted(legs.items())
        if leg is not None
    ]


async def cached_route_matrix_multi_origin(
    provider: RouteMatrixProvider,
    origin_place_ids: list[str],
    destination_place_ids: list[str],
    mode: TransportMode,
) -> list[RouteMatrixResult]:
    """compute_route_matrix_multi_origin with per-pair caching, shared across workers."""
    pairs = [(o, d) for o in range(len(origin_place_ids)) for d in range(len(destination_place_ids))]
    keys = {pair: _pair_key(origin_place_ids[pair[0]], destination_place_ids[pair[1]], mode) for pair in pairs}
    legs: dict[tuple[int, int], Leg] = {}
    not_in_memory = []
    for pair in pairs:
        found, leg = _memory_get(keys[pair])
        if found:
            legs[pair] = leg
        else:
            not_in_memory.append(pair)

    if not_in_memory:
        shared = await asyncio.to_thread(_shared_get, [keys[pair] for pair in not_in_memory])
        for pair in not_in_memory:
            if keys[pair] in shared:
                legs[pair] = shared[keys[pair]]
        _memory_put({keys[pair]: legs[pair] for pair in not_in_memory if pair in legs})

    missing = [pair for pair in pairs if pair not in legs]
    if missing:
        # The matrix is rectangular: ask for every origin and destination that
        # has at least one missing pair.
        origins = sorted({o for o, _ in missing})
        destinations = sorted({d for _, d in missing})
        fetched = await provider.compute_route_matrix_multi_origin(
            [origin_place_ids[o] for o in origins],
            [destination_place_ids[d] for d in destinations],
            mode,
        )
        fresh: dict[tuple[int, int], Leg] = {(o, d): None for o in origins for d in destinations}
        for route in fetched:
            if 0 <= route.origin_index < len(origins) and 0 <= route.destination_index < len(destinations):
                fresh[origins[route.origin_index], destinations[route.destination_index]] = _leg(route)
        legs.update(fresh)
        entries = {keys[pair]: leg for pair, leg in fresh.items()}
        _memory_put(entries)
        _schedule_shared_put(entries)

    return [
        RouteMatrixResult(destination_index=d, origin_index=o, distance_meters=leg[0], duration_seconds=leg[1], transit_fare_rm=leg[2])
        for (o, d), leg in sorted(legs.items())
        if leg is not None
    ]
