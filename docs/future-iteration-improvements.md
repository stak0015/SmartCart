# Future-iteration improvements

These product improvements are implemented in the current SmartCart delivery.
This document remains the product and acceptance reference for the revamped
journey, inbox reports, and estimated-savings calculation.

## Revamped top-level user journey

SmartCart should open on a home screen instead of placing the shopper directly
inside the shopping-trip flow. The home screen separates trip planning from
features that remain useful before and after a trip.

The implemented journey is:

```text
Home
|- Start or resume a shopping trip
|  `- Travel preferences -> Build basket -> Review basket -> Search stores
|     -> Compare stores -> Confirm store and checklist -> Home
|- View active checklist -> Record completed trip -> Shopping history
|- View shopping history
`- Open inbox -> Weekly or monthly savings and spending reports
```

The home screen is not a numbered trip step. It is the stable top-level
destination to which the SmartCart logo and completed journeys return.

### Home-screen actions

- **Start shopping trip** is the primary action. If an unfinished trip exists,
  the card changes to **Resume shopping trip** and shows the current step.
- **Checklist** opens the active shopping checklist and shows its item count or
  completion progress. When no checklist exists, it shows a clear empty state
  and directs the shopper to start a trip.
- **Shopping history** opens recorded trips, newest first, and may preview the
  most recent trip on the home card.
- **Inbox** opens SmartCart reports and shows an unread count. Its empty state
  explains that reports appear after eligible trip activity has been recorded.

Going home must not silently discard an in-progress trip. Starting a new trip
when one already exists must require an explicit continue-or-restart choice.
Replacing an active checklist must likewise require confirmation.

## Shopping-trip flow and navigation

Reorder the planning journey from:

`Basket building -> Travel preferences -> Store recommendations`

to:

`Travel preferences -> Basket building -> Review basket -> Store search`

Remove the global checklist icon/button from the shopping-trip header and from
all shopping-trip steps. The checklist is a top-level destination reached from
the home screen, not a shortcut inside trip planning. The basket shortcut may
remain available while a trip is in progress.

Confirming a store should create or update the active checklist as part of
finishing the trip, then return the shopper to the home screen. The home screen
should immediately reflect the new checklist. Do not add a second in-trip
`View checklist` shortcut that recreates the navigation being removed.

When the shopper selects a valid location, SmartCart should immediately
prepare an in-session cache of up to the 25 nearest stores that are within the
selected travel limit. If no store satisfies the limit, the cache should not
present out-of-limit stores as reachable; the UI should show the appropriate
no-reachable-store state and allow the shopper to revise the travel settings.

The cache should be invalidated when the location, transport mode, or travel
limit changes. The selected origin and temporary candidate cache must remain
session-only and must not become persistent user history.

### Move store search to basket review

Place the `Search stores` action on the Review basket page after the shopper
has finished adding or editing items. Each activation must request fresh
store-level pricing using the basket contents at that moment, so quantity
changes, removals, and alternative-item swaps cannot leave the recommendation
based on stale basket data.

The location-based candidate cache may be reused for routing candidates, but it
must not be treated as a cached basket-price result. Loading, empty-basket,
no-reachable-store, and error states should remain keyboard-accessible and
clearly announced to assistive technology.

## Checklist and shopping history outside trip planning

The active checklist and shopping history should have their own home-screen
destinations. Their data remains useful even when the shopper is not planning a
new trip.

- The checklist retains its bought, not-bought, neutral, manual-item, actual
  quantity, and actual-price behavior.
- Recording the checklist creates a frozen trip-history entry and updates the
  home-screen history preview without requiring a reload.
- Planned basket and transport amounts remain estimates. Spending reports use
  shopper-recorded actual prices only; missing actual prices stay unavailable
  and are never treated as RM0.
- Checklist and history data remain on the shopper's device under the current
  privacy model. The selected origin, route, and temporary store candidates
  must never be copied into history or reports.

## Epic 8 inbox and recurring reports

Add an in-app inbox, accessible from the home screen, for weekly or monthly
savings-and-spending reports. The shopper should be able to choose one cadence;
the interface may call these messages reports or a SmartCart newsletter, but it
should use one term consistently.

Each report should be a dated, read/unread inbox item covering a clearly stated
period. Keep the summary concise:

- known actual household spending and the number of recorded trips;
- estimated net savings for those trips, with store-choice and item-swap impact
  combined using the method below;
- a short comparison with the previous equivalent period when enough data is
  available; and
- a disclosure when missing actual prices or estimated catalogue/route values
  make the report incomplete.

