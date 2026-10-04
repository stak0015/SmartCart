"""Read-only festival price endpoints for US 4i.1."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .catalogue import (
    catalogue_item_codes_by_ids,
    catalogue_item_summaries,
    catalogue_median_prices,
)
from .config import get_settings
from .errors import AppError
from .festival_service import (
    DATASET_FILES,
    FestivalDatasetError,
    get_active_alerts,
    get_early_purchase_preview,
    get_early_purchase_savings,
    get_festival_detail,
    get_festival_item_forecast,
    get_festival_items,
    get_festival_top_items,
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


class EarlyPurchaseLine(BaseModel):
    record_id: str = ""
    item_id: str
    quantity: int = Field(ge=1)
    unit_price_rm: float = Field(gt=0)
    purchased_on: str
class EarlyPurchaseRequest(BaseModel):
    state: str
    purchases: list[EarlyPurchaseLine] = Field(default_factory=list, max_length=500)


class EarlyPurchasePreviewLine(BaseModel):
    item_id: str
    quantity: int = Field(ge=1, le=99)
    actual_unit_price_rm: float = Field(gt=0)


class EarlyPurchasePreviewRequest(BaseModel):
    state: str
    on: str | None = None
    lines: list[EarlyPurchasePreviewLine] = Field(default_factory=list, max_length=100)

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

@router.post("/festivals/early-purchase-savings")
def festival_early_purchase_savings_endpoint(payload: EarlyPurchaseRequest):
    try:
        return get_early_purchase_savings(
            _cached_dataset(),
            state=payload.state,
            purchases=[line.model_dump() for line in payload.purchases],
            item_code_provider=_item_codes_by_ids,
        )
    except KeyError as error:
        raise AppError(
            "FESTIVAL_STATE_NOT_FOUND",
            "The selected state has no festival data.",
            404,
        ) from error
    except ValueError as error:
        raise AppError(
            "INVALID_PURCHASE_DATE",
            "Purchase dates must use YYYY-MM-DD.",
            400,
        ) from error


@router.get("/festivals/item-forecast")
def festival_item_forecast_endpoint(
    item_id: int = Query(..., ge=1),
    state: str | None = Query(default=None),
    on: str | None = Query(default=None),
):
    try:
        code_by_id = _item_codes_by_ids([item_id])
        item_code = code_by_id.get(str(item_id))
        if not item_code:
            raise AppError(
                "ITEM_NOT_FOUND",
                "The requested catalogue item was not found.",
                404,
            )
        return get_festival_item_forecast(
            _cached_dataset(),
            item_code,
            state=state,
            on_date=on,
            median_price_provider=_median_prices,
        )
    except ValueError as error:
        raise AppError(
            "INVALID_FORECAST_DATE",
            "The forecast date must use YYYY-MM-DD.",
            400,
        ) from error


@router.post("/festivals/early-purchase-preview")
def festival_early_purchase_preview_endpoint(payload: EarlyPurchasePreviewRequest):
    try:
        return get_early_purchase_preview(
            _cached_dataset(),
            state=payload.state,
            lines=[line.model_dump() for line in payload.lines],
            item_code_provider=_item_codes_by_ids,
            median_price_provider=_median_prices,
            on_date=payload.on,
        )
    except ValueError as error:
        raise AppError(
            "INVALID_FORECAST_DATE",
            "The forecast date must use YYYY-MM-DD.",
            400,
        ) from error


@router.get("/festivals/{festival_id}/top-items")
def festival_top_items_endpoint(
    festival_id: str,
    state: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
):
    try:
        result = get_festival_top_items(
            _cached_dataset(),
            festival_id,
            state=state,
            limit=limit,
            item_summary_provider=_item_summaries,
        )
    except KeyError as error:
        raise AppError(
            "FESTIVAL_STATE_NOT_FOUND",
            "The selected state has no data for this festival.",
            404,
        ) from error
    if result is None:
        raise AppError("FESTIVAL_NOT_FOUND", "Festival not found.", 404)
    return result

def _median_prices(item_codes):
    try:
        return catalogue_median_prices(item_codes)
    except Exception:
        return {}


def _item_summaries(item_codes):
    try:
        return catalogue_item_summaries(item_codes)
    except Exception:
        return {}


def _item_codes_by_ids(item_ids):
    try:
        return catalogue_item_codes_by_ids(item_ids)
    except Exception:
        return {}


@router.get("/festivals/{festival_id}/items")
def festival_items_endpoint(
    festival_id: str,
    state: str | None = Query(default=None),
):
    try:
        result = get_festival_items(
            _cached_dataset(),
            festival_id,
            state=state,
            median_price_provider=_median_prices,
        )
    except KeyError as error:
        raise AppError(
            "FESTIVAL_STATE_NOT_FOUND",
            "The selected state has no data for this festival.",
            404,
        ) from error
    if result is None:
        raise AppError("FESTIVAL_NOT_FOUND", "Festival not found.", 404)
    return result

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
