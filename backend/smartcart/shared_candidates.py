"""Short-lived store snapshots shared by serverless workers through PostgreSQL.

Only the travel fingerprint and public store response are stored, not the origin.
The table is provisioned lazily so existing deployments need no manual migration.
"""
from datetime import datetime, timezone
from functools import lru_cache
import json
from threading import Lock

from .config import get_settings
from .database import database_cursor
from .models import RecommendationResponse

_schema_lock = Lock()


@lru_cache(maxsize=1)
def _ensure_table(database_url):
    with _schema_lock, database_cursor() as cursor:
        # Serialize first-use DDL across workers, not just threads in this process.
        cursor.execute("SELECT pg_advisory_xact_lock(51201207)")
        cursor.execute("""CREATE TABLE IF NOT EXISTS smartcart_candidate_snapshot (
            cache_id TEXT PRIMARY KEY,
            fingerprint TEXT NOT NULL,
            response JSONB NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        )""")
        cursor.execute("""CREATE INDEX IF NOT EXISTS smartcart_candidate_snapshot_expiry_idx
            ON smartcart_candidate_snapshot (expires_at)""")
        cursor.connection.commit()


def save_snapshot(cache_id, fingerprint, response, expires_at):
    url = get_settings().database_url
    if not url:
        return
    _ensure_table(url)
    with database_cursor() as cursor:
        cursor.execute("DELETE FROM smartcart_candidate_snapshot WHERE expires_at <= NOW()")
        cursor.execute("""INSERT INTO smartcart_candidate_snapshot
            (cache_id, fingerprint, response, expires_at) VALUES (%s, %s, %s::jsonb, %s)""",
            (cache_id, fingerprint, response.model_dump_json(), expires_at))
        cursor.connection.commit()


def load_snapshot(cache_id):
    url = get_settings().database_url
    if not url or len(cache_id) != 32 or any(c not in "0123456789abcdef" for c in cache_id):
        return None
    _ensure_table(url)
    with database_cursor() as cursor:
        cursor.execute("""SELECT fingerprint, response, expires_at
            FROM smartcart_candidate_snapshot WHERE cache_id = %s AND expires_at > NOW()""",
            (cache_id,))
        row = cursor.fetchone()
    if row is None:
        return None
    fingerprint, value, expires_at = row
    remaining = (expires_at - datetime.now(timezone.utc)).total_seconds()
    if remaining <= 0:
        return None
    if isinstance(value, str):
        value = json.loads(value)
    return remaining, fingerprint, RecommendationResponse.model_validate(value)
