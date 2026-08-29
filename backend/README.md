# SmartCart FastAPI backend

This is the single HTTP backend for Epic 1 item discovery, Google-backed
location search, and transport-first store recommendations.

## Local setup

From `backend` on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Set `DATABASE_URL` and the server-only keys `GOOGLE_PLACES_API_KEY` and
`GOOGLE_ROUTES_API_KEY` in `.env` (a single `GOOGLE_MAPS_API_KEY` works as a
fallback for both), then
start the API:

```powershell
uvicorn main:app --reload --port 8000
```

FastAPI documentation is available at `http://localhost:8000/docs`. The main
routes are:

- `GET /api/health`
- `GET /api/items/search?q=&limit=`
- `GET /api/items/categories`
- `GET /api/locations/autocomplete?query=&sessionToken=`
- `POST /api/locations/resolve`
- `POST /api/recommendations`

Run backend tests from this directory with:

```powershell
python -m pytest
```

The API does not persist user origins or route calculations. Google-derived
premise coordinates remain subject to the documented 30-day deletion rule.
