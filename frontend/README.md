# SmartCart frontend

This is the Next.js development copy of the Iteration 1 React prototype. The mobile-first UI and visual system have been retained and extended for the current Iteration 1 epics.

## Run locally

1. Start the FastAPI service by following [`../backend/README.md`](../backend/README.md).
2. Install Node.js 22 and pnpm.
3. Copy `.env.example` to `.env.local`; its default points to the local FastAPI
   service.
4. Run `pnpm install`.
5. Reapply `../database/schema.sql` to the database if needed.
6. Prepare a small coordinate batch with
   `pnpm sync:premise-locations -- --limit=100`, or use `--all` for the full
   premise set after reviewing quota. This script reads server credentials from
   `../backend/.env`.
7. Run `pnpm dev` and open `http://localhost:3000`.

## Current implementation

The live item search and the location and recommendation flow all call the
FastAPI service. Typed request and response shapes are in `lib/contracts.ts`;
browser calls are in `lib/api.ts` and `lib/api-client.ts`.

The UI covers:

- item search, category browsing, item details, quantities, editing, removal and basket review;
- device geolocation or Malaysia-restricted Google location autocomplete;
- distance- or time-based travel limits for walking, public transport,
  motorcycle, and car;
- reachable single-premise recommendations ranked by priced basket subtotal
  plus estimated return travel cost, with complete and incomplete basket tabs
  and per-store item-price breakdowns;
- privacy-preserving preference storage that excludes the selected origin;
- expensive-item flags, immediate-cost versus unit-value alternatives, applying an alternative, and potential savings;
- explicit verified, candidate, and unverified SARA store statuses without
  treating automated matches as verified.

## FastAPI endpoints

- `GET /api/items/search?q=&limit=` searches the live PriceCatcher catalogue.
- `GET /api/locations/autocomplete?query=&sessionToken=` proxies Places
  Autocomplete (New) without exposing the API key.
- `POST /api/locations/resolve` resolves a selected Place ID to an address and
  coordinates.
- `POST /api/recommendations` queries PostgreSQL for nearby premise candidates,
  requests a bounded Google route matrix, applies the chosen travel limit, and
  retrieves current store-level basket prices, and returns the combined-cost
  ranking with transparent missing-price coverage.

Run `pnpm lint` and `pnpm build` here and `python -m pytest` in `../backend`
before handoff. See
[`../docs/recommendation-engine.md`](../docs/recommendation-engine.md) for the
algorithm, assumptions, provider costs, data preparation, and known limits.

Missing store prices remain visible in each store's item-price list and are
excluded from its basket subtotal. Any store missing at least one basket price
is placed in the incomplete tab and cannot become the primary recommendation.
The UI must never convert missing SARA verification into an ineligible or
non-partner claim.
