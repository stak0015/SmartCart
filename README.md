# SmartCart

SmartCart is an accessible household-essential basket planner for the FIT5120
SDG 10 industry experience project. It helps a shopper plan one affordable,
reachable single-premise trip using Malaysian PriceCatcher data.

## Frontend quick start

The frontend is a Next.js 16 App Router application in `frontend/`.

```powershell
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The current prototype contains three routes:

- `/basket` - item search, category browse, quantity entry and basket review.
- `/location` - area, transport, distance and optional SARA-partner filters.
- `/recommendations` - complete-basket ranking, partial-result separation,
  budget alternatives and an optional SARA credit/cash estimate.

Run the quality checks before opening a pull request:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

The frontend uses deliberately labelled demo records while the server-side data
adapter and mapping provider are developed. Do not remove the demo caveats or
turn missing price, SARA or stock data into negative claims.

The code is organised by feature under `frontend/src/features`;
`frontend/src/app` contains only the route entry points and shared layout. See
[`frontend/docs/frontend-architecture.md`](frontend/docs/frontend-architecture.md)
for the story mapping and integration boundaries.

## Database

For a beginner-friendly local database walkthrough, start with
[`database/SETUP_GUIDE.md`](database/SETUP_GUIDE.md). Technical ingestion and
maintenance details are in [`database/README.md`](database/README.md).
