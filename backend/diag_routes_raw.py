"""One-off read-only: reproduce the failing Google Routes call in-process and print the raw error."""
import asyncio
import os
import traceback
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
for line in (BACKEND / ".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

import psycopg2  # noqa: E402

from smartcart.maps import GoogleMapsProvider  # noqa: E402

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute(
    "SELECT premise_id, google_place_id, premise_name FROM premise "
    "WHERE location_refreshed_at IS NOT NULL AND google_place_id IS NOT NULL "
    "ORDER BY premise_id LIMIT 3"
)
targets = cur.fetchall()
conn.close()
print("targets:", [(t[0], t[2]) for t in targets])


async def main() -> None:
    provider = GoogleMapsProvider()
    try:
        results = await provider.compute_route_matrix(
            origin={"latitude": 2.9379, "longitude": 101.6719},
            destination_place_ids=[t[1] for t in targets],
            mode="car",
        )
        print("ROUTE MATRIX OK:", len(results), "rows")
        for row in results:
            print("  ", row)
    except Exception as exc:  # noqa: BLE001 - diagnostic only
        print("EXC TYPE:", type(exc).__name__)
        print("EXC:", exc)
        traceback.print_exc()


asyncio.run(main())
