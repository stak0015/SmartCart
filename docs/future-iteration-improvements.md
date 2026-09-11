# Future-iteration improvements

These are proposed product improvements for a later iteration. They are not
implemented requirements for the current delivery.

## Travel-first planning flow

Reorder the planning journey from:

`Basket building -> Travel preferences -> Store recommendations`

to:

`Travel preferences -> Basket building -> Review basket -> Store search`

When the shopper selects a valid location, SmartCart should immediately
prepare an in-session cache of up to the 25 nearest stores that are within the
selected travel limit. If no store satisfies the limit, the cache should not
present out-of-limit stores as reachable; the UI should show the appropriate
no-reachable-store state and allow the shopper to revise the travel settings.

The cache should be invalidated when the location, transport mode, or travel
limit changes. The selected origin and temporary candidate cache must remain
session-only and must not become persistent user history.

## Move store search to basket review

Place the `Search stores` action on the Review basket page after the shopper
has finished adding or editing items. Each activation must request fresh
store-level pricing using the basket contents at that moment, so quantity
changes, removals, and alternative-item swaps cannot leave the recommendation
based on stale basket data.

The location-based candidate cache may be reused for routing candidates, but it
must not be treated as a cached basket-price result. Loading, empty-basket,
no-reachable-store, and error states should remain keyboard-accessible and
clearly announced to assistive technology.

### Future acceptance checks

- Selecting a location triggers at most one bounded candidate-preparation
  request for the active location and travel settings.
- No candidate outside the selected limit is labelled reachable.
- Editing the basket does not silently submit a store-search request.
- `Search stores` prices the current basket on every activation.
- Changing location or travel settings clears the previous candidate cache.
- The flow preserves the existing privacy boundary: no origin, route, or
  temporary candidate cache is persisted as user history.
