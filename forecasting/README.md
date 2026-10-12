# Weekly forecasts

The weekly GitHub Actions job runs Monday at 04:00 Malaysia time (`0 20 * * 0` UTC).
It downloads current official lookup files and recent PriceCatcher months, recomputes
complete Monday–Sunday weeks and generates new forecasts using the pinned
Chronos-2 Small checkpoint plus the fixed pooled ridge head. Model selection is
not repeated weekly. Training uses only data known at each chronological origin.

Three recent disjoint holdouts test 4-, 8- and 12-week predictions against actual
observations and a latest-price baseline. Existing runtime quality thresholds,
including the 28-day source freshness limit, remain unchanged. Missing prices
stay null. A recent paired-store composition audit must have at least nine weekly
comparisons. Changed official item definitions are withheld until their histories
can be reconciled. Fifty-two points are generated, but only the first twelve
weeks have validated serving evidence, matching the existing UI contract.

Histories before the downloaded window are retained from the previous verified
snapshot. Recent complete weeks are recalculated from individual observations,
including weeks that cross a month boundary. New catalogue items have null earlier
history and cannot inherit another item's backtests. Input hashes, model revision,
rolling origins and validation evidence are recorded with each candidate.

## PostgreSQL publishing

`database/migrations/003_price_forecasts.sql` creates batch metadata, item records,
and a single active pointer. A publication transaction validates every record,
rejects older data/generations and concurrent stale publishers, inserts the complete
batch, and changes the active pointer. It retains the current and previous batches
for rollback. A failure leaves the prior active pointer intact. Model weights and
raw observation archives are not stored in PostgreSQL.

The API selects metadata and only the requested item from the active batch in one
SQL statement. PostgreSQL mode has no indefinitely cached JSON snapshot and does
not silently fall back to an old file if the database fails. Existing freshness
withdrawal still runs for every request.

## First activation

1. Confirm the existing GitHub `NEON_DATABASE_URL` secret targets the same database
   as the backend's production `DATABASE_URL`; never print or commit either value.
2. Merge the workflow and application changes. Run **Refresh weekly price forecasts**
   manually. It creates the additive forecast tables and uses the committed JSON
   only as an initial reference if no database batch exists. Generation must use
   newer complete observations before it can publish.
3. Verify the workflow's published batch and candidate report. Keep the file source
   enabled until this first database publication has succeeded.
4. Set backend `SMARTCART_FORECAST_SOURCE=postgres` in Production (and Preview only
   if it should read this database), then deploy the updated backend once. Confirm
   its price-history response matches the database generation and cutoff dates.
5. Future weekly publications become visible without redeployment. A code release
   is still required for changes to model logic or API behaviour.

An unpublished current-month file (HTTP 404) is recorded and skipped; the job can
use newer complete weeks from the latest published month. It never reuses a stale
cached current-month file for that run. Missing older inputs, corrupt files and
other download failures stop the job. Actual source dates remain unchanged.

If a weekly job fails or published data does not contain a newer complete week,
the job fails and does not relabel dates or publish old predictions as fresh.
GitHub Actions failure notifications require the responsible maintainers to
subscribe. The old version can subsequently age out: a failed job is not a
guarantee that forecasts remain available through marking.

## Local generation and checks

Install `forecasting/requirements.txt` in an offline-generation environment,
separate from the API runtime. CPU torch is sufficient. To generate a candidate:

```powershell
python -m forecasting.refresh --source backend/data/price_forecasts.json --output .tmp/forecast-refresh/candidate.json
```

Existing local raw files and checkpoint cache can be used with `--offline`,
`--raw-dir` and `--model-cache`; required recent months must all exist.

```powershell
python -m pytest forecasting/tests -q
```

For the three database transaction tests, set `FORECAST_TEST_DATABASE_URL` to an
explicit test database. Tests create and remove a uniquely named isolated schema.
The weekly workflow supplies a disposable PostgreSQL service for these tests.

## Rollback

With a verified retained batch ID, switch `price_forecast_active.batch_id` to that
existing ID inside a transaction. Confirm API generation/cutoff afterwards.
Rollback does not extend the prior version's freshness or modify its dates.
`SMARTCART_FORECAST_SOURCE=file` remains a deployment-level fallback to the
committed reference artifact; it should be chosen explicitly and checked for age.
