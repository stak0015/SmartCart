export type VerificationStatus = "verified" | "unverified";

export interface CatalogueItem {
  itemId: string;
  itemCode: string;
  name: string;
  brand?: string;
  unit: string;
  category: string;
  saraEligibility: VerificationStatus;
}

export interface BasketLineRequest {
  itemId: string;
  quantity: number;
}

export interface TravelPreferencesRequest {
  locationText: string;
  latitude?: number;
  longitude?: number;
  transportMode: "walk" | "public_transport" | "motorcycle" | "car";
  maximumDistanceKm: number;
  verifiedSaraPartnersOnly: boolean;
  saraCreditAvailable?: number;
}

export interface RecommendationRequest {
  basket: BasketLineRequest[];
  travel: TravelPreferencesRequest;
  limit: number;
  offset: number;
}

export interface RecommendationItemPrice {
  itemId: string;
  unitPrice: number | null;
  observedDate: string | null;
  saraEligibility: VerificationStatus;
}

export interface StoreRecommendation {
  premiseId: string;
  name: string;
  distanceKm: number;
  estimatedTravelMinutes: number | null;
  completeBasket: boolean;
  basketTotal: number | null;
  verifiedSaraPartner: boolean;
  prices: RecommendationItemPrice[];
}

export interface BudgetAlternative {
  originalItemId: string;
  alternativeItemId: string;
  alternativeName: string;
  immediatePrice: number;
  pricePerUnit: number;
  unit: string;
  immediateSaving: number;
  bestValuePerUnit: boolean;
}

export interface RecommendationResponse {
  recommendations: StoreRecommendation[];
  alternatives: BudgetAlternative[];
  totalResults: number;
  priceDataRefreshedAt: string;
}
