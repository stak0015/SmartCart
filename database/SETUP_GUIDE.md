# SmartCart local database setup guide

This guide is for team members who have little or no experience with Python,
Docker, PostgreSQL, or command-line tools. Follow the steps in order. You do
not need to install PostgreSQL separately.

When you finish, your computer will have its own local SmartCart database with:

- PriceCatcher items and premises;
- the latest current-year price for each item-premise pair;
- the committed candidate Google Place IDs; and
- the 1,407 strict one-to-one SARA candidate matches used for development.

Each team member gets a separate local database. Running these steps does not
change another team member's database.

## A few useful terms

- **Repository:** the SmartCart project folder downloaded from Git.
- **Terminal:** an application in which you type commands. On Windows, use
  PowerShell. On macOS, use Terminal.
- **Docker:** runs PostgreSQL in an isolated local container.
- **PostgreSQL:** the database used by SmartCart.
- **Python virtual environment:** a project-specific Python installation under
  `.venv` that prevents package conflicts with other projects.
- **Ingestion:** downloading, checking, and loading source data into PostgreSQL.

## Before you begin

Install these applications:

1. Git.
2. Docker Desktop. Open it and wait until it says Docker is running.
3. Python 3.11 or later.

Restart PowerShell or Terminal after installing them. Then check each tool:

```text
git --version
docker --version
docker compose version
python --version
```

Every command should print a version number. On Windows, if `python` is not
recognised, try:

```powershell
py --version
```

If `py` works, use `py -m venv .venv` instead of
`python -m venv .venv` in Step 4.

## Step 1: Download the project

Open PowerShell or Terminal in the folder where you keep university projects.
Ask a team member for the repository URL, then run:

```text
git clone <REPOSITORY_URL>
```

Do not type `<REPOSITORY_URL>` literally. Replace it with the URL supplied by
your team.

Move into the database folder. If the cloned folder is named `SmartCart`:

```text
cd SmartCart/database
```

Windows also accepts:

```powershell
cd SmartCart\database
```

If you already cloned the repository, open its `SmartCart/database` folder in
PowerShell or Terminal instead.

Confirm that you are in the correct folder:

```text
git status
```

You should also be able to see files such as `schema.sql`,
`docker-compose.yml`, and `ingest_pricecatcher.py`.

## Step 2: Create your local settings file

The project contains `.env.example`, which is a safe template. Copy it to a new
file named `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

The `.env` file contains local database settings. Git ignores it, so do not
force-add or share it. The default password is only for local development.

## Step 3: Start PostgreSQL

Make sure Docker Desktop is open. From `SmartCart/database`, run:

```text
docker compose up -d
```

The first run may download the PostgreSQL image. This is normal. The `-d`
option keeps PostgreSQL running in the background.

Check its status:

```text
docker compose ps
```

Wait until the `smartcart-postgres` row says `healthy`. If it says `starting`,
wait about 10 seconds and run `docker compose ps` again.

On its first start, PostgreSQL automatically creates the three SmartCart tables
from `schema.sql`.

## Step 4: Create the Python environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

If Windows only recognises `py`, use this for the first command:

```powershell
py -m venv .venv
```

Then run the other two commands exactly as shown.

macOS/Linux:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
```

The commands intentionally use Python inside `.venv`; you do not need to
activate the environment. Package installation may take a few minutes.

## Step 5: Ingest the data

