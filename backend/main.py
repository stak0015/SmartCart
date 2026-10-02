"""SmartCart FastAPI entry point.

Run from ``backend`` with:
    uvicorn main:app --reload --port 8000
"""

from datetime import datetime
from pathlib import Path
from typing import Callable

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

from smartcart.api import router  # noqa: E402
from smartcart.cerebras_narrator import CerebrasReportNarrator  # noqa: E402
from smartcart.config import get_settings  # noqa: E402
from smartcart.errors import register_error_handlers  # noqa: E402
from smartcart.reporting import (  # noqa: E402
    ReportNarrator,
    ReportRateLimitHook,
    allow_report_generation,
    utc_now,
)


def create_app(
    *,
    report_narrator: ReportNarrator | None = None,
    report_clock: Callable[[], datetime] | None = None,
    report_rate_limit_hook: ReportRateLimitHook | None = None,
) -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="SmartCart API", version="0.2.0")
    application.state.report_narrator = (
        report_narrator
        if report_narrator is not None
        else CerebrasReportNarrator(
            api_key=settings.cerebras_api_key,
            model=settings.cerebras_model,
        )
    )
    application.state.report_clock = report_clock if report_clock is not None else utc_now
    application.state.report_rate_limit_hook = (
        report_rate_limit_hook
        if report_rate_limit_hook is not None
        else allow_report_generation
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @application.middleware("http")
    async def prevent_private_api_caching(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "private, no-store"
        return response

    register_error_handlers(application)
    application.include_router(router)
    return application


app = create_app()
