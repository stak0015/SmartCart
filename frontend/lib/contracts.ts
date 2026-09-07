export type TransportMode = "walk" | "public_transport" | "motorcycle" | "car";
export type TravelLimitType = "distance" | "time" | "both";
export type SaraFilter = "any" | "candidate" | "verified";

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
  saraEligible?: boolean | null;
  saraCategoryCandidate?: boolean;
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
}

export interface AlternativePriceItem {
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  itemId: string;
  itemName: string | null;
  unit: string | null;
  packageSize: string | null;
  unitPriceRm: number | null;
  lineTotalRm: number | null;
  observedDate: string | null;
  priceObservedDaysAgo: number | null;
  saraEligible: boolean | null;
  saraCategoryCandidate: boolean;
  isSaraCreditCandidate: boolean;
}

// One pack size of the same product family priced at the selected store
// (AC 3.2.1); pricePerUnitRm is display-rounded, unitKind is "KG" or "L".
export interface PackSizeOption {
  itemNameEn?: string | null;
  itemNameMs?: string | null;
  itemId: string;
  itemName: string | null;
  packageSize: string | null;
  totalPriceRm: number | null;
  pricePerUnitRm: number | null;
  unitKind: string | null;
  observedDate: string | null;
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
  saraStatus: SaraStoreStatus;
  // Priced-basket subtotal (AC 2.3.1): sum of valid positive priced lines;
  // partial when the store misses prices and then always labelled
  // "Partial total", never the full basket cost (AC 2.3.3). Null when no
  // basket was sent or no basket line is priced.
  basketSubtotalRm: number | null;
  missingItems: string[];
  // Priced-item coverage ("X of N items priced"); null when no basket sent.
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
  // Null when no line is priced; missing prices never contribute zero prices.
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
