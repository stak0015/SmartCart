# SmartCart database

This directory contains the minimum local PostgreSQL setup and ingestion
workflow for the current three-table schema: `item`, `premise`, and
`current_status`.

New to Docker, Python, or command-line setup? Follow the step-by-step
[`SETUP_GUIDE.md`](SETUP_GUIDE.md) first.

The loader downloads official PriceCatcher item, premise, and current-year
monthly price files. It also reads the committed, dated premise-enrichment
snapshot so every developer gets the same candidate Place IDs.

## Files

- `schema.sql` — idempotent PostgreSQL schema.
- `SETUP_GUIDE.md` — beginner-friendly local setup and troubleshooting guide.
- `docker-compose.yml` — local PostgreSQL 16 service.
- `ingest_pricecatcher.py` — PriceCatcher download, validation, transformation,
  and idempotent database upserts.
- `verify_database.py` — post-ingestion integrity checks.
- `requirements.txt` — Python dependencies.
- `.env.example` — safe local configuration template.
- `tests/test_ingest_pricecatcher.py` — ingestion regression tests.
- `data/archive/lookup_premise_sara_one_to_one_2026-08-23.parquet` — dated
  premise-enrichment snapshot.
- `data/archive/lookup_premise_sara_one_to_one_2026-08-23_provenance.json` —
  snapshot checksum, source hashes, matching rule, and row counts.

Downloaded PriceCatcher files are reproducible local cache files under
`data/raw/` and are not committed.

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
stock. The loader retains only the latest six monthly PriceCatcher files
locally after a successful run.

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
