import { describe, expect, it } from "vitest";
import { parseShoppingSession, serializeShoppingSession, type ShoppingSession } from "./shopping-session";

const session: ShoppingSession = {
  basket: [{ id: "db-1", name: "Rice", size: "5 kg", qty: 2, saraEligible: null, saraCategoryCandidate: false, category: null }],
  preferences: {
    origin: { label: "Home", latitude: 3.1, longitude: 101.6, source: "search", placeId: "home" },
    transportMode: "car", limitType: "both", limitValue: 5, distanceKm: 10, timeMinutes: 30, saraFilter: "candidate",
  },
  resumeStep: "basket",
  selectedStore: null,
  savedItemsToUse: [],
};

describe("shopping session storage", () => {
  it("restores the basket quantities, origin, travel choices and current step", () => {
    expect(parseShoppingSession(serializeShoppingSession(session))).toEqual(session);
  });

  it("retains replacement history for undo after reloading", () => {
    const changed = structuredClone(session);
    changed.basket[0].replacement = {
      original: { ...session.basket[0], id: "db-2", qty: 1 }, kind: "pack",
      premiseId: "store-1", premiseName: "Shop", sourceUnitPriceRm: 20,
      alternativeUnitPriceRm: 15, sourceObservedDate: null, alternativeObservedDate: "2026-10-01",
    };
    expect(parseShoppingSession(serializeShoppingSession(changed))).toEqual(changed);
  });

  it("keeps the selected store snapshot and saved items being used for this trip", () => {
    const changed = structuredClone(session);
    changed.resumeStep = "compare";
    changed.selectedStore = {
      premiseId: "store-1", premiseCode: "1", name: "Shop", address: null, district: null, state: null,
      straightLineDistanceKm: 1, routeDistanceKm: 2, estimatedTravelMinutes: 5,
      estimatedRoundTripCostRm: 1, basketCostRm: 15, estimatedTotalCostRm: 16,
      pricedItemCount: 1, basketItemCount: 1, isCompleteBasket: true, basketPrices: [],
      saraStatus: "candidate", basketSubtotalRm: 15, missingItems: [], pricedCount: 1,
      basketLineCount: 1, saraCreditRm: 15, cashNeededRm: 0, priceObservedDaysAgo: 1,
      combinedTotalRm: 16, basketLines: [], exceedsLimit: false,
    };
    changed.savedItemsToUse = [{
      id: "manual-1", source: "manual", catalogueItemId: null, itemName: "Bread",
      itemNameEn: null, itemNameMs: null, category: null, sourceCategory: null,
      imageUrl: null, packageSize: null, quantity: 1,
    }];
    expect(parseShoppingSession(serializeShoppingSession(changed))).toEqual(changed);
  });

  it.each([null, "", "{", "null", "[]", '{"version":2}'])("ignores unavailable or corrupt storage: %s", serialized => {
    expect(parseShoppingSession(serialized)).toBeNull();
  });

  it("rejects malformed basket, location, step and store data", () => {
    const serialized = JSON.parse(serializeShoppingSession(session));
    for (const overrides of [
      { basket: [{ ...session.basket[0], qty: -1 }] },
      { basket: [session.basket[0], session.basket[0]] },
      { preferences: { ...session.preferences, origin: { latitude: 999, longitude: 1 } } },
      { resumeStep: "unknown" }, { selectedStore: { premiseId: "1" } },
      { basket: [{ ...session.basket[0], replacement: { original: null } }] },
    ]) {
      expect(parseShoppingSession(JSON.stringify({ ...serialized, ...overrides }))).toBeNull();
    }
  });
});
