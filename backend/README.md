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

Set `DATABASE_URL` in `.env`. Google keys are optional for local development:
`GOOGLE_PLACES_API_KEY` enables location autocomplete and
`GOOGLE_ROUTES_API_KEY` enables routed recommendations (a single
`GOOGLE_MAPS_API_KEY` works as a fallback for both). If the Routes key is
missing, recommendations automatically use the 25 nearest fresh premises with
straight-line distance and clearly marked approximate travel estimates. Then
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
- `POST /api/premises/{premiseId}/basket-alternatives`

With Google Routes configured, the recommendation response ranks reachable
premises by the sum of the priced basket subtotal and estimated return
transport cost. Without a Routes key, it skips the provider and returns the 25
nearest fresh premises by straight-line distance; route limits and reachability
are not verified in that fallback. Both paths include quantity-aware unit and
line prices for each basket item at each store; missing store prices are
returned as null and excluded from the subtotal. Complete baskets rank before
incomplete baskets, with an explicit completeness flag for UI separation.

Run backend tests from this directory with:

```powershell
python -m pytest
```

The API does not persist user origins or route calculations. Google-derived
premise coordinates remain subject to the documented 30-day deletion rule.

The selected-store alternatives endpoint returns one cheaper strict equivalent
per requested basket line when the same category, package basis, and product
family are available at that premise. Price observations remain estimates and
do not prove stock.
