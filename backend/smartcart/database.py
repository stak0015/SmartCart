"""Short-lived PostgreSQL connection helpers for request handlers."""

from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.extensions import connection, cursor

from .config import get_settings
from .errors import AppError


def get_connection() -> connection:
    settings = get_settings()
    database_url = settings.demo_database_url if settings.demo_mode else settings.database_url
    if not database_url:
        raise AppError(
            "DEMO_DATABASE_NOT_CONFIGURED" if settings.demo_mode else "DATABASE_NOT_CONFIGURED",
            (
                "Demo mode is enabled but its database connection has not been configured."
                if settings.demo_mode
                else "The SmartCart database connection has not been configured."
            ),
            503,
        )
    options: dict[str, object] = {"connect_timeout": 5}
    if settings.database_ssl:
        options["sslmode"] = "require"
    return psycopg2.connect(database_url, **options)


@contextmanager
def database_cursor() -> Iterator[cursor]:
    database = get_connection()
    try:
        with database.cursor() as database_cursor_value:
            yield database_cursor_value
    finally:
        database.close()
