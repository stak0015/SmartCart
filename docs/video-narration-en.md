# SmartCart — Video Narration Script (English)

> Purpose: narration track for a ~6–8 minute demo video. Section timings are guides; pause between sections while the screen catches up.
> Presenter note: read at a calm pace; keep the UI in sync with the spoken step.

---

## 0. Opening (0:00–0:30)

Welcome. This is SmartCart — an application that helps low-income households in Malaysia find the most affordable place to do their grocery shopping. It works with the official SARA programme catalogue and real PriceCatcher store price data.

The idea is simple but important for a household on a tight budget: the best store is not always the one with the cheapest shelf prices, because you also have to *get there*. So SmartCart combines the basket price with the estimated return transport cost, and ranks stores by that combined total.

We built the system across three epics. Epic one builds the shopping basket from the official catalogue. Epic two recommends reachable stores. Epic three finds cheaper alternatives for expensive items and shows the potential savings. Let me walk you through all of it.

---

## 1. Epic 1 — Building the basket (0:30–2:00)

We start on the search screen. The catalogue contains around seven hundred and fifty official items, so we never load it all at once. When the shopper types, the search is debounced, and only complete queries of two characters or more hit the database. Results come back from the backend, paginated at twenty-five items per page.

Let me search for "ayam". We get results with the official item name, package size and category, and I can narrow them down with category filters. Every result row has a quantity control, validated between one and ninety-nine.

I'll add this chicken to the basket with quantity two. Notice that adding the same item again increases the quantity rather than creating a duplicate line. In the basket I can review everything, adjust quantities, or remove items. This basket is now the input for the whole recommendation engine.

---

## 2. Epic 2 — Finding reachable stores (2:00–3:30)

Next, the travel preferences. The shopper picks a starting location — here I search for Putrajaya and confirm the suggestion from the official Places service. Then the transport mode — car, motorcycle, public transport, or walking — and a travel limit, for example ten kilometres.

When we press "Find reachable stores", the backend resolves every PriceCatcher premise that can be reached within the limit, prices the whole basket at each one, and ranks them. The ranking key is the priced basket subtotal *plus* the estimated return transport cost — so a slightly cheaper store that is much further away will not win.

Stores with a complete basket appear first. If some items have no price at a store, that store moves to the incomplete tab, and the interface is honest about it: it lists which items are missing and states that their prices are excluded from the displayed totals.

---

## 3. Epic 2.4 — The recommendation overview (3:30–4:45)

Every store card has a clearly labelled "Select store" button, accessible by keyboard and screen reader. Let me select one.

This opens the recommendation overview for that exact store — and it keeps the store, the basket and the travel preferences frozen, so nothing can silently change underneath it. The page shows everything a shopper needs for the decision: store identity and SARA status, the basket-plus-transport total, the priced subtotal, the return travel cost, one-way distance and time, the transport mode and travel limit, and how many of the basket items are priced here.

Below that, every basket line is listed with its unit price, quantity, line total and the PriceCatcher observation date. Lines without a price stay visible — they are never shown as zero ringgit. At the bottom, the notes are transparent: route values are estimates, and the ranking is subtotal plus return transport. We deliberately make no affordability or stock claims.

---

## 4. Epic 3 — Smart Budget Alternatives (4:45–6:30)

Now the money-saving layer. Before any change, the basket screen sets expectations: "No savings applied yet", with a pointer to the Smart Budget Alternatives section.

Back in the store overview, the system compares each expensive basket line with cheaper equivalents at the same store. Where a cheaper pack exists, it offers a "Swap & save" action; where nothing cheaper exists, it says so plainly instead of inventing a suggestion.

Let me apply a swap. The basket line is replaced, and the original item is recorded underneath, so an undo always restores exactly what was there before.

And this is where the savings summary comes in — the work we are most proud of in this epic. The summary shows the original total, the new total, and the difference, labelled clearly as "You save". Below it, every replaced item carries its own saving. The arithmetic is guaranteed by construction: the per-item savings always sum to the total, and the total always equals original minus new — there is no way for these numbers to disagree, which matters when a household is deciding whether the cheaper option is worthwhile.

One undo, and everything returns to the honest empty state.

---

## 5. Closing (6:30–7:00)

That is SmartCart end to end: an official-catalogue basket, reachability-aware store ranking, transparent cost breakdowns, and verified savings arithmetic — all designed for a household that needs every ringgit to count. Thank you.

---

## Timing summary

| Section | Content | Suggested length |
|---|---|---|
| 0 | Opening | ~30 s |
| 1 | Epic 1 basket | ~90 s |
| 2 | Epic 2 reachable stores | ~90 s |
| 3 | Epic 2.4 overview | ~75 s |
| 4 | Epic 3 alternatives + savings | ~105 s |
| 5 | Closing | ~30 s |
| **Total** | | **~7 min** |

## Presenter checklist before recording

- [ ] Docker Desktop running; database container up
- [ ] Backend started; `/api/health` returns ok
- [ ] Frontend started; location autocomplete returns suggestions (valid API key)
- [ ] Demo basket prepared: ayam × 2, mutton × 1
- [ ] A store with a "Swap & save" button located in advance (saves dead air)
- [ ] Zoom the browser in one step so text is readable in the recording