Do not mix planned spending into actual spending or present estimated savings
as money definitely saved. A period with no eligible activity should produce a
clear no-activity state rather than a fabricated RM0 result. Under the current
device-only model, reports should be generated from local trip records and
stored locally. Email delivery, cross-device sync, or server-side newsletters
would require separate consent, account, retention, and privacy requirements.

## One concise estimated-savings section

Replace separate or repeated potential-savings messages with one **Estimated
savings** section on the selected-store view and in the checklist/trip summary.
It should combine:

1. the cost impact of choosing the selected store instead of a typical
   recommended store; and
2. the net cost impact of item swaps or pack changes applied at the selected
   store.

Use **typical recommended store** in the headline and explain that the typical
value is the median. Do not call the median an average.

### Comparable recommendation baseline

Freeze the recommendation results and selected-store totals immediately before
the first item swap. This snapshot is the common baseline for the section and
for any later trip-history report.

Only include a store in the median when it:

- was shown in the same recommendation result for the same basket and travel
  preferences;
- was within the shopper's selected travel limits;
- has a non-null combined cost; and
- prices the same basket lines as the selected-store baseline, so partial
  totals with different missing items are not compared as if they were equal.

The selected store remains part of this eligible recommendation set. If fewer
than two comparable stores remain, the median comparison is unavailable. A
cached item-level median price may contribute to an estimated combined cost,
but this must be disclosed and must not be confused with the median of the
recommended stores' combined costs.

For an even number of eligible stores, use the mean of the two middle combined
costs, which is the standard statistical median. Round displayed money to the
nearest sen after calculating the components.

### Calculation without double-counting

Let:

- `M` be the median pre-swap combined cost of eligible recommended stores;
- `S0` be the selected store's pre-swap combined cost; and
- `S1` be the selected store's current combined cost after applied item changes.

Then:

```text
Store-choice impact = M - S0
Item-change impact  = S0 - S1
Estimated net saving = M - S1
                     = store-choice impact + item-change impact
```

Using the same frozen baseline makes the breakdown reconcile exactly. It also
prevents a swap from being counted once in the selected-store total and again
as a separate saving.

Keep signed impacts until the final presentation. If the selected store costs
more than the median, that negative store-choice impact must offset swap
savings; it must not be hidden or clamped to zero. Pack changes that cost more
now are handled the same way.

### Concise presentation

When the net value is positive, use wording such as:

> **Estimated savings: RM12.40**
>
> RM4.00 from your store choice + RM8.40 from item swaps. Compared with the
> RM55.20 median combined cost across 6 comparable recommended stores.

Before the trip is recorded, prefer `You could spend an estimated RM12.40 less`
over `You saved RM12.40`. If the net value is negative, say that the plan is
`RMx.xx above the typical recommended-store cost` while still showing any swap
reduction. If it is exactly equal, say `About the same as the typical
recommended-store cost` rather than claiming an RM0 saving.

If the median comparison is unavailable but item changes are comparable, show
only the item-change amount and label the store comparison unavailable. If no
valid component can be calculated, show `Estimated savings unavailable`; never
replace missing prices with zero. Keep route-estimate, partial-price, and cached
median-price disclosures to one short supporting line.

## Future acceptance checks

- SmartCart opens on the home screen with Start/Resume trip, Checklist,
  Shopping history, and Inbox destinations.
- The shopping-trip header and steps contain no checklist icon or checklist
  navigation action.
- Finishing a store selection creates or updates the active checklist and
  returns to a home screen that reflects it immediately.
- Leaving for home preserves an in-progress trip; restarting or replacing an
  active checklist requires confirmation.
- Selecting a location triggers at most one bounded candidate-preparation
  request for the active location and travel settings.
- No candidate outside the selected limit is labelled reachable or included in
  the savings median.
- Editing the basket does not silently submit a store-search request.
- `Search stores` prices the current basket on every activation.
- Changing location or travel settings clears the previous candidate cache.
- The flow preserves the existing privacy boundary: no origin, route, or
  temporary candidate cache is persisted as checklist, history, or report data.
- The displayed recommendation baseline is the statistical median, not the
  arithmetic mean of all store totals.
- Only like-for-like combined costs enter the median; incomparable partial
  baskets and null totals are excluded and disclosed.
- Store-choice and item-change impacts sum exactly to the displayed estimated
  net saving, with no double-counting and no premature component rounding.
- A plan above the median is never labelled as a saving, and missing values are
  never shown as RM0.
- Weekly/monthly inbox reports use recorded actual spending, keep estimated
  savings clearly labelled, preserve missing-data disclosures, and update the
  home-screen unread state.
