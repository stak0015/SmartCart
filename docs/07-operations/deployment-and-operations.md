# Deployment and operations

## Environments

| Part | Production | Notes |
| --- | --- | --- |
| Frontend | Vercel, project `smart-cart`, team scope `tm-17` | Build with `pnpm build`; set `NEXT_PUBLIC_API_BASE_URL` to the public backend URL including `/api` |
| Database | Neon PostgreSQL, managed through the Vercel integration | Connection string available to scripts via `npx vercel env run` and to CI as the `NEON_DATABASE_URL` secret |
| Backend | FastAPI (`uvicorn main:app`) | The hosting target is **not recorded in this repository**; confirm and document it here |
| Daily data refresh | GitHub Actions, `.github/workflows/pricecatcher.yml` | 02:00 Malaysia time |

Deployed versions, smoke checks and sign-off are not tracked in the repository. Record them with each release (commit SHA, frontend deployment ID, backend version, date, checks run).

## Configuration

### Backend (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `DATABASE_SSL` | `false` | `true` adds `sslmode=require` (Neon) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed browser origins |
| `GOOGLE_PLACES_API_KEY` | falls back to `GOOGLE_MAPS_API_KEY` | Autocomplete and place details |
| `GOOGLE_ROUTES_API_KEY` | falls back to `GOOGLE_MAPS_API_KEY` | Route matrices; empty → straight-line fallback |
| `GOOGLE_GEOCODING_API_KEY` | falls back to `GOOGLE_MAPS_API_KEY` | Device-location labels |
| `GOOGLE_MAPS_REQUEST_TIMEOUT_SECONDS` | `10` (1–30) | Provider timeout |
| `ROUTE_MATRIX_CANDIDATE_LIMIT` | `25` (5–49) | Stores routed per request |
| `TRAVEL_COST_PUBLIC_TRANSPORT_BASE_PER_LEG_RM` | `1.00` | Fare fallback |
| `TRAVEL_COST_PUBLIC_TRANSPORT_PER_KM_RM` | `0.08` | Fare fallback |
| `TRAVEL_CAR_LITRES_PER_100KM` | `7.0` | Car fuel use |
| `TRAVEL_MOTORCYCLE_LITRES_PER_100KM` | `2.5` | Motorcycle fuel use |
| `TRAVEL_FUEL_PRICE_FIELD` | `ron95` | Or `ron95_budi95` (subsidised) |
| `TRAVEL_FUEL_PRICE_FALLBACK_RM` | `2.60` | Used only with no official or cached price |
| `CEREBRAS_API_KEY` | — | Enables AI report prose |
| `CEREBRAS_MODEL` | `gpt-oss-120b` | Model name |
| `SMARTCART_FORECAST_PATH` | `backend/data/price_forecasts.json` | Alternative snapshot for previews |

`TRAVEL_COST_CAR_PER_KM_RM` and `TRAVEL_COST_MOTORCYCLE_PER_KM_RM` are still read by `config.py` but no longer affect pricing (fuel-based costs replaced them).

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Backend base URL including `/api`. Browser-visible — never put secrets in `NEXT_PUBLIC_*` |

### Database scripts (`database/.env`)

`DATABASE_URL` (and `DATABASE_URL_UNPOOLED` for the nutrition importer). Docker variables: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`.

## Release checklist

1. All tests pass locally (see [Testing](testing.md)); `pnpm lint` and `pnpm build` succeed.
2. Apply schema changes: reapply `database/schema.sql` (idempotent) and any new migration; run `python database/import_nutrition.py --verify-only` after nutrition changes.
3. If the forecast snapshot changed, commit `backend/data/price_forecasts.json` and check its `generated_at` and status counts.
4. Deploy the backend, then the frontend; confirm `CORS_ORIGINS` includes the frontend URL.
5. Smoke test: `/api/health`, a catalogue search, a recommendation with and without a basket, one price-trends panel, one nutrition panel, one report (with and without a Cerebras key).
6. Record the release (see above).

## Scheduled and recurring tasks

| Task | Frequency | How | Status |
| --- | --- | --- | --- |
| Ingest current PriceCatcher month + verify | Daily 02:00 MYT | GitHub Actions | Automated |
| Delete Google coordinates older than 30 days | Daily | `pnpm cleanup:premise-locations` | **Not automated** — required by Google terms whenever coordinates are cached |
| Refresh premise coordinates | As needed | `pnpm sync:premise-locations` | Manual |
| Regenerate premise status CSV + import | When stores open/close | Enrichment workflow + `migrate_premise_open_status.py` | Manual |
| Promote SARA chain branches for new premises | After ingestion adds premises | `migrate_sara_chain_partners.py --apply` | Manual |
| Regenerate or re-qualify forecast snapshot | Before each demo, at least every 4 weeks | Research pipeline / `requalify_price_forecasts.py` | Manual — forecasts are withdrawn once the latest observation is more than 28 days old |
| Re-check provider pricing and quotas | Each iteration | Google Cloud console | Manual |

## Monitoring and failure modes

| Failure | User impact | Detection |
| --- | --- | --- |
| Daily ingestion fails | Prices stop updating and observed dates age | GitHub Actions failure email |
| Google Routes quota/key failure | Straight-line fallback with warning | `routeProvider = straight_line` in responses |
| Fuel CSV unavailable | Cached or fallback fuel price, labelled | Backend warning log |
| Cerebras failure or timeout | Report uses fallback text (`generationSource = fallback`) | `report_generation` log events (counts, timings, outcome) |
| Forecast snapshot ages | Forecasts withdrawn; history remains | Status `rejected` with "Historical observations are too old." |
| Database unreachable | API returns 500/503 errors | `/api/health` |

The backend logs unexpected errors with the request path only; report requests log metadata, never bodies.
