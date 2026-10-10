# Epic 6 (US 6.1 + US 6.2) — Team Notes

Author: Randy · Branch: `randy/epic6` · Commits: `ed780d4` (US 6.1), `1db2652` (US 6.2) · Date: 2026-10-09

Status: US 6.1 (multi-store configuration) and US 6.2 (second-store travel
constraints) are implemented and tested. US 6.3 (basket split) and US 6.4
(presentation) are **not** started.

---

## 1. What is actually shipped

**US 6.1 — configuration layer (frontend only)**

- "Include multi-store plans" toggle, collapsed by default (AC 6.1.1)
- Second-store travel limit menu with Distance / Time / Both tabs (AC 6.1.2, 6.1.3, 6.1.7, 6.1.8)
- Preset buttons only, no free-text input (AC 6.1.3, 6.1.7)
- Single-select with `aria-pressed` highlight (AC 6.1.5)
- Helper text stating the limit governs **first store → second store** (AC 6.1.4)
- Apply re-triggers the recommendation request; toggling off restores single-store
  without touching the basket (AC 6.1.6, 6.1.9)
- Blocking validation that names the missing group, never silently defaults (AC 6.1.10)

**US 6.2 — travel constraint layer (backend + one frontend empty state)**

- Two independent rule sets: home→first store uses the original limit,
  first→second store uses the second-store limit (AC 6.2.1)
- Distance and time are hard constraints; Both is AND, not OR (AC 6.2.2–6.2.4)
- Both visit orders (A→B and B→A) are routed and the cheaper total wins (AC 6.2.5)
- Total cost covers the full loop: home → first → second → home (AC 6.2.6)
- Missing route data excludes the plan instead of inventing a cost (AC 6.2.7)
- No qualifying plans → single-store results stay, with an explainable empty
  state and an "Edit limits" entry point (AC 6.2.8)

**Deliberately out of scope for US 6.2:** splitting the basket between stores,
and rendering plan cards. The backend already returns `multiStore.plans`, but the
frontend does not display them yet — that is US 6.3 / US 6.4.

---

## 2. Where merge conflicts are likely

Ordered by risk. Files I did **not** touch are omitted.

### HIGH — expect conflicts, resolve by hand

| File | What I changed | Why it conflicts |
|---|---|---|
| `frontend/components/smartcart-app.tsx` | +53 lines: imports, `multiStoreEmptyMessage()` helper (near `transportLabel`), `multiStore` state next to `preferences`, two new props on `CompareScreen`, `requestSecondStoreLimit` snapshot in the request effect, `<MultiStorePanel>` render, AC 6.2.8 empty-state block | ~2,700-line file that every epic touches. Anyone editing `CompareScreen`, the request effect, or app-level state will collide. |
| `frontend/lib/i18n.ts` | +22 lines: 6 new keys in **both** `COPY.en` and `COPY.ms` | Everyone appends keys to the same two object literals. `COPY` is `as const`, so a key missing from either table is a compile error, not a silent gap. |
| `frontend/lib/contracts.ts` | +59 lines: `RouteLeg`, `MultiStorePlan`, `MultiStorePlans`, `MultiStoreEmptyReason`, optional `multiStore` on `RecommendationResponse` | Shared type surface; several epics add response fields in the same block. |
| `backend/smartcart/api.py` | +151 lines: imports, `_build_multi_store_plans()`, cache bypass, explicit `expanded_candidates` selection in the expanded-search branch, `multi_store=` in response assembly | The recommendations endpoint is the shared trunk. Note especially the cache bypass — see §3. |
| `backend/smartcart/models.py` | +72 lines: `second_store_limit` on `RecommendationRequest`, three new models, `multi_store` on `RecommendationResponse` | Everyone adds fields to these two classes. |

### MEDIUM

| File | What I changed |
|---|---|
| `backend/smartcart/maps.py` | `RouteMatrixResult` gained `origin_index: int = 0` **at the end**; new method `compute_route_matrix_multi_origin()`. The existing `compute_route_matrix()` is **unchanged**. If someone else appends a field to that dataclass in the same position, expect a conflict — keep both fields, order does not matter since they have defaults. |
| `frontend/lib/inbox.test.ts` | **DELETED** |
| `frontend/lib/period-analytics.test.ts` | **DELETED** |
| `frontend/lib/report-generation.test.ts` | **DELETED** |

