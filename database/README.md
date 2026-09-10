# SmartCart database

This directory contains the minimum local PostgreSQL setup and ingestion
workflow for `item`, `premise`, and `current_status`, plus the code-keyed
English item labels used by the catalogue lookup.

New to Docker, Python, or command-line setup? Follow the step-by-step
[`SETUP_GUIDE.md`](SETUP_GUIDE.md) first.

The loader downloads official PriceCatcher item, premise, and current-year
monthly price files. It also reads the committed, dated premise-enrichment
snapshot so every developer gets the same candidate Place IDs.

## Files

- `schema.sql` — idempotent PostgreSQL schema.
- `docker-compose.demo.yml` — isolated PostgreSQL service for deterministic UI demos.
- `migrate_pack_quantities.py` — idempotent upgrade for existing databases;
  backfills normalized item pack quantities used by pack comparisons.
- `migrate_median_prices.py` — repeatable upgrade and full backfill for the
  cached cross-store item median price.
- `migrate_premise_open_status.py` — repeatable, provider-free import of the
  maintained Place ID, open/closed status, and selected Place coordinate
  snapshot into local PostgreSQL or Neon.
- `seed_demo_alternatives.py` — repeatable fixture for cheaper-equivalent and
  lower-unit-price recommendations.
- `SETUP_GUIDE.md` — beginner-friendly local setup and troubleshooting guide.
- `docker-compose.yml` — local PostgreSQL 16 service.
- `ingest_pricecatcher.py` — PriceCatcher download, validation, transformation,
  and idempotent database upserts.
- `migrate_item_name_en.py` — idempotent upgrade from the retired
  `item_translation` table to `item.item_name_en`.
- `seed_item_names.py` — repeatable code-keyed English-name seed/export for the
  complete lookup catalogue.
- `seed_category_translations.py` — optional category-label seed; category
  translations remain separate from item names.
- `verify_database.py` — post-ingestion integrity checks.
- `requirements.txt` — Python dependencies.
- `.env.example` — safe local configuration template.
- `tests/test_ingest_pricecatcher.py` — ingestion regression tests.
- `tests/test_migrate_pack_quantities.py` — migration idempotence coverage.
- `tests/test_migrate_median_prices.py` — cached median refresh and migration
  SQL coverage.
- `tests/test_seed_demo_alternatives.py` — demo fixture behavior coverage.
- `data/archive/lookup_premise_sara_one_to_one_2026-08-23.parquet` — dated
  premise-enrichment snapshot.
- `data/archive/lookup_premise_sara_one_to_one_2026-08-23_provenance.json` —
  snapshot checksum, source hashes, matching rule, and row counts.
- `data/item_name_en.csv` — 757 code-keyed English item names (the one blank
  official source row intentionally has a blank English value).

Downloaded PriceCatcher files are reproducible local cache files under
`data/raw/` and are not committed.

## Premise open/closed status

`data/raw/lookup_premise_enriched_postcode_place_id.csv` is the maintained
local enrichment output used for premise Place IDs and business state. The
matching `.cache.json` contains the selected Place-details coordinates, which
are intentionally absent from the CSV. Import both after the base
PriceCatcher premises exist:

```powershell
# Uses DATABASE_URL from database/.env (normally local PostgreSQL).
python migrate_premise_open_status.py

# Validate a refreshed CSV without changing a database or calling Google.
python migrate_premise_open_status.py --prepare-only

# Apply the same validated snapshot to Neon using its pooled or direct URL.
python migrate_premise_open_status.py --database-url $env:NEON_DATABASE_URL
```

For the Vercel-managed `smart-cart` Neon resource, run from the repository root
so `backend/.env` cannot override the injected production value:

```powershell
npx vercel env run -e production --project smart-cart --scope tm-17 -- python database/migrate_premise_open_status.py
```

The command should report a `*.neon.tech` target when independently checking
the injected URL. Do not run the production migration from `backend/`, where a
local `DATABASE_URL` file may take precedence.

