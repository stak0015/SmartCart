# SmartCart basket-and-transport recommendation engine

Status: basket-price comparison added on 28 August 2026 after the live item flow
was connected.

## Provider decision

Use Google Places API (New) for location autocomplete and Place Details, Google
Geocoding for best-effort device-location labels, and Google Routes API
`computeRouteMatrix` for routes.

For environments without a Google Routes key, the API has a deliberate local
fallback: it returns the 25 nearest premises with stored coordinates, uses
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
4. PostgreSQL first excludes every premise whose last imported Google business
   state is not exactly `open`, then computes Haversine distance over stored
   premise coordinates and selects the nearest candidates. `unknown`, missing,
   temporarily closed, and permanently closed states are all excluded. This is
   an operational business state from the maintained snapshot, not a live
   opening-hours or "open now" check. For distance and combined limits,
   premises whose straight-line distance already exceeds the distance threshold
   are safely excluded when routed mode is enabled.
5. When `GOOGLE_ROUTES_API_KEY` is configured, one Google route-matrix request
   calculates one-way route distance and time from the origin to at most 25
   candidate Place IDs. The cap is configurable from 5 to 49. Transit stays
   below Google's 100-element request limit. When the key is absent or a Routes
   request fails (including an invalid key), SmartCart
   skips Google Routes and keeps the 25 nearest located premises using
   straight-line distance plus mode-based planning speeds; the user's route
   limit is not treated as verified reachability.
6. SmartCart applies the user's limit to routed distance or exact route time
   only when Google route results are available. A combined limit uses an
   inclusive AND: both the route distance and route duration must be within
   their selected thresholds.
7. PostgreSQL retrieves each requested basket item's latest PriceCatcher price
   at every candidate premise. When that premise-item row is unavailable, the
   API uses the ingestion-maintained `item.median_price_rm`, computed from all
   positive latest store prices for that item and rounded to cents. Quantity is
   applied to produce line totals and the store basket subtotal. A missing item
   remains an explicit null only when neither a premise price nor a cached
   median is available.
8. The API ranks one unified store list by directly observed store-price
   coverage, then effective coverage including median estimates. Remaining ties
   use the effective basket subtotal plus estimated return transport cost, then
   shorter time, route distance, name, and premise ID. Partial stores remain in
   the same list with an explicit coverage count and partial combined total;
   stores with no priced lines keep null basket and combined totals and sort
   last.
9. The API returns the full basket price breakdown for the UI's per-store
   "View item prices" control. Every priced response item also carries the
   English label from `item.item_name_en`; the official `item_name` is the
   Malay/original label and fallback.

At the default 25-candidate cap, a single-origin recommendation uses up to
25 route matrix elements. Toll calculations are not requested: Google's
published supported toll locations do not include Malaysia. Motorcycle routing
already uses the Enterprise billing tier; car distance/time requests use the
basic tier unless other advanced features are enabled.

## Travel-cost assumptions

| Mode | Default return-trip estimate |
| --- | --- |
| Walking | RM0 direct monetary cost |
| Public transport | Google's MYR transit fare when available, doubled for the return trip; otherwise two RM1.00 base fares plus RM0.08 per return-trip kilometre |
| Motorcycle | Return distance × 2.5 L/100 km ÷ 100 × RON95 price per litre |
| Car | Return distance × 7 L/100 km ÷ 100 × RON95 price per litre |

Consumption figures are configurable planning assumptions, not measurements of
an individual vehicle. Override them using `TRAVEL_CAR_LITRES_PER_100KM` and
`TRAVEL_MOTORCYCLE_LITRES_PER_100KM`. Previous car/motorcycle RM/km overrides
are no longer used for pricing.

The official data.gov.my fuel CSV is refreshed on the first petrol-mode request
of each Malaysian calendar day, once per server process. Only `level` records
whose effective dates are today or earlier are used. `TRAVEL_FUEL_PRICE_FIELD`
defaults to `ron95` (general market); `ron95_budi95` explicitly selects the
subsidised price for eligible users. Subsidy eligibility and remaining monthly
allowance are not checked by SmartCart. If a refresh fails, retain and label the
last known price, or use the labelled `TRAVEL_FUEL_PRICE_FALLBACK_RM` (default
RM2.60/L) when no price is cached. Failed refreshes are retried after an hour.
This is demand-driven daily refresh, not an independent background scheduler.