> **About the three deleted test files** — read this before merging.
>
> They were deleted on the instruction of a teammate ("they are not used any
> more"). They failed at load time because their fixtures
> (`tests/fixtures/reports/G3-analytics-golden.json` and
> `G4-report-response.json`) were never committed and are not gitignored, so
> they exist on nobody's checkout.
>
> Two things worth flagging:
>
> 1. If your branch **modified** any of these three files, git will raise a
>    delete/modify conflict. Keep your version, or confirm the deletion.
> 2. They tested Epic 8 report code that is still running in production
>    (`smartcart-app.tsx` still calls `requestGeneratedReport` and
>    `saveReadyReport`). So this was not dead code — it was live code with its
>    tests removed. If the fixtures can be regenerated, restoring these three
>    files (plus the fixtures) is the better outcome. They are recoverable via
>    `git checkout ed780d4^ -- frontend/lib/inbox.test.ts` etc.
>
> The same two missing fixtures also break **three backend test files**:
> `test_period_analytics.py`, `test_report_api.py`, `test_cerebras_narrator.py`.
> Those still exist but cannot be collected. I left them alone.

### LOW — appended at end of file

| File | What I changed |
|---|---|
| `backend/smartcart/premises.py` | +44 lines: `get_premise_coordinates()` appended at end of file. `find_nearest_premises` and its SQL column order are **untouched** (deliberately — `test_premises.py` hard-codes a 10-column row tuple and would break on a column insert). |
| `backend/smartcart/recommendation.py` | +22 lines: `estimate_one_way_leg_cost_rm()` appended. `estimate_round_trip_cost_rm` is unchanged. |

### New files — no conflict possible

`backend/smartcart/multi_store.py`, `backend/tests/test_multi_store.py`,
`backend/tests/test_multi_store_api.py`, `frontend/lib/multi-store.ts`,
`frontend/lib/multi-store.test.ts`, `frontend/components/multi-store-panel.tsx`.

---

## 3. Design decisions you should know about

### 3.1 "Straight-line pre-filter + all candidates" (quota policy)

**The problem.** AC 6.2.5 requires routing **both** visit orders, and AC 6.2.6
requires the full loop. That means we need store-to-store routes, not just
home-to-store. With N reachable stores that is up to N×(N−1) route elements
**per recommendation request**, on top of the existing N home routes. We share
one Google API key, so this is a team-wide quota decision, not a personal one.

Options considered:

| Option | Route elements (N=25) | vs. today |
|---|---|---|
| Today (single store) | 25 | 1× |
| Pre-filter + all candidates ← **chosen** | ≤ 600, typically far fewer | adaptive |
| Pre-filter + only top-K first stores (K=6) | ≤ 150 | capped, but can miss a plan where a low-ranked single store wins once the basket splits |
| No pre-filter, route every pair | 625, always | 25× |

**What "pre-filter" means and why it is lossless.** Before calling Google, we
drop any store pair whose **great-circle** distance already exceeds the largest
second-store preset (15 km). Straight-line distance is always ≤ road distance,
so a pair that fails the straight-line test can never satisfy the real limit —
excluding it cannot drop a valid plan. Same principle as the existing
`maximum_straight_line_km` pre-filter in `premises.py`. Implemented as
`haversine_km` + `select_pairs_for_routing` in `multi_store.py`.

Our 100 located stores are geographically scattered (Kelantan, Negeri Sembilan,
Putrajaya, …), so in practice the pre-filter removes most pairs and the quota
increase is small. Dense clusters cost more — worst case 600 elements, still
inside Google's 625-per-request limit, so **no batching is needed at the default
25 candidates**. Batching is implemented anyway because
`route_matrix_candidate_limit` is configurable up to 49, and 49×48 = 2,352 would
exceed the limit.

**If quota becomes a problem**, the knob is in `multi_store.py`
(`select_pairs_for_routing`): cap the number of first-store candidates, or cap
total pairs. Both are single-constant changes and do not require touching the
endpoint.

### 3.2 "Public transport: implement as supported, decide after real testing"

Iteration 3 says: *"If public transport routing or fare data cannot support
inter-store journeys, show multi-store mode as unavailable for that mode."*

We chose **not** to pre-emptively disable multi-store for transit. Reasoning:
Google Routes does support multi-leg transit routing, so the capability probably
exists. And AC 6.2.7 already gives us a safe failure path — if the inter-store
transit leg cannot be routed, the plan is **excluded** and the empty state says
so. We never fabricate a fare.

So the behaviour today is: transit multi-store requests are attempted; pairs
without usable transit route data silently drop out; if nothing qualifies the
shopper sees the AC 6.2.8 empty state rather than a fake number.

**Open question to settle during browser testing:** if transit legs turn out to
be unavailable most of the time, transit shoppers will see a permanently empty
multi-store section. At that point we should switch to the explicit "unavailable
for this mode" treatment from the spec. The copy key for it
(`multiStoreNotAvailableForMode`) is **not** added yet, because claiming a mode
is unsupported without evidence would be worse than an empty result.

### 3.3 Cache bypass — this one can silently break AC 6.1.9

The `/api/recommendations/prepare` endpoint builds a candidate snapshot
**without** a second-store limit, so a cached response has `multiStore = None`.
If a shopper then presses "Apply limits" and the request hits that cache, it
returns early and the result visibly does not change — which is exactly what
AC 6.1.9 forbids.

Fix: when `second_store_limit` is present, the candidate cache is bypassed and
the request is recomputed. Requests **without** the limit still use the cache as
before. Both directions are covered by tests in `test_multi_store_api.py`.

If you change caching behaviour in `api.py`, please keep these two tests green.

---

## 4. Compatibility guarantees (why your tests should still pass)

Deliberate choices made to avoid breaking other epics:

- `RouteMatrixResult.origin_index` was added **last, with a default**, so
  positional construction like `RouteMatrixResult(0, 2000, 601)`
  (`test_api.py:33`) still works.
- `compute_route_matrix()` was **not modified**. Multi-origin support is a new
  method, so `FakeMapsProvider` in `test_api.py` (three positional args) is
  unaffected.
- `PremiseCandidate` and `find_nearest_premises` were **not modified**. Store
  coordinates come from a new separate query, so the hard-coded 10-column row
  tuple in `test_premises.py` is safe.
- `second_store_limit` and `multi_store` are both optional with `None` defaults.
  A pre-Epic-6 client gets a byte-identical response shape — asserted by
  `test_no_second_store_limit_returns_no_multi_store_block`.
- `DISTANCE_LIMITS` / `TIME_LIMITS` were **moved** from inside
  `smartcart-app.tsx` into `frontend/lib/multi-store.ts` and re-imported. AC
  6.1.3 / 6.1.7 require both menus to offer "the same configured options", so
  there is now a single source of truth instead of two copies. If you changed
  those preset values, change them in `multi-store.ts`.

---

## 5. Test status

| Suite | Result |
|---|---|
| `backend/tests/test_multi_store.py` | 31 passed |
| `backend/tests/test_multi_store_api.py` | 7 passed |
| Backend runnable suite (excluding the 3 fixture-blocked files) | 131 passed |
| `frontend` `tsc --noEmit` | 0 errors |
| `frontend` `eslint` (changed files) | 0 errors |
| `frontend` `vitest run` | 294 passed / 30 files |

Blocked, pre-existing, unrelated to Epic 6: `test_period_analytics.py`,
`test_report_api.py`, `test_cerebras_narrator.py` cannot be collected because
`tests/fixtures/reports/G3-analytics-golden.json` and `G4-report-response.json`
are missing. Same root cause as the three deleted frontend files (§2).

### Environment note

`backend/.venv` was missing packages that `requirements.txt` and
`requirements-dev.txt` already declare (`pytest`, `httpx`, `httpx2`,
`cerebras-cloud-sdk`). I installed exactly those, from the declared files, with
no version overrides. If your venv cannot collect tests, run:

```powershell
cd D:\MonashStudy\5120\Project\SmartCart\backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

(`html-to-image` was similarly declared-but-uninstalled on the frontend; a
`pnpm install` in `frontend/` fixes it and clears the one `tsc` error it caused.)

---

## 6. One bug worth knowing about

My first `haversine_km` returned **double** the correct distance (KLCC→Putrajaya
came out as 49.7 km instead of ~24.9 km) because I wrote `R * 2 * acos(...)`
where `acos(1 − 2a)` already equals `2·asin(√a)`.

Consequence if it had shipped: the pre-filter would halve every effective limit
—a 5 km setting would only admit pairs within 2.5 km—**silently dropping valid
two-store plans**. No error, no warning, just fewer results. Caught by
`test_haversine_matches_known_distance`. Flagging it because pre-filters that
are too strict fail invisibly, which is the worst failure mode for a
quota-optimisation step.

---

## 7. What US 6.3 / 6.4 will need from this

- `MultiStorePlan` currently carries **no basket information** — only store
  identity, the three legs, and travel cost. US 6.3 needs to attach a split
  basket (which items at which store) and a combined product + travel cost.
- `multiStore.plans` is already in the response contract and already parsed by
  the frontend types. US 6.4 only needs to render it; no contract change should
  be required for display.
- Plan ordering is by total travel cost only (AC 6.2.5). Once US 6.3 adds basket
  cost, the ranking key should become the combined total — that is a change in
  `multi_store.py`, not in `api.py`.