The migration is safe to repeat and does not call Google. It records the CSV's
`open_closed_status` and the adjacent provenance file's `generated_at` value.
For coordinates it uses only `place_latitude` and `place_longitude` from the
selected `place_id`; the cache's separate postcode-geocoding coordinates are
never imported. A Place ID mismatch between the CSV and cache fails before a
database connection is made. The cache's `place_match_decision` is
authoritative for rejected candidates: every rejected premise has its Place ID,
coordinates, open/closed status, and related refresh timestamps cleared. This
also removes a previously imported open candidate from store results. SARA
matching and PriceCatcher history are not changed by this cleanup.
Only `open` is eligible for display. `closed_permanently`,
`closed_temporarily`, `unknown`, and missing (`NULL`) values must all be
excluded from store results. The value describes the last imported business
state for an automated Google Place candidate; it is not a live opening-hours
check. Regenerate and review the enrichment before refreshing stale data.
This import is intentionally separate from the normal PriceCatcher refresh:
daily price ingestion preserves statuses already stored on matching premises,
while a newly published premise remains `NULL` (and therefore hidden) until a
refreshed enrichment CSV is generated and this migration is rerun.

## Enrichment status

The committed snapshot contains 3,803 PriceCatcher top-candidate Place IDs.
Of these, 1,407 share the top Place ID with exactly one SARA merchant on both
sides. The loader records these rows as `sara_match_candidate = TRUE` so they
can be used consistently during development without individual review.

In PostgreSQL, the loader stores the candidate `google_place_id`,
`place_match_refreshed_at`, and `sara_match_candidate`. It does **not** set
`sara_partner = TRUE`; unverified partner status remains `NULL`.
The schema has no field for an unverified SARA merchant identity, so that
candidate detail stays in the Parquet snapshot until a reviewed enrichment
design is approved.

The PriceCatcher premise lookup remains authoritative for premise names and
addresses. The snapshot is joined by `premise_code` and cannot replace those
official fields. Its SHA-256 is checked against the provenance file before any
database connection is made.

## Routing coordinate cache

`premise.latitude`, `premise.longitude`, `location_provider`, and
`location_refreshed_at` support a cheap straight-line prefilter before calling
the route matrix. They are routing enrichment, not PriceCatcher fields. The
ingestion upsert preserves them.

For an `open` selected Place coordinate, the premise Place migration sets
`location_provider = 'google'` and uses the cache's generation time as the last
available provider-cache timestamp. The cache format has no per-row retrieval
timestamp. Non-open, unknown, and status-less cache rows clear Google routing
coordinates that are not newer than the cache so unnecessary provider data is
not retained. A newer coordinate is preserved. `place_match_refreshed_at` is
also advanced to the cache generation time when a selected Place ID matches.
The migration never writes a user's selected origin.

When `location_provider = 'google'`, latitude and longitude are a temporary
cache. The recommendation query uses only coordinates refreshed within the
configured maximum age (29 days by default). Run the frontend maintenance
commands from `SmartCart/frontend`:

```powershell
# Remove Google coordinate caches older than 30 days. Schedule this daily.
pnpm cleanup:premise-locations

# Remove expired values, then refresh at most 100 missing or stale premises.
pnpm sync:premise-locations -- --limit=100

# Deliberately refresh all missing or stale premises after checking API quota.
# The sync defaults to 300 requests/minute and retries temporary quota errors.
pnpm sync:premise-locations -- --all

# Override the pacing only when the project's per-minute quota permits it.
pnpm sync:premise-locations -- --all --requests-per-minute=600
```

The cleanup schedule is mandatory when Google-derived coordinates are cached.
Place IDs may be retained, but cached Google latitude/longitude values must be
removed after 30 consecutive days. The user's selected origin is never written
to these columns or any other SmartCart table.

## Local setup

Install Docker Desktop and Python 3.11 or later. From `SmartCart/database`:

