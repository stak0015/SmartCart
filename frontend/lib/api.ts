// Unified wrapper for backend calls. All frontend requests go through here.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// One store's price for an item (cheapest-first list comes from backend)
export interface StorePrice {
  premise_name: string | null;
  price: number;
}

// Shape of an item (matches backend response, Step 7 v2)
export interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  unit: string | null;
  item_group: string | null;
  item_category: string | null;
  price: number | null;   // lowest observed price (headline); null if not recorded
  prices: StorePrice[];   // ALL stores carrying this item, cheapest first
}

// Shape of the search endpoint response
export interface SearchResult {
  count: number;
  items: Item[];
}

// Shape of the categories endpoint response
export interface CategoriesResult {
  count: number;
  categories: string[];
}

/**
 * Search items by keyword
 */
export async function searchItems(q: string, limit = 20): Promise<SearchResult> {
  const url = `${API_BASE}/api/items/search?q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Search failed: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Get all item categories
 */
export async function listCategories(): Promise<CategoriesResult> {
  const url = `${API_BASE}/api/items/categories`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch categories: HTTP ${res.status}`);
  }
  return res.json();
}