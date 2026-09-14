# Travel-first journey implementation

The travel-first planning improvements are part of the current SmartCart
application. The user journey is:

`Home -> Travel preferences -> Add items -> Review basket -> Search stores`

The home dashboard is also the entry point for the active checklist, recorded
shopping history, and the on-device report inbox.

## Session candidate preparation

Selecting a valid location prepares at most 25 nearby candidates for the
active location and travel settings. With Google Routes configured, only
stores satisfying the selected limit are retained. A combined limit is an
inclusive AND check for route distance and route duration. If none qualifies,
the UI keeps the shopper on the travel step and offers a way to revise the
settings; it does not relabel an out-of-limit store as reachable.

Without Routes credentials, SmartCart preserves the documented nearest-store
straight-line fallback. Those candidates, their travel estimates, and the
selected limit are explicitly marked unverified and are never described as
reachable.

The backend returns an opaque preparation ID for a bounded, temporary in-memory
candidate snapshot. The snapshot stores derived premise and route data but not
the selected origin. It expires after 30 minutes by default, is never written
to PostgreSQL or browser storage, and can be invalidated early. The frontend
clears it when location, transport mode, travel limit, or SARA filter changes.

## Fresh store pricing from basket review

`Search stores` appears on Review basket. Each activation sends the current
basket and preparation ID, reuses only the prepared candidate and route data,
and retrieves fresh store-level prices. Basket additions, quantity changes,
removals, and alternative-item swaps never trigger a recommendation request in
the background. A basket change after a completed search marks the result
stale and requires another explicit search before store selection or checklist
creation.

Loading, empty-basket, no-reachable-store, unverified-fallback, expired-cache,
and error states are keyboard accessible and announced to assistive
technology.

## Implemented acceptance checks

- Selecting a location makes at most one bounded preparation request for one
  stable location-and-settings fingerprint.
- No candidate outside a verified route limit is labelled reachable.
- Editing the basket never silently submits a store-search request.
- Every `Search stores` activation prices the basket as it exists at that
  moment.
- Changing location or travel settings clears the previous preparation and
  recommendation result.
- The selected origin, routes, and candidate preparation never become
  checklist, trip-history, inbox, analytics, or log data.

## Savings and reports

For a freshly searched basket, SmartCart compares the selected store's combined
basket-and-return-transport cost with the median among reachable stores that
have the same basket-line count and exact set of priced items. Null totals are
excluded, at least two comparable stores are required, and the even-sized
median is the mean of the two middle values. Only a positive difference is
shown as estimated store-choice savings.

The savings headline combines that positive estimate with positive swap
savings calculated for the selected premise, while showing both components
separately. The calculation is frozen into the checklist and recorded trip so
future weekly or monthly reports do not have to replay historical
recommendations. The current inbox provides versioned on-device messages and
read state; report generation and external newsletter delivery remain future
Epic 8 work.
