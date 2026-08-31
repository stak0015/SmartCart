# SmartCart

SmartCart is an accessible household-essential basket planning tool for the
FIT5120 SDG 10 industry experience project.

The application uses a Next.js frontend and one FastAPI backend for item
catalogue, location, and reachable-store recommendation endpoints. Start the
backend first, then the frontend; the service-specific instructions are in
[`backend/README.md`](backend/README.md) and
[`frontend/README.md`](frontend/README.md).

For a beginner-friendly local database walkthrough, start with
[`database/SETUP_GUIDE.md`](database/SETUP_GUIDE.md). Technical ingestion and
maintenance details are in [`database/README.md`](database/README.md).

For a repeatable feature walkthrough without live data or Google keys, use the
isolated demo database described in [`database/demo/README.md`](database/demo/README.md)
and enable `SMARTCART_DEMO_MODE=true` in `backend/.env`.

The location and basket-plus-transport recommendation architecture, provider
choice, cost controls, privacy behaviour, and setup are documented in
[`docs/recommendation-engine.md`](docs/recommendation-engine.md).
