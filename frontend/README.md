# SmartCart frontend

This is the Next.js development copy of the Iteration 1 React prototype. The mobile-first UI and visual system have been retained and extended for the current Iteration 1 epics.

## Run locally

1. Install Node.js 22 and pnpm.
2. Copy `.env.example` to `.env.local` and set the backend URL when it is available.
3. Run `pnpm install`.
4. Run `pnpm dev` and open `http://localhost:3000`.

## Current implementation

The frontend uses representative in-component data so the complete flow can be developed before the API is available. Typed request and response shapes are in `lib/contracts.ts`, with the intended client calls in `lib/api-client.ts`.

The UI covers:

- item search, category browsing, item details, quantities, editing, removal and basket review;
- location, transport and travel-boundary preferences;
- cheapest reachable single-premise recommendations, five results initially, and additional results on request;
- expensive-item flags, immediate-cost versus unit-value alternatives, applying an alternative, and potential savings;
- verified SARA item and partner labels, optional partner-only filtering, and estimated credit/cash breakdowns.

## Intended backend endpoints

- `GET /api/items?query=&category=` searches official item records and returns eligibility as either `verified` or `unverified`.
- `POST /api/recommendations` accepts the basket and travel preferences, then returns reachable premises ordered by complete-basket total.

The backend must keep `price_observed_date` separate from ingestion time, must not imply that a listed price confirms stock, and must never convert missing SARA verification into an ineligible or non-partner claim.
