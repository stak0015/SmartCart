"""
SmartCart Backend API (FastAPI)
Startup command (run in the backend directory with virtual environment activated):
    uvicorn main:app --reload --port 8000
"""
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ---------- Load Configuration ----------
# The .env file should be placed in the same directory as this file (backend/.env)
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found. Please check if backend/.env has been created and configured.")


# ---------- Database Helper Functions ----------
def get_db_connection():
    """Return a new database connection. The caller is responsible for closing it."""
    return psycopg2.connect(DATABASE_URL)


# ---------- Create Application ----------
app = FastAPI(title="SmartCart API", version="0.1.0")

# CORS: Allow frontend at http://localhost:3000 to make cross-origin requests to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Health Check Endpoint ----------
@app.get("/api/health")
def health():
    """Verify that the backend is running and the database is connected. Expected item count is 757."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM item;")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {"status": "ok", "item_rows": count}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {exc}")


# ---------- Search Endpoint ----------
@app.get("/api/items/search")
def search_items(q: str = "", limit: int = 20):
    """
    Fuzzy search for items by keyword (case-insensitive).
    Returns, per item:
      - price:  the LOWEST observed price across all premises (headline), null if none
      - prices: the FULL per-premise price list, cheapest first [{premise_name, price}]
    The full list is returned so the UI can show every store's price; basket-level
    "cheapest store" ranking is a later epic (Compare screen).
    """
    # Safeguard: Limit the number of returned results to avoid fetching too many at once
    limit = max(1, min(limit, 100))
    keyword = f"%{q.strip()}%"  # Wrap with % for "contains" matching

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Query 1: items + lowest price headline.
        # LEFT JOIN so items without any recorded price still appear (price = NULL).
        cur.execute(
            """
            SELECT i.item_id, i.item_code, i.item_name, i.unit, i.item_group, i.item_category,
                   MIN(cs.current_price) AS price
            FROM item i
            LEFT JOIN current_status cs ON cs.item_id = i.item_id
            WHERE i.item_name ILIKE %s OR i.item_category ILIKE %s
            GROUP BY i.item_id, i.item_code, i.item_name, i.unit, i.item_group, i.item_category
            ORDER BY i.item_name
            LIMIT %s
            """,
            (keyword, keyword, limit),
        )
        columns = ["item_id", "item_code", "item_name", "unit", "item_group", "item_category", "price"]
        rows = [dict(zip(columns, row)) for row in cur.fetchall()]

        # Query 2: FULL per-premise prices for the returned items, cheapest first.
        item_ids = [row["item_id"] for row in rows]
        prices_by_item = {item_id: [] for item_id in item_ids}
        if item_ids:
            cur.execute(
                """
                SELECT cs.item_id, p.premise_name, cs.current_price
                FROM current_status cs
                JOIN premise p ON p.premise_id = cs.premise_id
                WHERE cs.item_id = ANY(%s)
                ORDER BY cs.current_price ASC
                """,
                (item_ids,),
            )
            for item_id, premise_name, price in cur.fetchall():
                prices_by_item[item_id].append(
                    {"premise_name": premise_name, "price": float(price)}
                )

        # psycopg2 returns Decimal for NUMERIC; convert to float so JSON serializes cleanly
        for row in rows:
            row["price"] = float(row["price"]) if row["price"] is not None else None
            row["prices"] = prices_by_item.get(row["item_id"], [])

        cur.close()
        conn.close()
        return {"count": len(rows), "items": rows}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")


# ---------- Categories Endpoint ----------
@app.get("/api/items/categories")
def list_categories():
    """
    Return all distinct item categories for use in frontend filter dropdowns.
    Returns: ["Dairy", "Beverages", ...]
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT item_category
            FROM item
            WHERE item_category IS NOT NULL AND item_category <> ''
            ORDER BY item_category
            """
        )
        categories = [row[0] for row in cur.fetchall()]
        cur.close()
        conn.close()
        return {"count": len(categories), "categories": categories}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {exc}")