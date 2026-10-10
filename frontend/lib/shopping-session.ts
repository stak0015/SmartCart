import type { BasketItem, BasketItemBase } from "./basket-state";
import { isItemCategory, isSourceCategory, type SelectedLocation, type StoreRecommendation, type TransportMode, type TravelLimitType, type SaraFilter } from "./contracts";
import { parseNextTrip, serializeNextTrip, type NextTripItem } from "./next-trip";

export const SHOPPING_SESSION_STORAGE_KEY = "smartcart.shopping-session.v1";
export type ShoppingSessionStep = "location" | "shop" | "basket" | "compare";
export interface TravelPreferences {
  origin: SelectedLocation | null;
  transportMode: TransportMode;
  limitType: TravelLimitType;
  limitValue: number;
  distanceKm: number;
  timeMinutes: number;
  saraFilter: SaraFilter;
}
export interface ShoppingSession {
  basket: BasketItem[];
  preferences: TravelPreferences;
  resumeStep: ShoppingSessionStep;
  selectedStore: StoreRecommendation | null;
  savedItemsToUse: NextTripItem[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function optionalText(value: unknown): boolean {
  return value == null || typeof value === "string";
}
function basketItem(value: unknown): value is BasketItemBase {
  return record(value) && typeof value.id === "string" && !!value.id.trim()
    && typeof value.name === "string" && typeof value.size === "string"
    && finite(value.qty) && Number.isInteger(value.qty) && value.qty >= 1 && value.qty <= 99
    && (value.saraEligible === null || typeof value.saraEligible === "boolean")
    && typeof value.saraCategoryCandidate === "boolean"
    && (value.category === null || isItemCategory(value.category))
    && (value.sourceCategory == null || isSourceCategory(value.sourceCategory))
    && [value.itemNameEn, value.itemNameMs, value.imageUrl].every(optionalText);
}
function validBasketItem(value: unknown): value is BasketItem {
  if (!basketItem(value)) return false;
  const replacement = (value as BasketItem).replacement;
  if (replacement === undefined) return true;
  return record(replacement) && basketItem(replacement.original)
    && ["pack", "lower_cost"].includes(replacement.kind)
    && typeof replacement.premiseId === "string" && typeof replacement.premiseName === "string"
    && (replacement.sourceUnitPriceRm === null || finite(replacement.sourceUnitPriceRm))
    && finite(replacement.alternativeUnitPriceRm)
    && optionalText(replacement.sourceObservedDate) && optionalText(replacement.alternativeObservedDate);
}
function validPreferences(value: unknown): value is TravelPreferences {
  if (!record(value)) return false;
  const origin = value.origin;
  return (origin === null || (record(origin) && typeof origin.label === "string"
    && finite(origin.latitude) && Math.abs(origin.latitude) <= 90
    && finite(origin.longitude) && Math.abs(origin.longitude) <= 180
    && ["device", "search"].includes(String(origin.source)) && optionalText(origin.placeId)))
    && ["walk", "public_transport", "motorcycle", "car"].includes(String(value.transportMode))
    && ["distance", "time", "both"].includes(String(value.limitType))
    && finite(value.limitValue) && value.limitValue > 0
    && finite(value.distanceKm) && value.distanceKm >= 0.5 && value.distanceKm <= 100
    && finite(value.timeMinutes) && value.timeMinutes >= 5 && value.timeMinutes <= 180
    && ["any", "candidate", "verified"].includes(String(value.saraFilter));
}
function validStore(value: unknown): value is StoreRecommendation {
  if (!record(value)) return false;
  return ["premiseId", "premiseCode", "name"].every(key => typeof value[key] === "string")
    && ["verified", "candidate", "unverified"].includes(String(value.saraStatus))
    && ["address", "district", "state"].every(key => optionalText(value[key]))
    && ["straightLineDistanceKm", "routeDistanceKm", "estimatedTravelMinutes", "estimatedRoundTripCostRm", "basketCostRm", "pricedItemCount", "basketItemCount"].every(key => finite(value[key]))
    && ["estimatedTotalCostRm", "basketSubtotalRm", "pricedCount", "basketLineCount", "saraCreditRm", "cashNeededRm", "priceObservedDaysAgo", "combinedTotalRm"].every(key => value[key] === null || finite(value[key]))
    && typeof value.isCompleteBasket === "boolean" && typeof value.exceedsLimit === "boolean"
    && Array.isArray(value.missingItems) && value.missingItems.every(item => typeof item === "string")
    && Array.isArray(value.basketPrices) && value.basketPrices.every(record)
    && Array.isArray(value.basketLines) && value.basketLines.every(record);
}

export function serializeShoppingSession(session: ShoppingSession): string {
  return JSON.stringify({ ...session, version: 1, savedItemsToUse: serializeNextTrip(session.savedItemsToUse) });
}

export function parseShoppingSession(serialized: string | null): ShoppingSession | null {
  try {
    const value: unknown = JSON.parse(serialized ?? "null");
    if (!record(value) || value.version !== 1 || !validPreferences(value.preferences)
      || !Array.isArray(value.basket) || !value.basket.every(validBasketItem)
      || new Set(value.basket.map(item => item.id)).size !== value.basket.length
      || !["location", "shop", "basket", "compare"].includes(String(value.resumeStep))
      || !(value.selectedStore === null || validStore(value.selectedStore))) return null;
    return {
      basket: value.basket,
      preferences: value.preferences,
      resumeStep: value.resumeStep as ShoppingSessionStep,
      selectedStore: value.selectedStore,
      savedItemsToUse: parseNextTrip(typeof value.savedItemsToUse === "string" ? value.savedItemsToUse : null),
    };
  } catch {
    return null;
  }
}
