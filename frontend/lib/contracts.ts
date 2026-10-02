export type TransportMode = "walk" | "public_transport" | "motorcycle" | "car";
export type TravelLimitType = "distance" | "time" | "both";
export type SaraFilter = "any" | "candidate" | "verified";

export type ItemCategoryId =
  | "fresh-produce"
  | "protein"
  | "staples"
  | "cooking-ingredients"
  | "drinks-milk"
  | "snacks-convenience"
  | "baby-care"
  | "personal-health"
  | "household"
  | "education-reading"
  | "other";

export type ItemCategorySpendingClass = "essential" | "discretionary" | "mixed_or_unknown";

export interface ItemCategory {
  id: ItemCategoryId;
  labelEn: string;
  labelMs: string;
  spendingClass: ItemCategorySpendingClass;
}

/** The catalogue's specific source category, kept alongside its broad group. */
export interface SourceCategory {
  id: string;
  labelEn: string;
  labelMs: string;
}

export function isSourceCategory(value: unknown): value is SourceCategory {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const category = value as Record<string, unknown>;
  return typeof category.id === "string" && category.id.trim().length > 0
    && typeof category.labelEn === "string" && category.labelEn.trim().length > 0
    && typeof category.labelMs === "string" && category.labelMs.trim().length > 0;
}

export const ITEM_CATEGORY_IDS: readonly ItemCategoryId[] = [
  "fresh-produce", "protein", "staples", "cooking-ingredients", "drinks-milk",
  "snacks-convenience", "baby-care", "personal-health", "household", "education-reading", "other",
];

export const ITEM_CATEGORY_LABELS: Readonly<Record<ItemCategoryId, { en: string; ms: string }>> = {
  "fresh-produce": { en: "Fresh Produce", ms: "Hasil Segar" },
  protein: { en: "Meat, Seafood & Protein", ms: "Daging, Makanan Laut & Protein" },
  staples: { en: "Rice, Noodles & Bread", ms: "Beras, Mi & Roti" },
  "cooking-ingredients": { en: "Cooking Ingredients", ms: "Bahan Masakan" },
  "drinks-milk": { en: "Drinks & Milk", ms: "Minuman & Susu" },
  "snacks-convenience": { en: "Snacks & Convenience Foods", ms: "Snek & Makanan Mudah" },
  "baby-care": { en: "Baby Food & Care", ms: "Makanan & Penjagaan Bayi" },
  "personal-health": { en: "Personal Care & Health", ms: "Penjagaan Diri & Kesihatan" },
  household: { en: "Household Care", ms: "Penjagaan Rumah" },
  "education-reading": { en: "Education & Reading", ms: "Pendidikan & Bahan Bacaan" },
  other: { en: "Other", ms: "Lain-lain" },
};

export const ITEM_CATEGORY_SPENDING_CLASS: Readonly<Record<ItemCategoryId, ItemCategorySpendingClass>> = {
  "fresh-produce": "essential",
  protein: "essential",
  staples: "essential",
  "cooking-ingredients": "essential",
  "drinks-milk": "mixed_or_unknown",
  "snacks-convenience": "discretionary",
  "baby-care": "essential",
  "personal-health": "essential",
  household: "essential",
  "education-reading": "essential",
  other: "mixed_or_unknown",
};

export function isItemCategory(value: unknown): value is ItemCategory {
  if (!value || typeof value !== "object") return false;
  const category = value as Record<string, unknown>;
  return ITEM_CATEGORY_IDS.includes(category.id as ItemCategoryId)
    && typeof category.labelEn === "string" && category.labelEn.trim().length > 0
    && typeof category.labelMs === "string" && category.labelMs.trim().length > 0
    && (category.spendingClass === "essential"
      || category.spendingClass === "discretionary"
      || category.spendingClass === "mixed_or_unknown");
}

export type TravelLimit =
  | { type: "distance" | "time"; value: number }
  | { type: "both"; distanceKm: number; timeMinutes: number };

export interface BasketLineRequest {
  itemId: string;
  quantity: number;
}

export interface SelectedLocation {
  label: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  source: "device" | "search";
}

export interface TravelPreferencesRequest {
  origin: SelectedLocation;
  transportMode: TransportMode;
  limit: TravelLimit;
  saraFilter: SaraFilter;
}

export interface RecommendationRequest {
  basket?: BasketLineRequest[];
  travel: TravelPreferencesRequest;
  candidateCacheId?: string;
}

export interface CandidatePreparationResponse {
  candidateCacheId: string;
  candidateCount: number;
  reachableCount: number;
  generatedAt: string;
  expiresAt: string;
}

export interface LocationSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface LocationSearchResponse {
  suggestions: LocationSuggestion[];
}

