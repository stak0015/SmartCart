# Testing

## Suites

| Suite | Location | Runner | Needs |
| --- | --- | --- | --- |
| Backend unit + API | `backend/tests/` | pytest | `backend/requirements-dev.txt`; no database or Google key (both are faked) |
| Database scripts | `database/tests/` | pytest | `database/requirements.txt` (pandas, psycopg); some tests are pytest-style, so unittest discovery misses them |
| Weekly forecast refresh | `forecasting/tests/` | pytest | `forecasting/requirements.txt` (CPU torch, Chronos); the three publishing tests need `FORECAST_TEST_DATABASE_URL` and are skipped without it. Run in every weekly workflow against a temporary PostgreSQL |
| Nutrition data scripts | `data/nutrition/scripts/test_*.py` | unittest / pytest | `data/nutrition/scripts/requirements.txt` (includes openpyxl, requests) |
| Frontend unit + component | `frontend/**/*.test.ts(x)` | Vitest | `pnpm install` |
| Browser smoke checks | `frontend/scripts/check-*.cjs` | Node + Playwright | Running dev server, Playwright + Chrome; API calls are mocked |
| Live parity check | `database/verify_nutrition_runtime.py` | script | A database with nutrition imported |

## Commands

```bash
cd backend && python -m pytest
```

```bash
cd database && python -m pytest tests
```

```bash
python -m pytest forecasting/tests -q
```

```bash
cd data/nutrition/scripts && python -m unittest discover -p "test_*.py"
```

```bash
cd frontend && pnpm test
```

```bash
cd frontend && pnpm lint && pnpm build
```

## What the tests cover

| Area | Representative tests |
| --- | --- |
| Ranking, travel cost, fallback | `test_recommendation.py`, `test_api.py`, `test_fuel.py`, `test_premises.py` |
| Basket pricing, medians, SARA split | `test_pricing.py`, `test_sara.py` |
| Estimated price ranges and item lookup | `test_estimate_ranges.py`, `test_catalogue_prices.py`, `estimate-label.test.ts`, `catalogue-item-dialog.test.tsx` |
| Route cache (only missing legs requested, origin never in the database) | `test_route_cache.py` |
| Two-store routing and pricing | `test_multi_store.py`, `test_multi_store_pricing.py`, `test_multi_store_api.py` |
| Alternatives and pack sizes | `test_alternatives.py`, `test_pack_ratios.py` |
| Forecast eligibility and serving | `test_price_history.py`, `test_forecast_postgres.py`, `price-history.test.ts` |
| Weekly forecast refresh and publishing | `forecasting/tests/test_refresh.py`, `forecasting/tests/test_store_integration.py` |
| Nutrition | `test_nutrition*.py`, `test_item_nutrition*.py`, `test_healthier_alternatives.py`, `nutrition.test.ts` |
| Reports | `test_report_insights.py`, `test_report_story.py`, `test_cerebras_narrator.py`, `test_report_api.py`, `test_period_analytics.py` |
| Planned items while shopping, item details from planned items and the checklist | `shopping-checklist.test.tsx`, `next-trip.test.ts` |
| Device records | `shopping-checklist.test.ts`, `trip-history.test.ts`, `next-trip.test.ts`, `shopping-session.test.ts`, `report-consent.test.ts`, `checklist-snapshots.test.ts` |
| Privacy guards | `checklist-export.test.ts` and `trip-history.test.ts` assert those modules make no network calls; `report-screens.test.ts` asserts consent copy |

Story-by-story mapping: [Traceability matrix](../08-evidence/traceability-matrix.md).

## Forecast verification

Serving tests and model validation answer different questions. The backend and frontend suites test API/eligibility/UI behaviour. `forecasting/tests` test the weekly refresh: complete-week recalculation, rolling holdouts that never see future data, source validation and atomic publishing. None of them recreate the original model-selection evidence.

Run these focused checks for a serving change:

```bash
cd backend
python -m pytest tests/test_price_history.py tests/test_forecast_postgres.py
```

```bash
cd frontend
pnpm test -- price-history.test.ts
```

The model bundle's local `test_shared_short_head.py`, `test_chronos2_peer_context.py`, `test_chronos2_shape_correction.py` and related tests cover training cutoffs, origin-only inputs and transformations. They live in git-ignored research and are unavailable in a clean clone. Passing serving tests is not evidence that a changed model meets the forecast gate; inspect reproduced chronological scores, complete paths, baseline comparisons and provenance before promotion. See [methodology](../04-backend/forecasting-methodology.md#backtesting-and-interpreting-accuracy) and the [maintenance runbook](deployment-and-operations.md#forecast-maintenance).

## Writing tests

- Put pure logic in `backend/smartcart/*` domain modules or `frontend/lib/*` and test it directly; keep endpoint tests for wiring and contracts.
- Fake the database and Google in backend tests (see `backend/tests/conftest.py` and the existing monkeypatch patterns); never call real providers in tests. `conftest.py` also empties the route cache before each test and stubs its shared table, so cached legs never leak between tests.
- Test behaviour, not wording or markup. Avoid pinning static UI copy, CSS class names, constants or SQL formatting; these were pruned on 12 October 2026. The only deliberate source-text checks left are the privacy guards (`checklist-export.test.ts` and `trip-history.test.ts` make no network calls; `report-screens.test.ts` keeps the consent disclosure complete), so keep those strings intact when editing the files, including in comments.
- UI preview HTML is not generated by tests; use the browser smoke checks in `frontend/scripts/` instead.
- Name new tests after the behaviour, and mention the AC number in the test name or a comment where one applies.
- Store test outputs, screenshots and recordings in the git-ignored `research/evidence/`, not in the repository.
