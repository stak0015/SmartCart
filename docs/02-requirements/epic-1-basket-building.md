# Epic 1 — Essential basket building

> Mirrors the LeanKit board after the 13 October 2026 update. The board is the source of truth; regenerate this file when cards change (see [README](README.md)).

| | |
| --- | --- |
| Epic card | [2495224158](https://monashie.leankit.com/card/2495224158) |
| Size | 8 |
| Planned window | 2026-08-26 → 2026-09-01 |
| Assigned | Zhihao Zhao, Chenglong Meng, Shunnosuke Takei |
| Stories / ACs | 6 / 41 |

As a household shopper, I want to search the official supported catalogue, choose quantities, and review a basket, so I can prepare a shopping list before comparing reachable store prices.

## Stories

| Story | Title | Priority | Size | ACs | Assigned |
| --- | --- | --- | --- | --- | --- |
| [1.1](#us-11-item-search) | Item search | MUST | 8 | 11 | Chenglong Meng |
| [1.2](#us-12-browse-by-category) | Browse by category | MUST | 8 | 11 | Shunnosuke Takei |
| [1.3](#us-13-confirm-item-details) | Confirm item details | MUST | 5 | 5 | Zhihao Zhao |
| [1.4](#us-14-add-items-with-set-quantity) | Add items with set quantity | MUST | 5 | 5 | Zhihao Zhao |
| [1.5](#us-15-edit-and-remove-items) | Edit and remove items | MUST | 5 | 4 | Huan Yang |
| [1.6](#us-16-review-the-basket) | Review the basket | MUST | 5 | 5 | Shunnosuke Takei |

## US 1.1 Item search

Card [2495232897](https://monashie.leankit.com/card/2495232897) · size 8 · MUST

As a household shopper, I want to search, browse and sort the official product catalogue, so I can quickly find the items I need.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (BasketScreen), [`api.ts`](../../frontend/lib/api.ts), [`result-row.ts`](../../frontend/lib/result-row.ts); backend/data: [`api.py`](../../backend/smartcart/api.py) (search_items), [`catalogue.py`](../../backend/smartcart/catalogue.py), [`translations.py`](../../backend/smartcart/translations.py).

**Tests** — [`test_api.py`](../../backend/tests/test_api.py), [`test_catalogue_controls.py`](../../backend/tests/test_catalogue_controls.py), [`api.test.ts`](../../frontend/lib/api.test.ts), [`result-row.test.ts`](../../frontend/lib/result-row.test.ts), [`test_ingest_pricecatcher.py`](../../database/tests/test_ingest_pricecatcher.py).

| AC | Criterion | Size |
| --- | --- | --- |
| **1.1.1** Minimum characters for a name search | Given the shopper is on the Shop screen, when they type only one character in the search bar, then a message asks for at least 2 characters and no products are listed. | 1 |
| **1.1.2** Search results | Given the shopper is on the Shop screen, when they type 2 or more characters in the search bar, then the matching products are listed under "Search results" with the number of matches. | 3 |
| **1.1.3** Search results pagination | Given more products match than fit on one page, when the shopper presses a page number, "Previous" or "Next", then that page of products is shown. | 3 |
| **1.1.4** No match found | Given no products match the keyword and categories, when the search finishes, then a message says no items were found and suggests another keyword or category. | 1 |
| **1.1.5** Clear search | Given text is in the search bar, when the shopper presses the "×" button in the search bar, then the search is cleared and the full list (within any ticked categories) is shown from page 1. | 1 |
| **1.1.6** Partial name matching | Given the shopper types a keyword, when the results appear, then they include every product whose name contains the keyword, ignoring upper and lower case. | 3 |
| **1.1.7** Browse all essentials | Given the search bar is empty and no category is ticked, when the shopper opens the Shop screen, then all products are listed under "All essentials" with the total count. | 3 |
| **1.1.8** Sort the catalogue | Given the shopper is on the Shop screen, when they open the sort menu and choose "Cheapest first", "Highest price first", "Name: A–Z" or "Name: Z–A", then the list is reordered that way from page 1. | 5 |
| **1.1.9** Catalogue cannot load | Given the shopper is on the Shop screen, when the product list cannot be loaded, then an error message asks them to try again. | 1 |
| **1.1.10** Searching in progress | Given the shopper has changed the search, filters, sort or page, when the new results are loading, then a searching message is shown. | 1 |
| **1.1.11** Default sort | Given the shopper opens the Shop screen, when the product list first appears, then it is sorted "Cheapest first". | 3 |

## US 1.2 Browse by category

Card [2495231006](https://monashie.leankit.com/card/2495231006) · size 8 · MUST

As a household shopper, I want to narrow the catalogue to one or more categories, or to SARA categories only, so I can find suitable items without knowing an exact item name.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (category panel), [`i18n.ts`](../../frontend/lib/i18n.ts); backend/data: [`categories.py`](../../backend/smartcart/categories.py), [`catalogue.py`](../../backend/smartcart/catalogue.py).

**Tests** — [`test_catalogue_controls.py`](../../backend/tests/test_catalogue_controls.py), [`i18n.test.ts`](../../frontend/lib/i18n.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **1.2.1** Category filter control | Given the shopper is on the Shop screen, when they press the "Categories" control, then a "Filter by category" panel opens with a checkbox for each category. | 3 |
| **1.2.2** Filter by selected categories | Given the "Filter by category" panel is open, when the shopper ticks one or more categories, then only products in those categories are listed, from page 1. | 3 |
| **1.2.3** Categories together with a keyword | Given a keyword is in the search bar, when the shopper ticks a category, then only products matching both the keyword and the ticked categories are listed. | 3 |
| **1.2.4** Category control labels and panel buttons | Given the shopper has ticked or unticked categories, when they look at the "Categories" control, then it shows "All categories" or the names of the ticked categories. | 3 |
| **1.2.5** Empty category result | Given no products match, when the shopper changes the keyword or category ticks, then the list updates to the new matches and the basket is unchanged. | 3 |
| **1.2.6** Clear all categories | Given at least one category is ticked, when the shopper presses "Clear all" in the "Filter by category" panel, then every tick is removed and all products are listed again. | 3 |
| **1.2.7** Close the category panel | Given the "Filter by category" panel is open, when the shopper presses "Show [N] items", then the panel closes and the filtered list is shown. | 3 |
| **1.2.8** Categories cannot load | Given the shopper opens the "Filter by category" panel, when the categories cannot be loaded, then an error message is shown. | 1 |
| **1.2.9** SARA categories only | Given the shopper is on the Shop screen, when they tick "SARA categories only", then only products in SARA-eligible categories are listed and the list returns to page 1. | 3 |
| **1.2.10** Categories loading | Given the shopper opens the "Filter by category" panel, when the categories are still loading, then a loading message is shown. | 1 |
| **1.2.11** Turn off SARA categories only | Given "SARA categories only" is ticked, when the shopper unticks it, then products from all categories are listed again. | 3 |

## US 1.3 Confirm item details

Card [2495231571](https://monashie.leankit.com/card/2495231571) · size 5 · MUST

As a household shopper, I want to see a product's picture, name, pack size, category and SARA status, and open its full details, so I can be sure it is the right item before adding it.

**Implementation** — frontend: [`catalogue-item-dialog.tsx`](../../frontend/components/catalogue-item-dialog.tsx), [`catalogue-item-image.tsx`](../../frontend/components/catalogue-item-image.tsx), [`package-size.ts`](../../frontend/lib/package-size.ts), [`item-name.ts`](../../frontend/lib/item-name.ts); backend/data: [`catalogue.py`](../../backend/smartcart/catalogue.py) (display_package_size), [`catalogue_image_manifest.py`](../../backend/smartcart/catalogue_image_manifest.py).

**Tests** — [`catalogue-item-dialog.test.tsx`](../../frontend/components/catalogue-item-dialog.test.tsx), [`package-size.test.ts`](../../frontend/lib/package-size.test.ts), [`item-name.test.ts`](../../frontend/lib/item-name.test.ts), [`catalogue-image.test.ts`](../../frontend/lib/catalogue-image.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **1.3.1** Product card details | Given products are listed, when the shopper views a product card, then it shows the product's picture, name, pack size, category and a "+" button. | 3 |
| **1.3.2** SARA category flag | Given a product is in a SARA-eligible category, when it is shown in the catalogue, item details or basket, then it carries a "SARA category" label. | 3 |
| **1.3.3** Open item details | Given products are listed, when the shopper presses a product's "+" button, then an item details window opens with the product's details, a quantity selector set to 1 and an "Add to basket" button. | 3 |
| **1.3.4** Close item details | Given the item details window is open, when the shopper presses "×", presses Escape or clicks outside the window, then it closes and the basket is unchanged. | 1 |
| **1.3.6** No SARA label for other products | Given a product is not in a SARA-eligible category, when it is shown on a product card, in item details or in the basket, then no SARA label is shown. | 1 |

## US 1.4 Add items with set quantity

Card [2497130441](https://monashie.leankit.com/card/2497130441) · size 5 · MUST

As a household shopper, I want to add each item with a chosen quantity, so the later per-store price calculation uses the amount I intend to buy.

**Implementation** — frontend: [`quantity-selector.tsx`](../../frontend/components/quantity-selector.tsx), [`result-row.ts`](../../frontend/lib/result-row.ts), [`basket-state.ts`](../../frontend/lib/basket-state.ts); backend/data: —.

**Tests** — [`result-row.test.ts`](../../frontend/lib/result-row.test.ts), [`basket-state.test.ts`](../../frontend/lib/basket-state.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **1.4.1** Quantity selector | Given the item details window is open, when the shopper presses "−" or "+" or types a quantity, then the quantity changes, staying between 1 and 99. | 3 |
| **1.4.2** Invalid quantity | Given the item details window is open, when the shopper enters a quantity that is not a whole number from 1 to 99, then an error message explains the allowed range and "Add to basket" is disabled. | 1 |
| **1.4.3** Back to a valid quantity | Given the quantity box shows the error, when the shopper changes the value to a whole number from 1 to 99, then the error disappears and "Add to basket" is enabled. | 1 |
| **1.4.4** Add to basket | Given the item details window has a valid quantity, when the shopper presses "Add to basket", then the item is added to the basket with that quantity, the window closes, and the basket count updates. | 3 |
| **1.4.5** Add the same item again | Given an item is already in the basket, when the shopper adds it again, then its basket quantity increases instead of a second line being added. | 3 |

## US 1.5 Edit and remove items

Card [2497131826](https://monashie.leankit.com/card/2497131826) · size 5 · MUST

As a household shopper, I want to change quantities or remove basket items, so I can correct mistakes before choosing travel preferences and comparing stores.

**Implementation** — frontend: [`result-row.ts`](../../frontend/lib/result-row.ts) (upsertBasketLine), [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (BasketScreen); backend/data: —.

**Tests** — [`result-row.test.ts`](../../frontend/lib/result-row.test.ts).

| AC | Criterion | Size |
| --- | --- | --- |
| **1.5.1** Change a basket quantity | Given the basket has items, when the shopper presses "−" or "+" or types a quantity on a basket line, then that line's quantity and the basket count update. | 3 |
| **1.5.2** Remove a basket line | Given the shopper is viewing a basket line, when they press its bin button, then the line is removed immediately without a confirmation and the basket counts update. | 3 |
| **1.5.3** Remove the last basket line | Given the basket has one line, when the shopper presses its bin button, then a message says the basket is empty and suggests adding items. | 1 |
| **1.5.4** Invalid basket quantity | Given the shopper is editing a basket quantity, when they enter a value that is not a whole number from 1 to 99, then an error message explains the allowed range and the line keeps its last valid quantity. | 3 |

## US 1.6 Review the basket

Card [2502890977](https://monashie.leankit.com/card/2502890977) · size 5 · MUST

As a household shopper, I want to review and edit my basket so I can confirm the items and quantities before searching stores.

**Implementation** — frontend: [`smartcart-app.tsx`](../../frontend/components/smartcart-app.tsx) (BasketScreen), [`result-row.ts`](../../frontend/lib/result-row.ts); backend/data: —.

**Tests** — [`result-row.test.ts`](../../frontend/lib/result-row.test.ts), [`shopping-step-nav.test.tsx`](../../frontend/components/shopping-step-nav.test.tsx).

| AC | Criterion | Size |
| --- | --- | --- |
| **1.6.1** Open the basket review | Given the basket has items, when the shopper presses "View basket", then the "Review your basket" screen opens listing each item with its details, quantity selector and bin button. | 3 |
| **1.6.3** Continue with an empty basket | Given the basket is empty, when the shopper presses "Compare Stores", then they stay on the basket screen and a message asks them to add at least one item. | 1 |
| **1.6.5** Basket panel beside the products | Given the shopper is on the Shop screen, when they add, change or remove items, then the "Your basket" panel beside the products updates immediately. | 3 |
| **1.6.6** Back to shop | Given the shopper is on the "Review your basket" screen, when they press "Back to shop", then the Shop screen opens with the basket unchanged. | 3 |
| **1.6.7** Basket panel when empty | Given the basket is empty, when the shopper views the "Your basket" panel, then it says the basket is empty and its "View basket" button is disabled. | 1 |
