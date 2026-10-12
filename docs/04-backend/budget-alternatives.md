# Budget alternatives (Epic 3)

At one chosen store, each basket line can get a **cheaper equivalent** (a similar product that costs less) and a list of **pack-size options** (other sizes of the same product, compared per kg or litre). The shopper can apply either and undo it.

Endpoint: `POST /premises/{premise_id}/basket-alternatives`. Code: `backend/smartcart/alternatives.py`, `pack_ratios.py`. Frontend: `components/recommendation-basket-row.tsx`, `lib/basket-state.ts` (replacement and undo).

All queries run in one database cursor per request (`get_basket_alternatives_with_pack_options`). The store must be `open`, otherwise `404 PREMISE_NOT_FOUND`.

## Cheaper equivalent

A candidate qualifies for a basket line when **all** hold:

| Condition | Why |
| --- | --- |
| The basket item has an observed **store** price at this premise (not a median) | Never claim a saving against an estimate |
| Candidate has a store price at the same premise | Both prices must be real observations |
| Same raw PriceCatcher category | Keep the product type |
| Same package basis (e.g. `425G`, `1KG`, `2X1L`) | Savings compare equal quantities |
| Name similarity ≥ 0.67 (token Jaccard) | "Similar product", not just same category |
| Candidate line total < basket line total | Must actually be cheaper |

**Name normalisation** (`alternative_name_tokens`): uppercase; `&` → `AND`; remove `PELBAGAI JENAMA`, multipack and pack-size tokens; remove the `CAP …`/`JENAMA …` brand segment but keep percentage grades; keep parenthetical text (it often names the variant); split into alphanumeric tokens. Similarity = |A ∩ B| / |A ∪ B|.

**Choice** among qualifying candidates: highest similarity, then lowest line total, then freshest observation, then name, then item ID. `savingsRm` = basket line total − alternative line total (Decimal, cents); null if not positive.

## Pack-size options

Shown only for lines with a store price, when the product family has **at least two distinct package sizes** priced at this store.

1. **Family key** (`_pack_comparison_family`): the name before any brand marker (`CAP`, `JENAMA`, `PELBAGAI JENAMA`), with sizes and multipacks removed.
2. **Comparable quantity**: `item.quantity_value` in kg or litres and `item.quantity_unit` (`KG` or `L`), parsed at ingestion (`migrate_pack_quantities.py`). Items without a parsed quantity are left out. KG and L families never mix.
3. **Unit price** = pack price ÷ quantity (Decimal, full precision).
4. Options are sorted by unit price, then newest observation, name and item ID. The first is **Best value**. Every other option shows its upfront and per-unit difference from Best value (rounded to cents only for display).

## Applying a swap (frontend)

- Applying replaces the basket line immediately, keeps its quantity and every other line, and stores the original under `replacement` (`kind: "lower_cost"` or `"pack"`, with both unit prices and observed dates) so **Undo** restores it exactly.
- Totals update without reloading. If the suggested item is already in the basket, its button reads *Already in basket* and is disabled, so no duplicate line is created.
- SARA status shown for the swapped item is the new item's own status.
- When a cost change cannot be computed (missing price), the UI says so rather than showing RM0.
- Applied swaps feed the *item-change impact* in Epic 8's estimated savings.
