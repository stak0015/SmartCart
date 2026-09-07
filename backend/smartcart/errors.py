"""Stable public API errors without leaking provider or database details."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 500):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _response(error: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={"error": {"code": error.code, "message": error.message}},
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, error: AppError) -> JSONResponse:
        return _response(error)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        if request.url.path in {"/api/locations/resolve", "/api/locations/reverse"}:
            public_error = AppError(
                "INVALID_LOCATION",
                "Please choose a valid location suggestion.",
                400,
            )
        elif any(item.get("type") == "invalid_travel_limit" for item in error.errors()):
            public_error = AppError(
                "INVALID_TRAVEL_LIMIT",
                "Distance must be 0.5-100 km and time must be 5-180 minutes; both values are required for a combined limit.",
                400,
            )
        else:
            public_error = AppError(
                "INVALID_REQUEST",
                "The travel preferences are incomplete or invalid.",
                400,
            )
        return _response(public_error)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        logger.exception("Unexpected SmartCart API error on %s", request.url.path, exc_info=error)
        return _response(
            AppError(
                "INTERNAL_ERROR",
                "SmartCart could not complete that request. Please try again.",
                500,
            )
        )
