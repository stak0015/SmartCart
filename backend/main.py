"""SmartCart FastAPI entry point.

Run from ``backend`` with:
    uvicorn main:app --reload --port 8000
"""

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

from smartcart.api import router  # noqa: E402
from smartcart.config import get_settings  # noqa: E402
from smartcart.errors import register_error_handlers  # noqa: E402


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="SmartCart API", version="0.2.0")
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
