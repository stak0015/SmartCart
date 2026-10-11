# Epic 2 — Reachable store recommendation

> Mirrors the LeanKit board after the 11 October 2026 US/AC revision. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2495224395](https://monashie.leankit.com/card/2495224395) |
| Size | 10 |
| Planned window | 2026-08-26 → 2026-09-01 |
| Assigned | Shunnosuke Takei |
| Stories / ACs | 5 / 68 |

As a household shopper, I want to set where I am starting from and how far I am willing to travel, see nearby prices while I shop, and then see reachable stores ranked by basket cost plus estimated return travel cost, so I can choose a practical and affordable place to shop.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [2.1](#us-21-set-travel-preferences) | Set travel preferences | — | 10 | 20 | Shunnosuke Takei |
| [2.2](#us-22-filter-stores-by-reachability) | Filter stores by reachability | — | 10 | 8 | Shunnosuke Takei |
| [2.3](#us-23-recommend-the-lowest-combined-cost-reachable-store) | Recommend the lowest combined-cost reachable store | — | 10 | 20 | Zhihao Zhao, Shunnosuke Takei |
| [2.4](#us-24-view-store-recommendation-overview) | View store recommendation overview | — | 10 | 13 | Chenglong Meng |
| [2.5](#us-25-see-nearby-prices-while-i-shop) | See nearby prices while I shop | — | 5 | 7 | Shunnosuke Takei |

## US 2.1 Set travel preferences

Card [2502891671](https://monashie.leankit.com/card/2502891671) · size 10

As a household shopper, I want to choose my starting point, transport mode, travel limit and whether to see only SARA stores before I start shopping, so SmartCart only shows stores I can realistically reach.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (LocationScreen), [`api-client.ts`](../../frontend/lib/api-client.ts); backend/data: [`api.py`](../../backend/smartcart/api.py) (/locations/*), [`maps.py`](../../backend/smartcart/maps.py).

**Tests** — [`test_maps.py`](../../backend/tests/test_maps.py), [`test_api.py`](../../backend/tests/test_api.py), [`api-client.test.ts`](../../frontend/lib/api-client.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **2.1.1** Travel screen layout | Given the shopper starts a shopping trip, when the Travel screen opens, then it shows a map, ways to choose a starting location, "Transport mode", "Travel limit" and "SARA store filter" options, a "Remember preferences" switch and a "Continue to Shop" button. | 3 |
| **2.1.2** Continue to Shop | Given the shopper has chosen a starting location, when they press "Continue to Shop", then the Shop screen opens and nearby store prices start loading for the product list. | 1 |
| **2.1.3** Remember preferences off | Given the shopper turns "Remember preferences" off, when they press "Continue to Shop" and later reopen SmartCart, then the Travel screen starts with the default choices. | 3 |
| **2.1.4** Remember preferences on | Given "Remember preferences" is on, when the shopper presses "Continue to Shop" and later reopens SmartCart, then the Travel screen starts with their last transport mode, travel limit and SARA store filter, but no starting location. | 3 |
| **2.1.5** Location required | Given no starting location has been chosen, or a location is still being found or selected, when the shopper views the Travel screen, then "Continue to Shop" is disabled. | 1 |
| **2.1.6** Location search | Given the shopper types at least 3 characters in the location search bar, when they select one of the suggested Malaysian addresses, then that address becomes the starting location and is shown on the map. | 5 |
| **2.1.7** Free text is not a location | Given a location has been selected, when the shopper edits the text in the location search bar without choosing a new suggestion, then the selection is cleared and "Continue to Shop" is disabled. | 3 |
| **2.1.8** Use precise location | Given the shopper is on the Travel screen, when they press "Use my precise location" and allow access, then their current address becomes the starting location and is shown on the map. | 5 |
| **2.1.9** Location access refused | Given the shopper presses "Use my precise location", when they refuse location access, then a message says access was refused and suggests searching instead. | 1 |
| **2.1.10** Suggestions cannot load | Given the shopper types in the location search bar, when suggestions cannot be loaded, then a message says location search is unavailable. | 1 |
| **2.1.11** Clear the location | Given a location is in the search bar, when the shopper presses its "×" button, then the starting location is cleared and the map asks them to choose one. | 1 |
| **2.1.12** Keyboard selection of suggestions | Given location suggestions are showing, when the shopper presses the Up/Down arrow keys and then Enter, then the highlighted suggestion is selected. | 3 |
| **2.1.13** Choose a transport mode | Given the shopper opens "Transport mode", when they select "Walking", "Public transport", "Motorcycle" or "Car", then that mode is highlighted and shown as the current choice. | 3 |
| **2.1.14** Choose a travel limit | Given the shopper opens "Travel limit", when they choose "Distance", "Travel time" or "Both" and press a preset, then that limit is highlighted and shown as the current choice. | 3 |
| **2.1.15** Location not found | Given the shopper allowed location access, when their location cannot be found, then a message says it could not be found and suggests trying again or searching. | 1 |
| **2.1.16** Browser cannot share location | Given the browser cannot share location, when the shopper presses "Use my precise location", then a message says precise location is not supported. | 1 |
| **2.1.17** Address not found for precise location | Given the shopper's position was found, when its address cannot be looked up, then the location is shown as "Current precise location" and can still be used. | 3 |
| **2.1.18** Suggestion cannot be used | Given suggestions are showing, when the shopper selects one that cannot be used, then a message says that location could not be selected. | 1 |
| **2.1.19** Location search progress | Given the shopper is searching for or selecting a location, when SmartCart is still looking it up, then a progress message is shown under the search bar. | 1 |
| **2.1.20** Hide suggestions | Given location suggestions are showing, when the shopper presses Escape, then the suggestions are hidden. | 1 |

## US 2.2 Filter stores by reachability

Card [2502892774](https://monashie.leankit.com/card/2502892774) · size 10

As a household shopper, I want the recommended stores to respect my transport mode, travel limit and SARA store choice, so I am not shown stores I cannot or would not visit.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (CompareScreen); backend/data: [`api.py`](../../backend/smartcart/api.py) (_recommend_stores), [`premises.py`](../../backend/smartcart/premises.py), [`recommendation.py`](../../backend/smartcart/recommendation.py) (rank_reachable_stores), [`maps.py`](../../backend/smartcart/maps.py).

**Tests** — [`test_recommendation.py`](../../backend/tests/test_recommendation.py), [`test_premises.py`](../../backend/tests/test_premises.py), [`test_api.py`](../../backend/tests/test_api.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **2.2.1** Route-based distance and time | Given the shopper opens the Recommendations screen, when the store cards appear, then each shows the one-way distance and travel time from the starting location by the chosen transport mode. | 8 |
| **2.2.2** Distance limit | Given the shopper chose a Distance limit, when the Recommendations screen opens, then only stores whose one-way route distance is within that limit are listed. | 5 |
| **2.2.3** Time limit | Given the shopper chose a Travel time limit, when the Recommendations screen opens, then only stores whose one-way travel time is within that limit are listed. | 5 |
| **2.2.4** Both limits | Given the shopper chose "Both", when the Recommendations screen opens, then only stores within both the distance and the time limit are listed. | 5 |
| **2.2.5** SARA store filter | Given the shopper chose "SARA stores", when the Recommendations screen opens, then only verified SARA stores and possible matches are listed and a note says the SARA filter is on. | 5 |
| **2.2.6** SARA filter note | Given the shopper opens "SARA store filter", when they select "SARA stores", then a note reminds them to confirm store participation and item eligibility before shopping. | 1 |
| **2.2.7** Nothing within the limit | Given no store is within the travel limit, when the Recommendations screen opens, then the nearest stores are shown with a notice that they exceed the limit, and each is tagged "Beyond travel limit". | 5 |
| **2.2.8** Approximate routes | Given route data is unavailable, when the Recommendations screen opens, then a note explains that distances and times are rough estimates and the travel limit is not checked. | 3 |

## US 2.3 Recommend the lowest combined-cost reachable store

Card [2502902153](https://monashie.leankit.com/card/2502902153) · size 10

As a household shopper on a limited budget, I want the system to compare prices between reachable stores, so that I can find the cheapest store for my shopping basket.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (CompareScreen, StoreCard), [`visible-stores.ts`](../../frontend/lib/visible-stores.ts), [`basket-coverage.ts`](../../frontend/lib/basket-coverage.ts), [`travel.ts`](../../frontend/lib/travel.ts) (directions links); backend/data: [`pricing.py`](../../backend/smartcart/pricing.py), [`recommendation.py`](../../backend/smartcart/recommendation.py) (apply_basket_pricing), [`sara.py`](../../backend/smartcart/sara.py).

**Tests** — [`test_pricing.py`](../../backend/tests/test_pricing.py), [`test_recommendation.py`](../../backend/tests/test_recommendation.py), [`test_sara.py`](../../backend/tests/test_sara.py), [`visible-stores.test.ts`](../../frontend/lib/visible-stores.test.ts), [`basket-coverage.test.ts`](../../frontend/lib/basket-coverage.test.ts), [`travel.test.ts`](../../frontend/lib/travel.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **2.3.1** Basket subtotal per store | Given stores are listed, when the shopper reads a store card, then its basket subtotal is the sum of each priced item's unit price × quantity. | 3 |
| **2.3.2** Recommendations screen | Given the shopper presses "Compare Stores", when the results load, then the "Compare stores" screen shows a summary of the travel settings and the store cards, six at a time. | 3 |
| **2.3.3** Price coverage | Given a store card is shown, when the shopper reads it, then it shows how many items have store prices, estimated prices and no price. | 3 |
| **2.3.4** Ranking | Given several stores are listed, when the shopper reads the list, then stores are ordered by basket subtotal plus return travel cost, lowest first, with ties broken by shorter travel time and distance. | 8 |
| **2.3.5** Best basket match | Given at least one store is listed, when the shopper views the first card, then it is marked "★ Best basket match". | 3 |
| **2.3.6** Verified SARA partner tag | Given a store is a verified SARA partner, when its card or store details page is shown, then it carries a "Verified SARA partner" tag. | 3 |
| **2.3.8** SARA credit and cash needed | Given the shopper opens a store's details, when they read the basket summary, then it shows the SARA credit and the cash needed, with a note to verify SARA eligibility at the store. | 3 |
| **2.3.9** View item prices on a card | Given a store card is shown, when the shopper presses "View item prices", then a pop-up lists each basket item's quantity, unit price and total at that store and names any items with no price. | 3 |
| **2.3.10** No stores found | Given no store can be found, when the Recommendations screen loads, then a message suggests a larger limit, another transport mode or removing the SARA filter, with a "Change travel preferences" button that opens the Travel screen. | 1 |
| **2.3.11** Store card contents | Given a store is listed, when the shopper views its card, then it shows the store name, travel distance, time and cost, basket subtotal, total, an "Open in Google Maps" link and a "View store" button. | 3 |
| **2.3.12** Estimated prices on a card | Given a store has no price for an item but an estimated price exists, when its card is shown, then the estimate is used and the totals are labelled as estimated. | 8 |
| **2.3.13** Missing prices on a card | Given a store has no price at all for an item, when its card is shown, then the item is left out and the totals are labelled as partial. | 5 |
| **2.3.14** See more stores | Given more than 6 stores are available, when the shopper presses "See more (+6)", then up to 6 more cards are added below. | 3 |
| **2.3.15** Directions from a card | Given a store card is shown, when the shopper presses "Open in Google Maps", then Google Maps opens with directions from the starting location by the chosen transport mode. | 3 |
| **2.3.16** Loading recommendations | Given the shopper has opened the Recommendations screen, when results are still loading, then a loading message is shown. | 1 |
| **2.3.17** Recommendations unavailable | Given the shopper has opened the Recommendations screen, when results cannot be loaded, then a message says recommendations are unavailable, with a "Change travel preferences" button that opens the Travel screen. | 1 |
| **2.3.18** Compare stores from the basket | Given the shopper has chosen a starting location and the basket has at least one item, when they press "Compare Stores" on the "Review your basket" screen, then the Recommendations screen opens using the latest store prices for the current basket. | 3 |
| **2.3.19** No tag for other stores | Given a store is not a verified SARA partner, when its card or store details page is shown, then no SARA tag is shown. | 1 |
| **2.3.20** Close item prices | Given a store's "Basket items" pop-up is open, when the shopper presses "Hide item prices", "×", Escape, or opens another store's prices, then the pop-up closes. | 1 |
| **2.3.21** No starting location | Given the shopper reaches the Recommendations screen without a starting location, when the screen loads, then a message asks them to choose one, with a "Change travel preferences" button that opens the Travel screen. | 1 |

## US 2.4 View store recommendation overview

Card [2502907270](https://monashie.leankit.com/card/2502907270) · size 10

As a household shopper, I want to open a store's details, so I can check its item prices, travel costs and totals, and adjust quantities before deciding where to shop.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (RecommendationOverview), [`recommendation-detail.ts`](../../frontend/lib/recommendation-detail.ts), [`travel-cost-breakdown.tsx`](../../frontend/components/travel-cost-breakdown.tsx); backend/data: [`fuel.py`](../../backend/smartcart/fuel.py), [`recommendation.py`](../../backend/smartcart/recommendation.py) (fuel_cost_breakdown).

**Tests** — [`test_fuel.py`](../../backend/tests/test_fuel.py), [`recommendation-detail.test.ts`](../../frontend/lib/recommendation-detail.test.ts), [`travel-cost-breakdown.test.tsx`](../../frontend/lib/travel-cost-breakdown.test.tsx).

| AC | Criterion | Size |
| --- | --- | --- |
| **2.4.1** Open store details | Given a store card is visible, when the shopper presses "View store", then that store's details page opens with the current basket and travel preferences, and the steps bar highlights "Store details". | 3 |
| **2.4.2** Store details header | Given the store details page is open, when the shopper views the header, then it shows the store's name, address and SARA tag, the starting point, transport mode, distance, travel time and an "Open in Google Maps" link. | 3 |
| **2.4.3** Estimate and partial labels on details | Given some items are estimated or missing at the store, when the store details page is open, then the subtotal and total are labelled as estimated or partial. | 1 |
| **2.4.4** Item list on store details | Given the store details page is open, when the shopper views the item list, then every basket item is listed with its details, quantity selector, unit price and total, and estimated prices are marked as estimates. | 3 |
| **2.4.5** Item with no price | Given an item has no price at the store, when the item list is shown, then that item says no price is available and is left out of the subtotal. | 1 |
| **2.4.6** Totals on store details | Given the store details page is open, when the shopper reads the Basket summary, then the subtotal equals the sum of the listed line totals and the final total equals that subtotal plus the travel cost shown. | 3 |
| **2.4.7** Change quantity on store details | Given the store details page is open, when the shopper changes an item's quantity, then that line and the totals update immediately and the basket keeps the new quantity. | 3 |
| **2.4.8** Fuel cost estimate | Given the shopper travels by car or motorcycle, when they view the travel costs on the store details page, then an expected fuel cost is shown, and pressing its "i" button explains how it was calculated. | 8 |
| **2.4.9** Tolls not included | Given a fuel estimate is shown, when the shopper presses the "i" button beside "Tolls", then it explains that tolls and parking are not included in the total. | 3 |
| **2.4.10** Return travel for other modes | Given the shopper walks or uses public transport, when they view the travel costs on the store details page, then a single return travel amount is shown. | 3 |
| **2.4.11** Back to the store list | Given the shopper did not change the basket on the store details page, when they press "← Back to plans", then the Recommendations list reopens exactly as before. | 3 |
| **2.4.12** Stock and affordability note | Given the store details page is open, when the shopper reads below the item list, then a note says SmartCart does not verify affordability or in-store stock. | 1 |
| **2.4.14** Back after changing the basket | Given the shopper changed a quantity or swapped an item on the store details page, when they press "← Back to plans", then the Recommendations list reloads with totals for the updated basket. | 3 |

## US 2.5 See nearby prices while I shop

Card [2529695313](https://monashie.leankit.com/card/2529695313) · size 5

As a household shopper, I want to see what products cost at stores near me while I build my basket, so I can choose items that fit my budget before comparing stores.

**Implementation** — frontend: [`nearby-price-status.tsx`](../../frontend/components/nearby-price-status.tsx), [`catalogue-price.ts`](../../frontend/lib/catalogue-price.ts); backend/data: [`api.py`](../../backend/smartcart/api.py) (/recommendations/prepare), [`catalogue.py`](../../backend/smartcart/catalogue.py) (catalogue_price_ranges).

**Tests** — [`test_catalogue_prices.py`](../../backend/tests/test_catalogue_prices.py), [`nearby-price-status.test.tsx`](../../frontend/components/nearby-price-status.test.tsx), [`catalogue-price.test.ts`](../../frontend/lib/catalogue-price.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **2.5.1** Nearby prices loading | Given the shopper has pressed "Continue to Shop", when the Shop screen opens, then a message says nearby store prices are loading. | 1 |
| **2.5.2** Nearby prices ready | Given nearby store prices have loaded, when the shopper views the Shop screen, then a message says how many nearby stores the prices come from. | 1 |
| **2.5.3** Nearby prices failed | Given nearby store prices could not be loaded, when the shopper views the Shop screen, then a message says so, with a "Retry nearby prices" button that tries again. | 1 |
| **2.5.4** No location yet | Given the shopper opened Shop without a starting location, when the product list appears, then a message asks them to set a location in Travel to see nearby prices. | 1 |
| **2.5.5** Price on product cards | Given products are listed, when the shopper views a product card, then it shows the price range at nearby stores, an estimated price marked "(estimated)", or "Price unavailable". | 5 |
| **2.5.6** Price in item details | Given the item details window is open for a priced product, when the shopper reads the price, then a note says whether it comes from nearby stores or is an estimate, and that the final price depends on the store. | 3 |
| **2.5.7** Sorting by nearby price | Given nearby prices have loaded, when the shopper sorts by "Cheapest first" or "Highest price first", then products are ordered by their lowest nearby price, with unpriced products last. | 5 |
