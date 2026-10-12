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
| `SMARTCART_FORECAST_PATH` | `backend/data/price_forecasts.json` | Alternative snapshot for previews |
| `SMARTCART_FORECAST_SOURCE` | `file` | `postgres` reads the active offline-generated database batch; enable after initial verified publication |

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
3. If the forecast snapshot changed, follow [Forecast snapshot maintenance](#forecast-snapshot-maintenance), commit the verified JSON and restart all backend workers to load it.
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
| Refresh forecasts from newer official observations | Weekly Monday 04:00 MYT | `.github/workflows/forecasts.yml` | PostgreSQL publishing workflow; requires initial activation and `NEON_DATABASE_URL` |
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

## Forecast snapshot maintenance

The snapshot is loaded on the first history request and cached once per backend process by `load_snapshot()` (`lru_cache(maxsize=1)`). Replacing the JSON or changing `SMARTCART_FORECAST_PATH` does not invalidate a running worker's cached data. Restart/redeploy every worker after replacement; otherwise different workers can serve different snapshots. Eligibility is still checked against the current Malaysian date on every request for a record stored as available. A stored rejected record cannot become available through a request.

Choose maintenance according to what changed:

| Need | Action | Prerequisite |
| --- | --- | --- |
| Reassess existing predictions for a date | Run `backend/scripts/requalify_price_forecasts.py` | Exact matching saved 52-week paths from the local research bundle |
| Include newer source observations or retrain | Rebuild research inputs, backtests, audits and provenance, then promote with `build_short_serving.py` | Full offline research bundle and exact reference inputs; see [methodology](../04-backend/forecasting-methodology.md#reproducibility-and-source-map) |
| Deploy a verified snapshot | Replace JSON and restart all workers | Validated artifact; backend ML dependencies are unnecessary |

For eligibility-only maintenance, run from the repository root against a **copy** first:

```powershell
Copy-Item backend/data/price_forecasts.json backend/data/price_forecasts.preview.json
python backend/scripts/requalify_price_forecasts.py --source backend/data/price_forecasts.preview.json --paths research/price_forecasting/unified_results/current_shared_short_head_paths.csv --as-of 2026-10-12
```

Replace the example date with the intended assessment date. Review the preview and remove it after use; it is not a second production dataset. Requalification writes through a temporary file and replaces its target atomically, preserves history and rejects incomplete, duplicate, non-positive, non-finite or changed serving paths. It updates `quality_policy.assessed_at` and provenance; it does not change `generated_at`, source dates or model weights. Production must use the actual assessment date, not an earlier date chosen to restore expired forecasts.

Before promotion/release:

1. Record artifact hash, model/checkpoint revision, `generated_at`, `data_cutoff`, `quality_policy.assessed_at`, rules, status counts and source/path hashes. Distinguish counts in the candidate snapshot from earlier research reports.
2. Confirm unique item/region records, aligned histories with null gaps, positive finite forecast prices, weekly dates after the cutoff and the declared generated/validated horizons. Compare preserved history and model paths with the reference evidence.
3. Run the targeted backend and frontend serving checks in [Testing](testing.md#forecast-verification). Inspect available and withheld series, missing history and stale-date behaviour. Check the API's stored 52-week path is displayed only up to the validated 12 weeks in the UI.
4. Deploy/restart every worker and confirm the price-history response's generation/cutoff dates match the candidate. Preserve the prior verified artifact for rollback; rolling back does not extend its freshness.

| Symptom | Check/action |
| --- | --- |
| `HISTORY_UNAVAILABLE` (503) | Check snapshot path, file permissions and JSON syntax; an unreadable/invalid JSON file is not repaired by the API |
| Expected new snapshot is not visible | Confirm file/environment path and restart all workers; HTTP `no-store` does not clear the process cache |
| Forecast disappeared but history remains | Inspect reasons and latest observation date; advancing raw observations requires a research refresh |
| Requalification cannot find matching paths | Recover the matching research bundle; do not substitute forecasts from a different run |
| New catalogue item has `not_evaluated` | Include it in the aligned research history and backtest it; ingestion alone does not create a forecast |

The weekly PostgreSQL refresh workflow is documented in [Weekly forecasts](../../forecasting/README.md). It generates new paths from updated data and re-runs three rolling short-horizon holdouts before atomic publication. Initial activation and one backend deployment are required; afterwards updates do not need redeployment. There is no independent prospective accuracy/drift monitor. Retain generation reports, available/rejected counts and withdrawal reasons with each run, and inspect forecast-versus-actual errors as observations arrive.
