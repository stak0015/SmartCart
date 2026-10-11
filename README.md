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

The location and basket-plus-transport recommendation architecture, provider
choice, cost controls, privacy behaviour, and setup are documented in
[`docs/recommendation-engine.md`](docs/recommendation-engine.md).

Proposed product changes for later iterations are recorded in
[`docs/future-iteration-improvements.md`](docs/future-iteration-improvements.md).

Shared price-forecast research, corrected backtests and current coverage limits
are documented in [`research/price_forecasting/UNIFIED.md`](research/price_forecasting/UNIFIED.md).
The default `backend/data/price_forecasts.json` now serves batch-generated
Chronos-2 Small forecasts with a shared ridge correction. At the 2026-10-09
assessment, 129 of 796 national items pass the relaxed short-window and data-quality
checks. The policy requires 52 observed weeks, 80% recent coverage, 3 recent
stores, observations no older than 28 days, worst short-window relative error
at most 15%, baseline error ratio at most 1.35, and store-composition variation
at most RM0.75. Complete 4/8/12-week backtests and consistent item definitions
remain required. Only qualifying items show projections; other items retain price
history. The requested full-year view remains experimental beyond the validated
12 weeks. Runtime freshness checks can withdraw older forecasts.
The previous serving snapshot is archived in
`research/price_forecasting/unified_results/serving_snapshot_before_short_promotion.json`.
The verified promotion can be reproduced with `build_short_serving.py`, using
that archived source and the frozen research artifacts. The API reads the saved
results without loading or fitting the model. `SMARTCART_FORECAST_PATH` remains
available for previews.
To reapply eligibility to the saved shared-model paths without fitting the model,
run `python backend/scripts/requalify_price_forecasts.py --as-of 2026-10-09`.
Desktop and mobile feature screenshots are in
[`docs/evidence/epic4-prices/shared-short/README.md`](docs/evidence/epic4-prices/shared-short/README.md).
