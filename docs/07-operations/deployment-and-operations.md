# Deployment and operations

## Environments

| Part | Production | Notes |
| --- | --- | --- |
| Frontend | Vercel, project `smartcart-my`, team scope `tm-17` | Build with `pnpm build`; set `NEXT_PUBLIC_API_BASE_URL` to the public backend URL including `/api` |
| Database | Neon PostgreSQL, managed through the Vercel integration | Connection string available to scripts via `npx vercel env run` and to CI as the `NEON_DATABASE_URL` secret |
| Backend | Vercel, FastAPI project `smart-cart`, team scope `tm-17` | Production uses `main`; the iteration3 branch has its own preview alias |
| Daily data refresh | GitHub Actions, `.github/workflows/pricecatcher.yml` | 02:00 Malaysia time |

Deployed versions, smoke checks and sign-off are not tracked in the repository. Record them with each release (commit SHA, frontend deployment ID, backend version, date, checks run).

### Request latency

Backend workers lazily reuse up to four PostgreSQL connections each. Read transactions are rolled back before reuse, broken connections are discarded, and idle connections older than four minutes are replaced. Prepared store snapshots use the shared `smartcart_candidate_snapshot` table (30-minute TTL), provisioned on first use.

The browser keeps up to 128 successful catalogue responses in memory: search prices for 30 seconds, alternative cards for 60 seconds, nutrition and categories for five minutes. Price cache keys include the candidate ID; failures and aborted requests are not cached. HTTP responses remain private and non-cacheable by shared CDNs.

On 2026-10-12, `GOOGLE_ROUTES_API_KEY` was removed from Production and Preview to pause paid Routes usage. With no generic `GOOGLE_MAPS_API_KEY` configured, the existing nearest-25 straight-line fallback is used. Re-add a Routes key and redeploy to restore routed estimates. Places and geocoding keys are separate and remain configured.

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
| `SMARTCART_FORECAST_PATH` | `backend/data/price_forecasts.json` | File used when the source is `file` (previews, local runs) |
| `SMARTCART_FORECAST_SOURCE` | `file` | `postgres` reads the active weekly batch from the database (set in Production since 12 Oct 2026) |

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
3. If forecasting code or the forecast tables changed, follow [Forecast maintenance](#forecast-maintenance). Weekly forecast batches themselves need no release.
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
| Refresh forecasts from newer official observations | Weekly Monday 04:00 MYT | `.github/workflows/forecasts.yml` (uses the `NEON_DATABASE_URL` secret) | Automated — check each run; forecasts are withdrawn once the latest observation is more than 28 days old |
| Re-check provider pricing and quotas | Each iteration | Google Cloud console | Manual |

## Monitoring and failure modes

| Failure | User impact | Detection |
| --- | --- | --- |
| Daily ingestion fails | Prices stop updating and observed dates age | GitHub Actions failure email |
| Google Routes quota/key failure | Straight-line fallback with warning | `routeProvider = straight_line` in responses |
| Fuel CSV unavailable | Cached or fallback fuel price, labelled | Backend warning log |
| Cerebras failure or timeout | Report uses fallback text (`generationSource = fallback`) | `report_generation` log events (counts, timings, outcome) |
| Weekly forecast job fails | Previous batch stays active; forecasts withdrawn once observations are over 28 days old; history remains | GitHub Actions failure email (only to maintainers watching the workflow); status `rejected` with "Historical observations are too old." |
| Forecast tables empty or unreachable (`postgres` source) | Price trends show "could not be loaded" | `HISTORY_UNAVAILABLE` (503) from price history |
| Database unreachable | API returns 500/503 errors | `/api/health` |

The backend logs unexpected errors with the request path only; report requests log metadata, never bodies.

## Forecast maintenance

Production reads forecasts from PostgreSQL (`SMARTCART_FORECAST_SOURCE=postgres`). The weekly job, first activation, local generation and rollback are documented in [Weekly forecasts](../../forecasting/README.md). In short:

- **Weekly run** (Monday 04:00 MYT, or **Run workflow** manually): tests the refresh logic, applies `database/migrations/003_price_forecasts.sql`, exports the active batch as the reference, downloads newer PriceCatcher months, regenerates paths with the fixed model, re-runs three rolling holdouts and publishes the batch atomically. A run that finds no newer complete week fails without publishing. Generation and validation reports are kept as workflow artifacts for 30 days.
- **Freshness:** eligibility is checked against the current Malaysian date on every request. A failed run leaves the previous batch active until its observations pass 28 days; it does not relabel dates.
- **Rollback:** switch `price_forecast_active.batch_id` to a retained batch inside a transaction, then confirm the API's `generated_at`/`data_cutoff`. Rollback does not extend freshness.
- **Model changes** (new checkpoint, features or rules) still need a code release and the offline research evidence in [Forecasting methodology](../04-backend/forecasting-methodology.md#reproducibility-and-source-map).

There is no independent prospective accuracy or drift monitor. Keep each run's report, available/rejected counts and withdrawal reasons, and compare forecasts with actual prices as new weeks arrive.

| Symptom | Check/action |
| --- | --- |
| `HISTORY_UNAVAILABLE` (503) with `postgres` | Check `DATABASE_URL` and that `price_forecast_active` points at a batch; the API does not fall back to the file |
| Weekly run failed | Read the job log and report artifact. A 404 for the current month is tolerated; missing older months, corrupt files or no newer complete week stop the run |
| Forecast disappeared but history remains | Inspect reasons and latest observation date; usually stale data after failed runs or a failed holdout |
| New catalogue item has `not_evaluated` | The weekly job adds new items with null earlier history; they need enough weeks and backtests before a forecast is shown |

### File source (fallback)

With `SMARTCART_FORECAST_SOURCE=file`, the JSON at `SMARTCART_FORECAST_PATH` is loaded once per process by `load_snapshot()` (`lru_cache(maxsize=1)`); restart every worker after replacing it. The committed file is the 9 Oct 2026 reference and ages out like any batch, so choose this source explicitly and check its dates. `backend/scripts/requalify_price_forecasts.py` re-applies eligibility to the file for a given date (run it on a copy first, with the matching saved paths from the git-ignored research bundle); it cannot add newer observations.