```powershell
Copy-Item .env.example .env
docker compose up -d

python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

On macOS/Linux, activate the environment with `source .venv/bin/activate`.

The first Docker start creates the database and applies `schema.sql`. Wait for
`docker compose ps` to report the service as healthy.

## Initial ingestion

Run:

```powershell
python ingest_pricecatcher.py
python verify_database.py
python -m unittest discover -s tests -v
```

The default initial load downloads January through the current Malaysia month,
then keeps the latest observation for every item-premise pair. Records whose
item or premise code is absent from the official lookup are skipped and
counted. Older observations cannot replace newer database rows.

### Upgrade an existing database for pack comparisons

Databases created before pack-size comparisons were added may not have the
`item.quantity_value` and `item.quantity_unit` columns. Run this migration from
`SmartCart/database`; it does not download PriceCatcher files and is safe to
repeat:

```powershell
python migrate_pack_quantities.py
```

The migration parses the existing `unit` value first, falls back to the item
name, stores weights in kilograms and volumes in litres, and leaves
non-comparable items as `NULL`. `verify_database.py` reports the resulting
coverage and fails when the columns are missing.

### Cache cross-store median prices

`item.median_price_rm` stores the continuous median of all positive
`current_status.current_price` values for that item across premises, rounded to
the nearest cent. It is refreshed in the same transaction as PriceCatcher
ingestion, but only for item IDs present in the incoming batch; the aggregate
still reads every current status for each touched item. This keeps normal price
display queries from running a median aggregate for every request. Items with
no valid store price retain `NULL`, not a fabricated zero.

For an existing database, run the repeatable full backfill from
`SmartCart/database`:

```powershell
python migrate_median_prices.py
```

The backfill clears stale cached values and recomputes them from the latest rows
already in `current_status`. As with the source prices, a median can be based on
an older observation when a premise has not reported a newer price; the cache
does not claim current stock or freshness.

### Add English catalogue labels

English labels are stored directly on each `item` lookup row. On an existing
database, first migrate any labels left by the retired translation table, then
apply the complete code-keyed seed:

```powershell
python migrate_item_name_en.py
python seed_item_names.py
```

Both commands load `database/.env` then `backend/.env`; existing process
environment variables take precedence. The migration copies existing English
rows by `item_id`, drops the obsolete `item_translation` table, and is safe to
rerun. The seed matches by stable `item_code`, covers all 757 current lookup
rows, and leaves an intentionally blank source name as `NULL`. New
PriceCatcher rows without a checked-in label keep `item_name_en` as `NULL`; the
API falls back to the official source name until a reviewed label is added.

### Demonstrate budget alternatives with stable data

Use the isolated demo database when you need a reliable browser walkthrough.
From `SmartCart/database`:

```powershell
docker compose -f docker-compose.demo.yml up -d
python seed_demo_alternatives.py
```

Point the backend at the printed demo database URL before starting it (the
default is `postgresql://smartcart:smartcart_dev_password@127.0.0.1:5434/smartcart_demo`).
The seed is repeatable and removes only rows whose codes begin with
`SMARTCART-DEMO-`.

The fixture demonstrates both behaviors:

- `SARDIN CAP AYAM (SOS TOMATO)` 425 g at RM10.50 has a strict same-pack
  cheaper equivalent, `SARDIN CAP KING CUP (SOS TOMATO)` at RM9.00.
- The 850 g sardine pack is the best unit value at RM19.00/kg; the 2 litre
  Daisy corn-oil pack is the best oil value at RM10.00/litre.

Useful options:

```powershell
# Reuse existing non-empty downloads.
python ingest_pricecatcher.py --use-cache

# Download, validate, and transform without changing PostgreSQL.
python ingest_pricecatcher.py --use-cache --prepare-only

# Deliberately omit the committed candidate Place IDs.
python ingest_pricecatcher.py --no-premise-enrichment

# Apply only the committed Place IDs and SARA candidate flags to an existing DB.
python ingest_pricecatcher.py --enrichment-only
```

## Daily refresh

Refresh the growing current-month PriceCatcher file once per day:

```powershell
python ingest_pricecatcher.py --month
python verify_database.py
```

`price_observed_date` is the source observation date and `price_synced_at` is
the ingestion time. A PriceCatcher price does not prove that an item is in
stock. Each successful refresh also updates `item.median_price_rm` for touched
items. The loader retains only the latest six monthly PriceCatcher files locally
after a successful run.

## Local and committed data

Never commit:

- `.env`, `.venv/`, caches, or logs;
- API keys or database passwords; or
- raw SARA collection, candidate-search, and manual-review working files.

The dated enrichment Parquet and provenance JSON are the only committed data
artifacts. Keep repository access within the project team unless the scope of
the SARA collection approval and redistribution rights have been confirmed for
public release.

## Reset

Reapply the schema without deleting data:

```powershell
psql $env:DATABASE_URL -f schema.sql
```

For an intentional Docker-only reset:

```powershell
docker compose down -v
docker compose up -d
```

`docker compose down -v` permanently deletes the local database volume. It
does not delete files under `data/`.

## Sources

- [PriceCatcher transactions](https://data.gov.my/data-catalogue/pricecatcher)
- [PriceCatcher item lookup](https://data.gov.my/data-catalogue/lookup_item)
- [PriceCatcher premise lookup](https://data.gov.my/data-catalogue/lookup_premise)

The publisher marks the PriceCatcher datasets as CC BY 4.0. Preserve
attribution in the product, documentation, and derived outputs.
