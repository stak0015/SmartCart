# Local setup

Gets the database, backend and frontend running on one machine. Commands are shown for Windows PowerShell; on macOS/Linux activate virtual environments with `source .venv/bin/activate`.

## Prerequisites

| Tool | Version |
| --- | --- |
| Git | any recent |
| Docker Desktop | running before step 1 |
| Python | 3.11+ (3.12 used in CI) |
| Node.js | 22 |
| pnpm | 11 (pinned in `frontend/package.json`) |

## 1. Database

From `database/`:

```powershell
Copy-Item .env.example .env
docker compose up -d
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

The first start creates the `smartcart` database and applies `schema.sql`. Wait until `docker compose ps` shows the service as healthy.

Load data (downloads PriceCatcher files for the current year, so it takes a while):

```powershell
python ingest_pricecatcher.py
python verify_database.py
```

Then add the enrichment and labels the app relies on:

```powershell
python migrate_premise_open_status.py   # needs the status CSV + cache in data/raw/ (ask the data owner)
python migrate_sara_chain_partners.py --apply
python seed_item_names.py
python seed_category_translations.py
```

Nutrition (from the repository root; also applies the nutrition migrations):

```powershell
python database/import_nutrition.py
```

Without `migrate_premise_open_status.py` no premise is `open`, so recommendations return no stores. `PREMISE_LOCATIONS_NOT_READY` appears when premises are open but none have coordinates.

### Demo database (optional)

A separate, deterministic database for Epic 3 demonstrations:

```powershell
docker compose -f docker-compose.demo.yml up -d
python seed_demo_alternatives.py
```

Point the backend at `postgresql://smartcart:smartcart_dev_password@127.0.0.1:5434/smartcart_demo`.

## 2. Backend

From `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```

Edit `.env`:

| Variable | Required? | Effect when empty |
| --- | --- | --- |
| `DATABASE_URL` | Yes | `503 DATABASE_NOT_CONFIGURED` |
| `GOOGLE_PLACES_API_KEY` | For location search | Search by text unavailable; device location still works |
| `GOOGLE_ROUTES_API_KEY` | No | Straight-line fallback (25 nearest stores, limits not verified) |
| `GOOGLE_GEOCODING_API_KEY` | No | Device location has no address label |
| `GOOGLE_MAPS_API_KEY` | No | Legacy single key used for any of the three above that is empty |
| `CEREBRAS_API_KEY` | No | Reports use deterministic fallback text |

All variables and defaults: [Deployment and operations](deployment-and-operations.md#configuration).

Check: `http://localhost:8000/api/health` and the OpenAPI UI at `http://localhost:8000/docs`.

## 3. Frontend

From `frontend/`:

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000/api`) must point at the backend and include `/api`.

Optional, with a Places key in `backend/.env`: refresh premise coordinates for a small batch.

```powershell
pnpm sync:premise-locations -- --limit=100
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Browser shows CORS errors | `CORS_ORIGINS` in `backend/.env` does not include the frontend origin |
| No stores recommended at all | Premise open status not imported (step 1) |
| "Store locations need to be prepared" | Open premises exist but coordinates were not imported (step 1) |
| Every recommendation says "approximate" | No Routes key, or the key/quota failed — expected locally |
| Nutrition and healthier alternatives "cannot load" | `import_nutrition.py` not run on this database (the nutrition table does not exist) |
| Price trends "could not be loaded" for every item | `backend/data/price_forecasts.json` missing or `SMARTCART_FORECAST_PATH` points to a bad file |
| Port 5432 in use | Set `POSTGRES_PORT` in `database/.env` and update `DATABASE_URL` |

`docker compose down -v` deletes the local database volume permanently.
