export const CATEGORIES = [
  "Rice & Grains",
  "Cooking Oil",
  "Eggs & Dairy",
  "Vegetables",
  "Meat & Fish",
  "Beverages",
  "Household Essentials",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type SaraVerification = true | false | null;
export type TravelMode = "walking" | "public-transport" | "motorcycle" | "car";

export interface CatalogItem {
  id: string;
  itemCode: string;
  name: string;
  brand: string;
  packageSize: string;
  unit: string;
  category: Category;
  saraEligible: SaraVerification;
}

export interface BasketLine {
  itemId: string;
  quantity: number;
}

export interface TravelPreferences {
  area: string;
  mode: TravelMode;
  maxDistanceKm: number;
  rememberOnDevice: boolean;
  saraPartnersOnly: boolean;
}

export interface StoreOffer {
  itemId: string;
  price: number;
  priceObservedDate: string;
}

export interface Store {
  id: string;
  premiseName: string;
  area: string;
  distanceKm: number;
  travelMinutes: number;
  saraPartner: SaraVerification;
  offers: StoreOffer[];
}

export interface RankedStore extends Store {
  basketTotal: number;
  missingItemIds: string[];
  isCompleteBasket: boolean;
  latestPriceObservedDate: string | null;
}

export interface AlternativeSuggestion {
  id: string;
  currentItemId: string;
  alternativeItemId: string;
  currentPrice: number;
  alternativePrice: number;
  note: string;
}

export interface PlannerState {
  basket: BasketLine[];
  travel: TravelPreferences;
  saraPlanningEnabled: boolean;
  saraCreditBalance: number;
  weeklyBudget: number | null;
}
