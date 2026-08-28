# SmartCart FastAPI backend

This is the single HTTP backend for Epic 1 item discovery, Google-backed
location search, and basket-plus-transport store recommendations.

## Local setup

From `backend` on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Set `DATABASE_URL` and the server-only `GOOGLE_MAPS_API_KEY` in `.env`, then
start the API:

```powershell
uvicorn main:app --reload --port 8000
```

FastAPI documentation is available at `http://localhost:8000/docs`. The main
routes are:

- `GET /api/health`
- `GET /api/items/search?q=&page=&category=` (25 items per page)
- `GET /api/items/categories`
- `GET /api/locations/autocomplete?query=&sessionToken=`
- `POST /api/locations/resolve`
- `POST /api/recommendations`

The recommendation response ranks reachable premises by the sum of the priced
basket subtotal and estimated return transport cost. It includes quantity-aware
unit and line prices for each basket item at each store; missing store prices are
returned as null and excluded from the subtotal. Complete baskets rank before
incomplete baskets, with an explicit completeness flag for UI separation.

Run backend tests from this directory with:

```powershell
python -m pytest
```

The API does not persist user origins or route calculations. Google-derived
premise coordinates remain subject to the documented 30-day deletion rule.