An internet connection is required because the loader downloads official
PriceCatcher files. It does not call Google Places and does not need an API key.

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe ingest_pricecatcher.py
```

macOS/Linux:

```bash
./.venv/bin/python ingest_pricecatcher.py
```

The initial run downloads each month from January through the current Malaysia
month. It may take several minutes. Messages beginning with `Downloading`,
`Reading`, or `Preparing` are normal.

A successful run ends with:

```text
Ingestion complete.
```

After the initial catalogue load, populate the canonical English item labels.
On a database that previously used the retired `item_translation` table, run
the migration first:

```powershell
.\.venv\Scripts\python.exe migrate_item_name_en.py
.\.venv\Scripts\python.exe seed_item_names.py
```

The checked-in seed covers all 757 current lookup rows. The one official row
whose source name is blank intentionally remains `NULL` in `item_name_en`.

Warnings about source observations missing official lookup rows are expected.
Those observations are skipped instead of inventing item or premise details.

The committed premise-enrichment snapshot is checked against its SHA-256 before
being loaded. It provides the same Place IDs and SARA candidate flags to every
team member without making external place-search requests.

## Step 6: Verify the database

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe verify_database.py
```

macOS/Linux:

```bash
./.venv/bin/python verify_database.py
```

The row counts change as PriceCatcher is updated. The important final line is:

```text
Verification passed.
```

The verification should also report 1,407 one-to-one SARA candidates for the
currently committed enrichment snapshot.

## Step 7: Run the automated tests

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

macOS/Linux:

```bash
./.venv/bin/python -m unittest discover -s tests -v
```

The result should end with `OK`. Deprecation warnings from `fastparquet` do not
mean the tests failed; use the final `OK` or `FAILED` line.

## Setup complete

Your local database is ready when all three statements are true:

- `docker compose ps` reports `healthy`;
- `verify_database.py` prints `Verification passed.`; and
- the tests finish with `OK`.

You do not need to repeat the full setup every day.

## Normal daily use

### Start the database after restarting your computer

Open Docker Desktop, return to `SmartCart/database`, and run:

```text
docker compose up -d
```

### Refresh the current month's prices

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe ingest_pricecatcher.py --month
.\.venv\Scripts\python.exe verify_database.py
```

macOS/Linux:

```bash
./.venv/bin/python ingest_pricecatcher.py --month
./.venv/bin/python verify_database.py
```

### Stop PostgreSQL without deleting data

```text
docker compose stop
```

Start it again later with:

```text
docker compose start
```

## After pulling project updates

From the repository, get your team's latest changes:

```text
git pull
```

Return to `SmartCart/database`, ensure Docker is running, and update the Python
packages:

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

macOS/Linux:

```bash
./.venv/bin/python -m pip install -r requirements.txt
```

If the team says `schema.sql` changed, apply it to the existing Docker database:

```text
docker compose exec -T postgres psql -U smartcart -d smartcart -f /docker-entrypoint-initdb.d/001_schema.sql
```

If the database was created before pack-size comparisons were added, backfill
the normalized item quantities used for per-unit comparisons:

Windows PowerShell:

```powershell
python migrate_pack_quantities.py
```

macOS/Linux:

```bash
./.venv/bin/python migrate_pack_quantities.py
```

The migration is transactional and safe to run more than once. It uses the
existing item `unit` value first, falls back to the item name, and leaves
non-comparable quantities unset.

## Demonstrate budget alternatives with stable data

For a repeatable browser walkthrough, start the isolated demo database from
`SmartCart/database`:

Windows PowerShell:

```powershell
docker compose -f docker-compose.demo.yml up -d
python seed_demo_alternatives.py
```

macOS/Linux:

```bash
docker compose -f docker-compose.demo.yml up -d
./.venv/bin/python seed_demo_alternatives.py
```

Temporarily point the backend `DATABASE_URL` at
`postgresql://smartcart:smartcart_dev_password@127.0.0.1:5434/smartcart_demo`
before starting the API. The seed prints the demo premise ID and can be safely
rerun; it removes only rows owned by the `SMARTCART-DEMO-` fixture.

The fixture includes a same-pack cheaper equivalent (425 g sardine at RM9.00
versus RM10.50) and lower unit-price pack options (850 g sardine at RM19.00/kg
and 2 litre corn oil at RM10.00/litre).

