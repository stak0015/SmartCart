# SmartCart basket-and-transport recommendation engine

Status: basket-price comparison added on 28 August 2026 after the live item flow
was connected.

## Provider decision

Use Google Places API (New) for location autocomplete and Place Details, Google
Geocoding for best-effort device-location labels, and Google Routes API
`computeRouteMatrix` for routes.

For environments without a Google Routes key, the API has a deliberate local
fallback: it returns the 25 nearest premises with fresh coordinates, uses
straight-line distance for the displayed distance and transport-cost estimate,
and marks travel time, travel limits, and route feasibility as unverified. This
keeps the recommendation flow usable without silently presenting approximate
values as Google routes.

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
2. SmartCart keeps the origin in React state only. Device coordinates are sent
   to `POST /api/locations/reverse` for a display address when a server-side
   Geocoding key is configured; an unavailable address never blocks nearby
   store search. Remembered local preferences exclude all origin labels,
   coordinates, and Place IDs.
3. `POST /api/recommendations` validates the basket item IDs and quantities,
   origin, transport mode, travel limit, and SARA filter.
4. PostgreSQL computes Haversine distance over fresh premise coordinates and
   selects the nearest candidates. For distance and combined limits, premises
   whose straight-line distance already exceeds the distance threshold are
   safely excluded when routed mode is enabled.
5. When `GOOGLE_ROUTES_API_KEY` is configured, one Google route-matrix request
   calculates one-way route distance and time from the origin to at most 25
   candidate Place IDs. The cap is configurable from 5 to 49. Transit stays
   below Google's 100-element request limit. When the key is absent, SmartCart
   skips Google Routes and keeps the 25 nearest fresh premises using
   straight-line distance plus mode-based planning speeds; the user's route
   limit is not treated as verified reachability.
6. SmartCart applies the user's limit to routed distance or exact route time
   only when Google route results are available. A combined limit uses an
   inclusive AND: both the route distance and route duration must be within
   their selected thresholds.
7. PostgreSQL retrieves each requested basket item's latest PriceCatcher price
   at every candidate premise. Quantity is applied to produce line totals and
   the store basket subtotal. Missing premise-item prices remain explicit nulls
   and are excluded from the subtotal.
8. The API ranks one unified store list by the number of requested basket lines
   with valid prices (descending). Ties use the available basket subtotal plus
   estimated return transport cost, then shorter time, route distance, name,
   and premise ID. Partial stores remain in the same list with an explicit
   coverage count and partial combined total; stores with no priced lines keep
   null basket and combined totals and sort last.
9. The API returns the full basket price breakdown for the UI's per-store
   "View item prices" control. Every priced response item also carries the
   English label from `item.item_name_en`; the official `item_name` is the
   Malay/original label and fallback.

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
| Public transport | Two RM1.00 base fares plus RM0.08 per return-trip kilometre; route estimates include walking to and from transit stops |
| Motorcycle | RM0.12 per return-trip kilometre |
| Car | RM0.45 per return-trip kilometre |

The formula is `2 x base fare per leg + 2 x one-way route km x per-km rate`.
These values are product assumptions, not verified Malaysian fares or a full
vehicle cost model. They exclude parking, tolls, ownership costs, physical
effort, accessibility barriers, and service reliability. Validate them with
the target community before presenting the ranking as user-ready. Override
them with the `TRAVEL_COST_*` environment variables.

## Basket-price calculation

For each store, `basket cost = sum(unit price x requested quantity)` for basket
lines that have a `current_status` record at that premise. The combined ranking
value is `basket cost + estimated return transport cost` whenever at least one
line is priced. A missing store price is not treated as zero or fabricated: it
is returned in the item breakdown with null price fields, labelled as
unavailable in the UI, and omitted from the sum. The response includes priced
and total basket-line counts plus an explicit completeness flag for backwards
compatibility. The UI uses one unified list, labels partial coverage and
combined totals clearly, and keeps combined totals null when no line is priced.

## SARA semantics

The API supports `any`, `candidate`, and `verified` filters. The current UI
offers `any` and `candidate` because the database has 1,407 strict automated
one-to-one candidates and no independently verified partner rows. Candidate
results are labelled as requiring verification. `NULL` is always treated as
not verified, never as false or ineligible.

## Privacy, security, and provider terms

- The Google API keys (`GOOGLE_PLACES_API_KEY`, `GOOGLE_ROUTES_API_KEY`, and
  `GOOGLE_GEOCODING_API_KEY`, or the legacy single `GOOGLE_MAPS_API_KEY`
  fallback) are server-only and must never use a `NEXT_PUBLIC_` prefix. Restrict
  each key to its own API and restrict its use to the deployed backend where
  the hosting platform allows it. `GOOGLE_ROUTES_API_KEY` may be omitted for
  local development; the API then returns the documented nearest-premises
  fallback. Provider requests use the bounded
  `GOOGLE_MAPS_REQUEST_TIMEOUT_SECONDS` setting.
- The selected origin is sent to Google for search, reverse lookup, or route
  calculation, but SmartCart does not persist it in PostgreSQL, local storage,
  or translation/enrichment tables and does not log request bodies or
  coordinate-bearing reverse-lookup failures. Reverse lookup returns a nullable
  display label; coordinates remain usable when the label is unavailable.
- API responses use `private, no-store`; all SQL values are parameterised;
  input length, coordinates, enums, and limit ranges are validated.
- Google-derived premise coordinates are used only as a temporary prefilter
  cache. The app excludes coordinates older than 29 days. Schedule
  `pnpm cleanup:premise-locations` daily to delete values older than 30 days,
  and refresh coordinates with `pnpm sync:premise-locations`.
- Do not display Google route content on a non-Google map. This implementation
  does not display a map and attributes location suggestions and route data to
  Google. "View route" links open Google Maps Directions with the selected
  origin, destination Place ID, and mode; Google Maps recomputes the route
  externally when the link is opened. SmartCart does not persist those links.
- Google requires a warning for walking and two-wheeler beta routes. The API
  returns this warning and the results screen displays it.

## Setup

1. Apply `database/schema.sql` to PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and configure the database URL
   and server-only Google key.
3. Enable Places API (New), Routes API, and Geocoding API for the configured
   server key(s). Set `GOOGLE_MAPS_REQUEST_TIMEOUT_SECONDS` within its bounded
   range when deployment needs a different provider timeout.
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
- When Google Routes is not configured, recommendations are the 25 nearest
  fresh premises by straight-line distance. The fallback estimates travel time
  and cost using mode speeds, does not verify the selected travel limit, and
  does not establish that a route or store is reachable.
- Public transit depends on Google's available schedule coverage at request
  time. A missing route is skipped, not treated as proof that transit is
  impossible.
- Walking and motorcycle routes are beta estimates and may omit suitable paths
  or restrictions.
- Store Place IDs are top-candidate enrichment, not PriceCatcher-published IDs;
  bad or stale matches can affect the result and need review monitoring.
- Missing prices are explicit unavailable values. A store with fewer priced
  basket lines may show a lower partial subtotal, so ranking gives coverage
  priority before comparing partial combined totals; the UI shows the coverage
  count and every missing line in one unified recommendation list.
- Before user testing, replace the default transport costs with validated local
  assumptions and define acceptance tests from the agreed LeanKit criteria.
