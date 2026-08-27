# SmartCart transport-first recommendation engine

Status: implemented for Iteration 1 on 25 August 2026. Basket-price comparison
is deliberately out of scope until the live item flow is connected.

## Provider decision

Use Google Places API (New) for location autocomplete and Place Details, and
Google Routes API `computeRouteMatrix` for routes.

This is the best initial cost-to-capability fit because one provider supports
all four required modes in Malaysia: walking, public transit, car, and
motorised two-wheeler. Google's two-wheeler coverage list explicitly includes
Malaysia. Openrouteservice is useful for a no-cost walking/driving prototype,
but its hosted profiles do not solve the public-transit requirement; using two
providers would also create inconsistent location and route behaviour.

Pricing checked on 25 August 2026:

- Compute Route Matrix Essentials: 10,000 free elements per month, then USD 5
  per 1,000 at the first paid tier.
- Autocomplete Requests: 10,000 free requests per month, then USD 2.83 per
  1,000 at the first paid tier. Valid session tokens are used.
- Place Details Essentials: 10,000 free requests per month, then USD 5 per
  1,000 at the first paid tier.

Billing must still be enabled. Configure daily quotas and budget alerts in
Google Cloud. Official references:

- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Routes API usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing)
- [Routes API travel modes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode)
- [Malaysia two-wheeler coverage](https://developers.google.com/maps/documentation/routes/coverage-two-wheeled)
- [Places Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)
- [Google Maps Platform service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [Openrouteservice plans](https://openrouteservice.org/plans/)

Provider pricing and terms can change. Recheck these sources before deployment.

## Request flow

1. The user either permits browser geolocation or types at least three
   characters and selects a Malaysia-restricted Google autocomplete result.
2. SmartCart keeps the origin in React state only. Remembered local preferences
   exclude all origin labels, coordinates, and Place IDs.
3. `POST /api/recommendations` validates the origin, transport mode, travel
   limit, and SARA filter.
4. PostgreSQL computes Haversine distance over fresh premise coordinates and
   selects the nearest candidates. For a distance limit, premises whose
   straight-line distance already exceeds the limit are safely excluded.
5. One Google route-matrix request calculates one-way route distance and time
   from the origin to at most 25 candidate Place IDs. The cap is configurable
   from 5 to 49. Transit stays below Google's 100-element request limit.
6. SmartCart applies the user's limit to routed distance or exact route time.
7. Reachable stores are ordered by estimated return travel cost, then shorter
   time, route distance, name, and premise ID for deterministic ties.

At the default 25-candidate cap, one recommendation costs no more than 25 route
matrix elements, so the current 10,000-element free cap supports about 400 full
comparisons per month. Reducing the cap lowers cost but increases the chance
that a useful store is not evaluated, particularly for a time-based limit.

## Travel-cost assumptions

Routes does not provide a comparable fare or operating cost for every mode, so
the engine uses transparent, configurable planning assumptions. Defaults are:

| Mode | Default return-trip estimate |
| --- | --- |
| Walking | RM0 direct monetary cost |
| Public transport | Two RM1.00 base fares plus RM0.08 per return-trip kilometre |
| Motorcycle | RM0.12 per return-trip kilometre |
| Car | RM0.45 per return-trip kilometre |

The formula is `2 x base fare per leg + 2 x one-way route km x per-km rate`.
These values are product assumptions, not verified Malaysian fares or a full
vehicle cost model. They exclude parking, tolls, ownership costs, physical
effort, accessibility barriers, and service reliability. Validate them with
the target community before presenting the ranking as user-ready. Override
them with the `TRAVEL_COST_*` environment variables.

## SARA semantics

The API supports `any`, `candidate`, and `verified` filters. The current UI
offers `any` and `candidate` because the database has 1,407 strict automated
one-to-one candidates and no independently verified partner rows. Candidate
results are labelled as requiring verification. `NULL` is always treated as
not verified, never as false or ineligible.

## Privacy, security, and provider terms

- `GOOGLE_MAPS_API_KEY` is server-only and must never use a `NEXT_PUBLIC_`
  prefix. Restrict it to Places API (New) and Routes API, and restrict its use
  to the deployed backend where the hosting platform allows it.
- The selected origin is sent to Google for search or route calculation, but
  SmartCart does not persist it in PostgreSQL or local storage and does not log
  request bodies.
- API responses use `private, no-store`; all SQL values are parameterised;
  input length, coordinates, enums, and limit ranges are validated.
- Google-derived premise coordinates are used only as a temporary prefilter
  cache. The app excludes coordinates older than 29 days. Schedule
  `pnpm cleanup:premise-locations` daily to delete values older than 30 days,
  and refresh coordinates with `pnpm sync:premise-locations`.
- Do not display Google route content on a non-Google map. This implementation
  does not display a map and attributes location suggestions and route data to
  Google.
- Google requires a warning for walking and two-wheeler beta routes. The API
  returns this warning and the results screen displays it.

## Setup

1. Apply `database/schema.sql` to PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and configure the database URL
   and server-only Google key.
3. Enable Places API (New) and Routes API for the key.
4. From `frontend`, run `pnpm sync:premise-locations -- --limit=100` for a
   controlled test batch. Review quota, then use `--all` when ready.
5. From `backend`, install `requirements-dev.txt` and run
   `uvicorn main:app --reload --port 8000`.
6. Copy `frontend/.env.example` to `frontend/.env.local`, then run `pnpm dev`.
7. Before handoff, run `python -m pytest` in `backend`, then `pnpm lint` and
   `pnpm build` in `frontend`.

## Known limits and next steps

- Time-limit searches evaluate only the nearest configured candidate count by
  straight-line distance, so they are bounded rather than exhaustive.
- Public transit depends on Google's available schedule coverage at request
  time. A missing route is skipped, not treated as proof that transit is
  impossible.
- Walking and motorcycle routes are beta estimates and may omit suitable paths
  or restrictions.
- Store Place IDs are top-candidate enrichment, not PriceCatcher-published IDs;
  bad or stale matches can affect the result and need review monitoring.
- Add basket completeness and current observed prices only after the live item
  IDs are connected. The intended future ranking should expose the trade-off
  between basket cost and return travel cost rather than hide it in one opaque
  score.
- Before user testing, replace the default transport costs with validated local
  assumptions and define acceptance tests from the agreed LeanKit criteria.