Fuel breakdowns expose cost, expected litres, consumption, price basis, price
source, and effective date. Tolls are null/unavailable and excluded, never a
verified zero. Parking and ownership costs are also excluded. Single-store
return costs double the outward distance; multi-store costs sum the three
journey legs (the return leg reuses the outward home-to-store route estimate).
Each cost is rounded to cents, and plan totals sum rounded leg costs so the
breakdown reconciles with ranking and basket-plus-travel totals.

Official references: [fuel dataset](https://data.gov.my/data-catalogue/fuelprice),
[Google toll calculations](https://developers.google.com/maps/documentation/routes/calculate_toll_fees),
and [supported toll locations](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteModifiers#TollPass).

## Basket-price calculation

For each store, `basket cost = sum(unit price x requested quantity)` for basket
lines that have either a `current_status` record at that premise or a cached
`item.median_price_rm`. The median fallback is a cached cross-store estimate,
not a claim that the item is stocked at that premise; `priceSource` exposes the
estimate separately from a directly observed store price. The combined
ranking value is `basket cost + estimated return transport cost` whenever at
least one line has a usable price. A missing price is not treated as zero or
fabricated: it is returned with null price fields and omitted from the sum only
when both the store price and cached median are unavailable. The response
includes priced and total basket-line counts plus an explicit completeness flag
for backwards compatibility. The UI uses one unified list, labels partial
coverage and combined totals clearly, and keeps combined totals null when no
line is priced.

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
  cache. The premise migration imports only the selected candidate's
  `place_latitude` and `place_longitude` from the matching raw cache; it never
  uses the separate postcode-geocoding coordinates. It retains coordinates
  only for premises whose imported business state is `open` and whose cache
  `place_match_decision` is neither `rejected` nor `needs_review`; both
  decisions have their Place ID, open/closed state, coordinates, and refresh
  metadata removed. The migration uses the cache's own generation time for
  expiry. Recommendation queries accept existing coordinates regardless of
  their refresh date. Schedule
  `pnpm cleanup:premise-locations` daily to delete values older than 30 days,
  and refresh coordinates with `pnpm sync:premise-locations`. The refresh query
  selects only premises whose imported business state is `open`, avoiding quota
  use for closed or unverified candidates.
- Do not display Google route content on a non-Google map. This implementation
  does not display a map and attributes location suggestions and route data to
  Google. "View route" links open Google Maps Directions with the selected
  origin, destination Place ID, and mode; Google Maps recomputes the route
  externally when the link is opened. SmartCart does not persist those links.
- Google requires a warning for walking and two-wheeler beta routes. The API
  returns this warning and the results screen displays it.

## Setup

1. Apply `database/schema.sql` to PostgreSQL, then run
   `python database/migrate_premise_open_status.py` to import the maintained
   premise status CSV and its matching `.cache.json` Place coordinates. Repeat
   that provider-free migration after both files are regenerated; future
   PriceCatcher-only premises remain hidden until they receive an imported
   `open` state and selected-Place coordinates.
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
- When Google Routes is not configured or a Routes request fails, recommendations are the 25 nearest
  located premises by straight-line distance. The fallback estimates travel time
  and cost using mode speeds, does not verify the selected travel limit, and
  does not establish that a route or store is reachable.
- Public transit depends on Google's available schedule coverage at request
  time. A missing route is skipped, not treated as proof that transit is
  impossible.
- Walking and motorcycle routes are beta estimates and may omit suitable paths
  or restrictions.
- Store Place IDs are top-candidate enrichment, not PriceCatcher-published IDs;
  bad or stale matches can affect the result and need review monitoring.
- Premise business states are also a dated enrichment snapshot rather than
  opening hours. A stale candidate may therefore be excluded after reopening or
  remain eligible after closing until the enrichment is regenerated and the
  migration is rerun.
- Missing prices are explicit unavailable values. A store with fewer priced
  basket lines may show a lower partial subtotal, so ranking gives coverage
  priority before comparing partial combined totals; the UI shows the coverage
  count and every missing line in one unified recommendation list.
- Median fallback prices are refreshed during ingestion from the latest rows
  retained in `current_status`. Because a premise row can be older than the
  current day, a median is an estimate of the observed catalogue data and does
  not prove current availability or stock.
- Before user testing, replace the default transport costs with validated local
  assumptions and define acceptance tests from the agreed LeanKit criteria.
