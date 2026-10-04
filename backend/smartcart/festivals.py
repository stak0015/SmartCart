"""Read-only festival price endpoints for US 4i.1."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Query

from .config import get_settings
from .errors import AppError
from .festival_service import (
    DATASET_FILES,
    FestivalDatasetError,
    get_active_alerts,
    get_festival_detail,
    list_festivals,
    load_dataset,
)

router = APIRouter(prefix="/api")
_dataset_cache = {}


def _dataset_dir():
    settings = get_settings()
    if not settings.festival_dataset_dir:
        raise AppError(
            "FESTIVAL_DATASET_UNAVAILABLE",
            "Festival price data is not available yet.",
            503,
        )
    return Path(settings.festival_dataset_dir)


def _cached_dataset():
    root = _dataset_dir()
    signature = tuple(
        (file_name, (root / file_name).stat().st_mtime_ns)
        for file_name in DATASET_FILES.values()
        if (root / file_name).exists()
    )
    key = (str(root), signature)
    if key not in _dataset_cache:
        try:
            _dataset_cache.clear()
            _dataset_cache[key] = load_dataset(root)
        except FestivalDatasetError as error:
            raise AppError(
                "FESTIVAL_DATASET_UNAVAILABLE",
                "Festival price data is not available yet.",
                503,
            ) from error
    return _dataset_cache[key]


@router.get("/festivals")
def festivals_endpoint():
    return list_festivals(_cached_dataset())


@router.get("/festivals/alerts")
def festival_alerts_endpoint(
    state: str | None = Query(default=None),
    on: str | None = Query(default=None),
):
    try:
        return get_active_alerts(_cached_dataset(), state=state, on_date=on)
    except ValueError as error:
        raise AppError(
            "INVALID_ALERT_DATE",
            "The alert date must use YYYY-MM-DD.",
            400,
        ) from error

@router.get("/festivals/{festival_id}")
def festival_detail_endpoint(
    festival_id: str,
    state: str | None = Query(default=None),
):
    try:
        detail = get_festival_detail(
            _cached_dataset(), festival_id, state=state
        )
    except KeyError as error:
        raise AppError(
            "FESTIVAL_STATE_NOT_FOUND",
            "The selected state has no data for this festival.",
            404,
        ) from error
    if detail is None:
        raise AppError(
            "FESTIVAL_NOT_FOUND",
            "Festival not found.",
            404,
        )
    return detail