export interface ResolvedLocation {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface ReverseLocationResponse {
  label: string | null;
}

export type SaraStoreStatus = "verified" | "candidate" | "unverified";
// A median price is a cached cross-store estimate, not a price observed at the
// selected store. Optional fields keep older API snapshots readable while the
// recommendation API rolls out the explicit source metadata.
export type PriceSource = "store" | "median";

export interface BasketItemPrice {
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  itemId: string;
  itemName: string;
  packageSize: string | null;
  quantity: number;
  unitPriceRm: number | null;
  lineTotalRm: number | null;
  priceObservedDate: string | null;
  priceSource?: PriceSource | null;
  saraEligible?: boolean | null;
  saraCategoryCandidate?: boolean;
  category: ItemCategory | null;
  sourceCategory?: SourceCategory | null;
}

// One basket line's priced detail at a store (AC 2.3.9), shown behind
// "View item prices"; price fields are null when the store has no valid
// price for the line.
export interface BasketLineDetail {
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  itemId: string;
  itemName: string | null;
  unit: string | null;
  quantity: number;
  unitPriceRm: number | null;
  lineTotalRm: number | null;
  observedDate: string | null;
  priceSource?: PriceSource | null;
  category: ItemCategory | null;
  sourceCategory?: SourceCategory | null;
}

export interface AlternativePriceItem {
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  imageUrl?: string | null;
  itemId: string;
  itemName: string | null;
  unit: string | null;
  packageSize: string | null;
  unitPriceRm: number | null;
  lineTotalRm: number | null;
  observedDate: string | null;
  priceObservedDaysAgo: number | null;
  priceSource?: PriceSource | null;
  saraEligible: boolean | null;
  saraCategoryCandidate: boolean;
  isSaraCreditCandidate: boolean;
  category: ItemCategory | null;
  sourceCategory?: SourceCategory | null;
}

// One pack size of the same product family priced at the selected store
// (AC 3.2.1); pricePerUnitRm is display-rounded, unitKind is "KG" or "L".
export interface PackSizeOption {
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  imageUrl?: string | null;
  itemId: string;
  itemName: string | null;
  packageSize: string | null;
  totalPriceRm: number | null;
  pricePerUnitRm: number | null;
  unitKind: string | null;
  observedDate: string | null;
  priceSource?: PriceSource | null;
  saraEligible: boolean | null;
  saraCategoryCandidate: boolean;
  isSaraCreditCandidate: boolean;
  // AC 3.2.2: exactly one option per comparison carries the "Best value"
  // label (lowest unit price, deterministic tie-break).
  isBestValue?: boolean;
  // AC 3.2.3: signed trade-off versus the Best value option (total-price and
  // unit-price differences), computed server-side; null on the Best value
  // card itself, which the UI marks as the comparison baseline.
  upfrontDiffRm?: number | null;
  perUnitDiffRm?: number | null;
  category: ItemCategory | null;
  sourceCategory?: SourceCategory | null;
}

export interface BasketAlternativeLine {
  quantity: number;
  source: AlternativePriceItem;
  alternative: AlternativePriceItem | null;
  savingsRm: number | null;
  // AC 3.2.1: comparable pack sizes at the selected store, cheapest unit
  // price first; empty when the item has no comparable multi-size family.
  packOptions?: PackSizeOption[];
}

export interface BasketAlternativesResponse {
  premiseId: string;
  lines: BasketAlternativeLine[];
  generatedAt: string;
}

export interface StoreRecommendation {
  premiseId: string;
  premiseCode: string;
  name: string;
  address: string | null;
  googlePlaceId?: string | null;
  district: string | null;
  state: string | null;
  straightLineDistanceKm: number;
  routeDistanceKm: number;
  estimatedTravelMinutes: number;
  estimatedRoundTripCostRm: number;
  basketCostRm: number;
  estimatedTotalCostRm: number | null;
  pricedItemCount: number;
  basketItemCount: number;
  isCompleteBasket: boolean;
  basketPrices: BasketItemPrice[];
  // Effective priced coverage includes store-observed and cached median lines.
  // These counts expose the exact-vs-estimated mix without changing ranking's
  // existing pricedCount semantics.
  storePriceCount?: number;
  medianPriceCount?: number;
  saraStatus: SaraStoreStatus;
  // Effective basket subtotal (AC 2.3.1): store-observed prices plus cached
  // median estimates. It remains partial when neither source exists for a
  // line, and is null when no basket line has an effective price.
  basketSubtotalRm: number | null;
  missingItems: string[];
  // Effective priced-item coverage ("X of N items priced"); null without a basket.
  pricedCount: number | null;
  basketLineCount: number | null;
  // SARA Credit / Cash Needed split of the displayed subtotal (AC 2.3.7/2.3.8);
  // candidate-based estimate, both null whenever the subtotal is unavailable.
  saraCreditRm: number | null;
  cashNeededRm: number | null;
  // Age in days of the store's oldest basket-line price (AC 2.3.5); null
  // when no basket line is priced at that store (or no basket was sent).
  priceObservedDaysAgo: number | null;
  // Priced basket subtotal plus return transport cost, including partial baskets.
  // Null when no line has a store or median price; unresolved prices never
  // contribute zero prices.
  combinedTotalRm: number | null;
  // Per-line priced detail behind "View item prices" (AC 2.3.9).
  basketLines: BasketLineDetail[];
  // True when the store is beyond the shopper's chosen travel limit and was
  // only shown because no store matched inside it (iteration1 feedback).
  exceedsLimit: boolean;
}

export interface RecommendationResponse {
  recommendations: StoreRecommendation[];
  totalCandidatesEvaluated: number;
  totalReachable: number;
  generatedAt: string;
  routeProvider: "google" | "straight_line";
  rankingMethod: string;
  costAssumptions: Record<TransportMode, string>;
  routeWarning: string | null;
  // True when no store matched the shopper's travel limit and the nearest
  // stores were returned anyway (iteration1 feedback).
  expandedSearch: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
