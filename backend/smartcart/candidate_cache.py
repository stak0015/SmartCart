"""Bounded, process-local storage for prepared route candidates.

The cached record deliberately contains no selected origin or travel request.
Only derived store and route results needed by the recommendation step survive
between the preparation and pricing requests.
"""

from collections import OrderedDict
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
import secrets
import threading
import time
from typing import Callable, Literal

from .models import StoreRecommendation, TransportMode

DEFAULT_TTL_SECONDS = 30 * 60
DEFAULT_MAX_ENTRIES = 100


@dataclass(frozen=True)
class PreparedCandidateSet:
    recommendations: tuple[StoreRecommendation, ...]
    total_candidates_evaluated: int
    status: Literal["ready", "no_reachable_stores", "unverified"]
    route_provider: Literal["google", "straight_line"]
    route_warning: str | None
    cost_assumptions: dict[TransportMode, str]
    generated_at: datetime
    expires_at: datetime | None = None


class CandidatePreparationCache:
    """LRU cache with a fixed maximum size and bounded session lifetime."""

    def __init__(
        self,
        *,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        max_entries: int = DEFAULT_MAX_ENTRIES,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if ttl_seconds <= 0 or max_entries <= 0:
            raise ValueError("Candidate cache bounds must be positive.")
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._clock = clock
        self._entries: OrderedDict[
            str, tuple[PreparedCandidateSet, float]
        ] = OrderedDict()
        self._lock = threading.RLock()

    def _remove_expired(self, now: float) -> None:
        expired = [
            preparation_id
            for preparation_id, (_record, deadline) in self._entries.items()
            if deadline <= now
        ]
        for preparation_id in expired:
            self._entries.pop(preparation_id, None)

    def put(self, record: PreparedCandidateSet) -> tuple[str, PreparedCandidateSet]:
        now_monotonic = self._clock()
        now_utc = datetime.now(timezone.utc)
        expires_at = now_utc + timedelta(seconds=self.ttl_seconds)
        stored_record = replace(record, expires_at=expires_at)
        with self._lock:
            self._remove_expired(now_monotonic)
            preparation_id = secrets.token_urlsafe(24)
            while preparation_id in self._entries:
                preparation_id = secrets.token_urlsafe(24)
            self._entries[preparation_id] = (
                stored_record,
                now_monotonic + self.ttl_seconds,
            )
            self._entries.move_to_end(preparation_id)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)
        return preparation_id, stored_record

    def get(self, preparation_id: str) -> PreparedCandidateSet | None:
        now = self._clock()
        with self._lock:
            self._remove_expired(now)
            entry = self._entries.get(preparation_id)
            if entry is None:
                return None
            self._entries.move_to_end(preparation_id)
            return entry[0]

    def delete(self, preparation_id: str) -> bool:
        with self._lock:
            return self._entries.pop(preparation_id, None) is not None

    def __len__(self) -> int:
        now = self._clock()
        with self._lock:
            self._remove_expired(now)
            return len(self._entries)


candidate_preparations = CandidatePreparationCache()
