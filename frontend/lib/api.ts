// Epic 1 catalogue calls use the same FastAPI base as every other feature.
import { API_BASE_URL } from "./api-base";
import type { ItemCategory, SourceCategory } from "./contracts";

export interface CataloguePriceRange {
  min_rm: number;
  max_rm: number;
  store_count: number;
  oldest_observed_date: string | null;
  price_source?: "store" | "median";
}

// Shape of an item (matches backend response, Step 7 v2)
export interface Item {
  item_id: number;
  item_code: string;
  item_name: string;
  item_name_en?: string | null;
  item_name_ms?: string | null;
  unit: string | null;
  item_category: string | null;
  category: ItemCategory | null;
  source_category?: SourceCategory | null;
  package_size: string | null;   // merged quantity/pricing basis: parsed size, else unit; null = show "—"
  image_url?: string | null;
  sara_eligible: boolean | null; // null means eligibility has not been verified
  sara_category_candidate: boolean; // broad category match; still requires label/barcode verification
  price_range?: CataloguePriceRange | null;
}

// Shape of the search endpoint response
export interface SearchResult {
  price_context?: "ready" | "unavailable";
  price_store_count?: number;
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
  categories: ItemCategory[];
}

/**
 * Search items by keyword
 */
export type CatalogueSort = "price_asc" | "price_desc" | "name_asc" | "name_desc";

export async function searchItems(
  q: string,
  page = 1,
  categories: string[] = [],
  signal?: AbortSignal,
  candidateCacheId?: string | null,
  pageSize = 25,
  options?: { saraCategoryOnly: boolean; sort: CatalogueSort; locale: "en" | "ms" },
): Promise<SearchResult> {
  const params = new URLSearchParams({ q, page: String(page) });
  categories.forEach(category => params.append("category", category));
  if (candidateCacheId) params.set("candidate_cache_id", candidateCacheId);
  if (pageSize !== 25) params.set("page_size", String(pageSize));
  if (options) {
    params.set("sara_category_only", String(options.saraCategoryOnly));
    params.set("sort", options.sort);
    params.set("locale", options.locale);
  }
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

// ---------------------------------------------------------------------------
// Epic 7 — Healthier alternatives and nutrition insights (US 7.1-7.3)
// ---------------------------------------------------------------------------

export type NutritionBasis = "per_100g" | "per_100ml";
export type NutrientStatus = "comparable" | "non_comparable" | "unavailable";

// Mirrors the /items/search row so an alternative opens with the same controls.
export interface CatalogueItemSummary {
  item_id: number;
  item_code: string;
  item_name: string;
  item_name_en?: string | null;
  item_name_ms?: string | null;
  unit: string | null;
  item_category: string | null;
  package_size: string | null;
  image_url?: string | null;
  sara_eligible: boolean | null;
  sara_category_candidate: boolean;
  category: ItemCategory | null;
  source_category?: SourceCategory | null;
  // Same nearby-store range the search row carries.
  price_range?: CataloguePriceRange | null;
}

export interface NutritionSourceRef {
  dataset: string;
  dataset_name: string;
  record_code: string;
  description: string;
  basis: NutritionBasis;
}

export interface NutrientComparison {
  nutrient: string;
  label: string;
  unit: string;
  original_value: number | null;
  alternative_value: number | null;
  // "unavailable" means no value in the dataset — never rendered as zero.
  status: NutrientStatus;
}

export interface HealthierAlternative {
  item: CatalogueItemSummary;
  rule: string;
  headline: string;
  intention: { en: string; ms: string };
  usage_note: { en: string; ms: string };
  comparison_nutrient: string;
  comparison_category?: string | null;
  missing_guard_nutrients?: string[];
  comparison_direction: "lower_is_better" | "higher_is_better";
  original_source: NutritionSourceRef;
  alternative_source: NutritionSourceRef;
  generic_mapping: boolean;
  nutrients: NutrientComparison[];
}

export interface HealthierAlternativesResult {
  item_code: string;
  count: number;
  alternatives: HealthierAlternative[];
}

/**
 * Approved healthier alternatives for one catalogue item (Epic 7).
 */
export async function fetchHealthierAlternatives(
  itemCode: string,
  candidateCacheId?: string | null,
  signal?: AbortSignal,
): Promise<HealthierAlternativesResult> {
  const params = new URLSearchParams();
  if (candidateCacheId) params.set("candidate_cache_id", candidateCacheId);
  const query = params.toString();
  const url = `${API_BASE_URL}/items/${encodeURIComponent(itemCode)}/healthier-alternatives${query ? `?${query}` : ""}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Healthier alternatives failed: HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Item nutrition (independent of healthier-alternative recommendations)
// ---------------------------------------------------------------------------

export type ItemNutritionMatchType = "generic" | "product";

export interface NutritionSourceMetadata {
  id: string;
  name: string;
  url: string;
  license: string;
  carbohydrate_definition?: string | null;
  energy_conversion?: string | null;
}

export interface ItemNutritionFood {
  id: string;
  source_code: string;
  description: string;
  basis: NutritionBasis | string;
  url?: string | null;
  nutrients: Record<string, number | null>;
  carbohydrate_definition?: string | null;
  energy_conversion?: string | null;
  source_edition?: string | null;
}

export interface ItemNutritionResult {
  item_code: string;
  available: boolean;
  match_type: ItemNutritionMatchType | null;
  rationale: string | null;
  source: NutritionSourceMetadata | null;
  food: ItemNutritionFood | null;
}

/** Reviewed nutrition data for a catalogue item, when an approved mapping exists. */
export async function fetchItemNutrition(
  itemCode: string,
  signal?: AbortSignal,
): Promise<ItemNutritionResult> {
  const url = `${API_BASE_URL}/items/${encodeURIComponent(itemCode)}/nutrition`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Item nutrition failed: HTTP ${res.status}`);
  }
  return res.json();
}
