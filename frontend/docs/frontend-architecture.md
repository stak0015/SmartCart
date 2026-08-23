# Frontend architecture

## Why the prototype was restructured

The original Vite prototype kept four screens, mock data, icons and all state in
one large client component. The Next.js frontend separates routing, domain
logic, feature UI and data contracts so each user story can be developed and
tested without expanding a single file.

## Project map

```text
frontend/
  src/
    app/                       Next.js route entry points and metadata
    components/                Shared shell, progress and quantity controls
    features/
      basket/                  Epic 1 interface
      location/                Epic 2 travel-preference interface
      recommendations/         Epics 2, 3 and 4 result interfaces
      planner/
        types.ts               Stable frontend data contracts
        domain.ts              Pure filtering, basket and ranking rules
        planner-provider.tsx   Cross-route prototype state
        mock-data.ts           Clearly labelled illustrative records
        domain.test.ts         Acceptance-rule unit tests
database/                      Sibling PostgreSQL ingestion and verification
```

Route files remain Server Components. Interactive feature boundaries are Client
Components. The planner provider is mounted in the root layout so basket and
travel state survive client-side navigation.

## Current backlog coverage

| Epic or story | Prototype boundary |
| --- | --- |
| US 1.1 and 1.2 | Name search starts at two characters; category and search combine; results are alphabetical and capped at ten. |
| US 1.3 and 1.4 | Every result exposes name, brand, pack, unit and a validated 1-99 quantity before Add. |
| US 1.5 and 1.6 | Basket quantities update immediately, rows can be removed, and the summary gates travel navigation. |
| US 2.1 and 2.2 | Area, transport, distance and device-memory preferences drive the reachable-premise filter. |
| US 2.3 and 2.4 | Complete baskets are ranked by total, five at a time, with recommendation reasoning and partial baskets separated. |
| Epic 3 | A replace-item boundary shows upfront-price and unit-value trade-offs, then recalculates store totals. |
| Epic 4 | Verified-only labels and filters preserve unknown states; the optional planner estimates verified eligible spend, credit and cash. |

These are interaction and architecture slices, not claims that all stories are
finished. Distances, prices, premise names and verification labels are demo data.

## Production data boundary

Replace `mock-data.ts` with server-only repository functions rather than calling
PostgreSQL from Client Components. The adapter should map:

- `item` to catalogue identity, category and tri-state SARA eligibility;
- `premise` to identity and tri-state partner status;
- `current_status` to the latest recorded price for an item-premise pair.

The current schema does not contain coordinates, routes, current stock, brand
or structured pack-size fields. Do not invent them in the adapter. Obtain route
information from the selected mapping provider under its storage, attribution
and cost rules. Agree a documented source or schema extension before claiming
brand or package details are production data.

## Recommended development order

1. Add a server-only catalogue repository and replace the demo catalogue.
2. Add integration tests for database-to-frontend null and date semantics.
3. Select the mapping provider and implement a cost-controlled route adapter.
4. Replace demo premises and offers, keeping complete and partial totals distinct.
5. Implement Epic 3 recommendation rules with evidence and measurable tests.
6. Connect independently verified SARA data before removing demo labels.

Keep acceptance criteria, tests and LeanKit status aligned. A feature is not
complete merely because its prototype surface is visible.
