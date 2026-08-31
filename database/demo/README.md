# SmartCart demo database

This is a small, isolated PostgreSQL database for demonstrating the catalogue,
recommendation, SARA, stale-price, incomplete-basket, and cheaper-alternative
flows without relying on the live PriceCatcher data or Google APIs.

From `SmartCart/database`, start it with:

```powershell
docker compose -f docker-compose.demo.yml up -d
```

The first start creates `smartcart_demo` on port `5434`, applies the normal
schema, and loads `demo/002_demo_seed.sql`. The seed is intentionally small and
deterministic. To reload it from scratch:

```powershell
docker compose -f docker-compose.demo.yml down -v
docker compose -f docker-compose.demo.yml up -d
```

The `current_status` rows are mock latest transaction observations, with
different observation dates so freshness and stale-price behaviour can be
demonstrated without downloading live PriceCatcher files.

Enable the backend against this database by setting the following in
`backend/.env`:

```dotenv
SMARTCART_DEMO_MODE=true
DEMO_DATABASE_URL=postgresql://smartcart:smartcart_dev_password@127.0.0.1:5434/smartcart_demo
```

Demo mode supplies a selectable `SmartCart Demo Centre` location, forces the
deterministic straight-line route path, and never calls Google. The five seeded
premises cover verified/candidate/unverified SARA states, complete and
incomplete baskets, fresh and stale observations, cheaper equivalents, and
items with no cheaper equivalent. Prices are illustrative only.

Suggested walkthrough:

1. Search for `beras`, add `BERAS CAP JIMAT (5KG)`, then choose `SmartCart Demo
   Centre` as the starting location. `Demo Mart Central` offers the cheaper
   `BERAS CAP NILAI (5KG)` swap.
2. Add `SUSU CAIR CAP SEGAR (1L)` and `SARDIN CAP AYAM (425G)` to demonstrate
   multiple alternatives at once. The sardine source has no cheaper match at
   `Demo Grocer Budget`.
3. Add `KERTAS TISU CAP KELUARGA (4 ROLL)` and select `Demo Fresh Corner` to
   see a complete basket with no alternatives and stale-price notices.
4. Select `Demo Market Missing` to see the incomplete-basket tab and an
   explicitly missing price.
