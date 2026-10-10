import type { BasketItem } from "@/lib/basket-state";
import type { PricedPlan, StoreRecommendation } from "@/lib/contracts";

export const basket: BasketItem[] = [
  { id: "db-1", name: "Rice", size: "5 kg", qty: 2, imageUrl: "/rice-product.png", saraEligible: true, saraCategoryCandidate: true, category: null },
  { id: "db-2", name: "Milk", size: "1 L", qty: 1, imageUrl: "/pricecatcher-v1/2.webp", saraEligible: true, saraCategoryCandidate: true, category: null },
];
export const stores: StoreRecommendation[] = ["Lotus's Kota Bharu", "MYDIN Tunjong"].map((name, index) => ({
  premiseId: String(index + 1), premiseCode: `P${index + 1}`, name,
  address: index === 0 ? "Jalan Sultan Yahya Petra" : "Bandar Baru Tunjong", district: "Kota Bharu", state: "Kelantan",
  straightLineDistanceKm: 2, routeDistanceKm: 3, estimatedTravelMinutes: 8, estimatedRoundTripCostRm: 2,
  basketCostRm: 65, estimatedTotalCostRm: 67, pricedItemCount: 2, basketItemCount: 2, isCompleteBasket: true,
  basketPrices: [], saraStatus: "verified", basketSubtotalRm: 65, missingItems: [], pricedCount: 2,
  basketLineCount: 2, saraCreditRm: 65, cashNeededRm: 0, priceObservedDaysAgo: 2, combinedTotalRm: 67,
  basketLines: [], exceedsLimit: false,
}));
export const plan: PricedPlan = {
  planId: "two:1:2", storeCount: 2, storePremiseIds: ["1", "2"], storeNames: stores.map(store => store.name),
  basketSubtotalRm: 65, transportCostRm: 3, combinedTotalRm: 68, isComplete: true,
  pricedLineCount: 2, basketLineCount: 2, missingItems: [], totalTravelMinutes: 24, totalRouteDistanceKm: 9,
  assignments: [
    { itemId: "1", itemName: "Rice", quantity: 2, unit: "5 kg", unitPriceRm: 30, lineTotalRm: 60, priceSource: "store", storePremiseId: "1", storeName: stores[0].name, observedDate: "2026-10-08", saraEligible: true },
    { itemId: "2", itemName: "Milk", quantity: 1, unit: "1 L", unitPriceRm: 5, lineTotalRm: 5, priceSource: "median", storePremiseId: "2", storeName: stores[1].name, observedDate: null, saraEligible: true },
  ],
  interStoreDistanceKm: 3, interStoreTravelMinutes: 8, reverseOrderCostRm: 4, savingVsSingleRm: null,
  legs: [
    { role: "origin_to_first", fromName: "Home", toName: stores[0].name, distanceKm: 3, travelMinutes: 8, costRm: 1 },
    { role: "first_to_second", fromName: stores[0].name, toName: stores[1].name, distanceKm: 3, travelMinutes: 8, costRm: 1 },
    { role: "second_to_origin", fromName: stores[1].name, toName: "Home", distanceKm: 3, travelMinutes: 8, costRm: 1 },
  ],
};

for (const store of stores) {
  store.basketPrices = plan.assignments.map(line => ({
    itemId: line.itemId, itemName: line.itemName!, packageSize: line.unit,
    quantity: line.quantity, unitPriceRm: line.unitPriceRm, lineTotalRm: line.lineTotalRm,
    priceSource: line.priceSource, priceObservedDate: line.observedDate, category: null,
  }));
  store.storePriceCount = 1;
  store.medianPriceCount = 1;
}
