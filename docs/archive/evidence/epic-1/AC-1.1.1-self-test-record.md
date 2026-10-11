AC-1.1.1 Self-Test Record (2026-08-27)

Tester: 
Environment: localhost:3000 (Frontend) + localhost:8000 (FastAPI) + Local PostgreSQL (757 rows in item table)
TC   Result   Evidence   Notes
TC-01 Real Data Search   ✅   ac111-tc01.png

TC-02 Case Insensitivity   ✅   ac111-tc02.png

TC-03 No Results Message   ✅   ac111-tc03.png

TC-04 Clear to Initial State   ✅   ac111-tc04.png

TC-05 Lowest Price Headline   ✅   ac111-tc05.png   "From" price = first row price when expanded

TC-06 Store Price Expansion   ✅   ac111-tc06.png   Ascending order, first row highlighted green, collapsible

TC-07 Add to Cart & Total   ✅   ac111-tc07a/b.png   Total increment = "From" price; math checks out

TC-08 Honest Display for No Price   ✅   ac111-tc08.png   Add-to-cart disabled; no fabricated prices

Conclusion: All AC-1.1.1 test cases passed (8/8).

Known Limitation (Non-blocking): Some items lack price data — Root cause is incomplete coverage by the PriceCatcher data source (no records in current_status). The frontend accurately displays a notice and disables add-to-cart functionality. This is expected behavior by design. Logged as a team TODO (see issue log for data coverage quantification SQL and future directions).