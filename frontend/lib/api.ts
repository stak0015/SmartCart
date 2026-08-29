// Epic 1 catalogue calls use the same FastAPI base as every other feature.
import { API_BASE_URL } from "./api-base";

// Shape of an item (matches backend response, Step 7 v2)
export interface Item {
  item_id: number;
  item_name: string;
  unit: string | null;
  item_category: string | null;
  package_size: string | null;   // merged quantity/pricing basis: parsed size, else unit; null = show "—"
  sara_eligible: boolean | null; // null means eligibility has not been verified
  sara_category_candidate: boolean; // broad category match; still requires label/barcode verification
}

// Shape of the search endpoint response
export interface SearchResult {
  count: number;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  sara_category_source: {
    url: string;
    programmeYear: number;
    reviewedAt: string;
  };
  items: Item[];
}

// Shape of the categories endpoint response
export interface CategoriesResult {
  count: number;
  categories: string[];
}

/**
 * Search items by keyword
 * @param q - Search query
 * @param page - Page number (starts from 1)
 * @param categories - Optional category filters
 * @param signal - AbortSignal for cancelling requests
 */
export async function searchItems(
  q: string,
  page = 1,
  categories: string[] = [],
  signal?: AbortSignal,
): Promise<SearchResult> {
  // FIX: Explicitly set page_size to 25 to meet AC-1.1.2
  const params = new URLSearchParams({ 
    q, 
    page: String(page),
    page_size: "25" // <--- Added this line!
  });
  
  categories.forEach(category => params.append("category", category));
  
  const url = `${API_BASE_URL}/items/search?${params.toString()}`;
  
  const res = await fetch(url, { signal });
  
  if (!res.ok) {
    throw new Error(`Search failed: HTTP ${res.status}`);
  }
  
  return res.json();
}

/**
 * Get all item categories
 */
export async function listCategories(signal?: AbortSignal): Promise<CategoriesResult> {
  const url = `${API_BASE_URL}/items/categories`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch categories: HTTP ${res.status}`);
  }
  return res.json();
}