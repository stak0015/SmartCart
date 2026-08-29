export type TransportMode = "walk" | "public_transport" | "motorcycle" | "car";
export type TravelLimitType = "distance" | "time";
export type SaraFilter = "any" | "candidate" | "verified";

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
  limit: {
    type: TravelLimitType;
    value: number;
  };
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

export type SaraStoreStatus = "verified" | "candidate" | "unverified";

export interface StoreRecommendation {
  premiseId: string;
  premiseCode: string;
  name: string;
  address: string | null;
  district: string | null;
  state: string | null;
  straightLineDistanceKm: number;
  routeDistanceKm: number;
  estimatedTravelMinutes: number;
  estimatedRoundTripCostRm: number;
  saraStatus: SaraStoreStatus;
  // Null when the store misses a price for at least one basket line (or no
  // basket was sent); missingItems then names the unpriced lines (AC 2.3.1).
  basketTotalRm: number | null;
  missingItems: string[];
  // SARA Credit / Cash Needed split of the basket total (AC 2.3.3/2.3.4);
  // candidate-based estimate, both null whenever the total is unavailable.
  saraCreditRm: number | null;
  cashNeededRm: number | null;
}

export interface RecommendationResponse {
  recommendations: StoreRecommendation[];
  totalCandidatesEvaluated: number;
  totalReachable: number;
  generatedAt: string;
  routeProvider: "google";
  rankingMethod: string;
  costAssumptions: Record<TransportMode, string>;
  routeWarning: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
