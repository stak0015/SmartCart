"""Bounded, lazy PostgreSQL connection reuse for request handlers.

Owner: Shun
"""

from contextlib import contextmanager
from typing import Iterator
from functools import lru_cache
from queue import LifoQueue, Empty
from threading import BoundedSemaphore
from time import monotonic

import psycopg2
from psycopg2.extensions import connection, cursor

from .config import get_settings
from .errors import AppError


def get_connection() -> connection:
    """Open a new PostgreSQL connection (5 s connect timeout, SSL when DATABASE_SSL=true).
    Raises DATABASE_NOT_CONFIGURED (503) when no URL is set.
    """
    settings = get_settings()
    if not settings.database_url:
        raise AppError(
            "DATABASE_NOT_CONFIGURED",
            "The SmartCart database connection has not been configured.",
            503,
        )
    options: dict[str, object] = {"connect_timeout": 5}
    if settings.database_ssl:
        options["sslmode"] = "require"
    return psycopg2.connect(settings.database_url, **options)


class ConnectionPool:
    """Keep up to four connections per worker, opened only when needed."""

    def __init__(self, maximum: int = 4):
        self.available = LifoQueue(maxsize=maximum)
        self.slots = BoundedSemaphore(maximum)

    def acquire(self):
        if not self.slots.acquire(timeout=5):
            raise AppError("DATABASE_BUSY", "The database is busy. Please try again.", 503)
        try:
            while True:
                try:
                    database, returned_at = self.available.get_nowait()
                except Empty:
                    return get_connection()
                if not database.closed and monotonic() - returned_at < 240:
                    return database
                database.close()
        except BaseException:
            self.slots.release()
            raise

    def release(self, database, *, broken=False):
        try:
            if broken or database.closed:
                database.close()
            else:
                try:
                    database.rollback()
                    self.available.put_nowait((database, monotonic()))
                except Exception:
                    database.close()
        finally:
            self.slots.release()


@lru_cache(maxsize=1)
def _connection_pool(database_url: str | None) -> ConnectionPool:
    return ConnectionPool()


@contextmanager
def database_cursor() -> Iterator[cursor]:
    pool = _connection_pool(get_settings().database_url)
    database = pool.acquire()
    broken = False
    try:
        with database.cursor() as database_cursor_value:
            yield database_cursor_value
    except (psycopg2.InterfaceError, psycopg2.OperationalError):
        broken = True
        raise
    finally:
        pool.release(database, broken=broken)
