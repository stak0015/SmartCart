from datetime import datetime, timezone

from smartcart.candidate_cache import (
    CandidatePreparationCache,
    PreparedCandidateSet,
)


def prepared() -> PreparedCandidateSet:
    return PreparedCandidateSet(
        recommendations=(),
        total_candidates_evaluated=0,
        status="no_reachable_stores",
        route_provider="google",
        route_warning="No store was found inside your travel limit.",
        cost_assumptions={"car": "Planning estimate."},
        generated_at=datetime.now(timezone.utc),
    )


def test_cache_expires_handles_after_configured_ttl() -> None:
    current = [100.0]
    cache = CandidatePreparationCache(ttl_seconds=30, clock=lambda: current[0])

    handle, record = cache.put(prepared())
    assert cache.get(handle) is record
    assert record.expires_at is not None
    assert (record.expires_at - record.generated_at).total_seconds() >= 30

    current[0] += 30
    assert cache.get(handle) is None
    assert len(cache) == 0


def test_cache_bounds_size_and_evicts_oldest_handle() -> None:
    current = [100.0]
    cache = CandidatePreparationCache(
        ttl_seconds=30, max_entries=2, clock=lambda: current[0]
    )

    first, _ = cache.put(prepared())
    second, _ = cache.put(prepared())
    # Read first so the second handle becomes the least recently used.
    assert cache.get(first) is not None
    third, _ = cache.put(prepared())

    assert len(cache) == 2
    assert cache.get(second) is None
    assert cache.get(first) is not None
    assert cache.get(third) is not None


def test_cached_record_contains_derived_route_data_without_origin() -> None:
    cache = CandidatePreparationCache()
    handle, record = cache.put(prepared())

    assert handle
    assert not hasattr(record, "origin")
    assert not hasattr(record, "travel")
    assert not hasattr(record, "transport_mode")


def test_default_cache_is_bounded_to_thirty_minutes() -> None:
    cache = CandidatePreparationCache()
    assert cache.ttl_seconds == 30 * 60
    assert cache.max_entries == 100