Then refresh and verify the data. If only the committed premise-enrichment file
changed, you can apply it without downloading PriceCatcher again:

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe ingest_pricecatcher.py --enrichment-only
```

macOS/Linux:

```bash
./.venv/bin/python ingest_pricecatcher.py --enrichment-only
```

## Understanding the SARA fields

- `sara_match_candidate = TRUE` means the PriceCatcher premise and one SARA
  merchant shared the same top candidate Place ID in the strict one-to-one
  matching snapshot.
- `sara_partner = NULL` means the partnership status has not been independently
  verified.
- `sara_match_candidate = FALSE` does **not** mean the premise is not a SARA
  partner. It only means the strict automated rule did not produce a match.

During development, use `sara_match_candidate` when testing SARA-aware screens
and label the result as an automated match rather than a verified fact.

## Common problems

### `docker` is not recognised

Install Docker Desktop, restart PowerShell or Terminal, and make sure Docker
Desktop is running.

### Cannot connect to the Docker daemon

Open Docker Desktop and wait for it to finish starting. On Windows, also check
that Docker Desktop is configured to use WSL 2 if your installation requires
it.

### Port 5432 is already in use

Another PostgreSQL installation may already use the default port. Open `.env`
in a text editor and change both occurrences of `5432` to another unused port,
for example `55432`:

```dotenv
POSTGRES_PORT=55432
DATABASE_URL=postgresql://smartcart:smartcart_dev_password@127.0.0.1:55432/smartcart
```

Save the file and run `docker compose up -d` again.

### `python` is not recognised

Reinstall Python and enable its option to add Python to `PATH`. On Windows,
try `py -m venv .venv` if the Python launcher is available.

### `No module named pandas`, `fastparquet`, or `psycopg`

The packages were not installed in `.venv`, or the wrong Python executable was
used. Repeat Step 4 and use the `.venv` Python path shown in this guide.

### `DATABASE_URL is not set`

Make sure you completed Step 2 and that the file is named exactly `.env`, not
`.env.txt`.

### Connection refused

Run `docker compose ps`. If PostgreSQL is stopped, run `docker compose up -d`.
Also make sure the port in `DATABASE_URL` matches `POSTGRES_PORT` in `.env`.

### A download fails

Check your internet connection and rerun the ingestion command. Completed,
non-empty downloads remain in `data/raw/` and can be reused with:

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe ingest_pricecatcher.py --use-cache
```

macOS/Linux:

```bash
./.venv/bin/python ingest_pricecatcher.py --use-cache
```

### Premise enrichment checksum does not match

Do not bypass the check. The committed Parquet or provenance file may be
incomplete or modified. Restore those two files from Git or ask a team member
for a clean copy, then rerun ingestion.

### See PostgreSQL logs

```text
docker compose logs postgres
```

## Reset only when necessary

The following reset permanently deletes your local PostgreSQL data and rebuilds
an empty database. It does not delete source code, but you must ingest the data
again afterward.

```text
docker compose down -v
docker compose up -d
```

Then repeat Steps 5, 6, and 7. Do not add `-v` when you merely want to stop or
restart PostgreSQL.

## Files that must stay private or local

Never commit or share:

- `.env`;
- `.venv/`;
- database passwords or API keys;
- files downloaded into `data/raw/`; or
- temporary logs and Python cache files.

The project's `.gitignore` already excludes these files. If unsure, ask a team
member to review `git status` before committing.

## Quick checklist

- [ ] Git, Docker Desktop, and Python are installed.
- [ ] PowerShell or Terminal is open in `SmartCart/database`.
- [ ] `.env` was copied from `.env.example`.
- [ ] `docker compose ps` reports PostgreSQL as `healthy`.
- [ ] Python dependencies were installed into `.venv`.
- [ ] Initial ingestion finished with `Ingestion complete.`.
- [ ] Database verification finished with `Verification passed.`.
- [ ] Automated tests finished with `OK`.
