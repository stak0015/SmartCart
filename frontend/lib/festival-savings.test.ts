import { describe, expect, it } from "vitest";

import type { EarlyPurchaseSavingsResponse } from "./festival-contracts";
import { buildEarlyPurchaseRequests, buildStorePreviewLines, groupEarlySavingsByRecord } from "./festival-savings";
import type { BasketItemPrice } from "./contracts";
import type { TripRecord } from "./trip-history";

const record = {
  id: "trip-1",
  recordedAt: "2026-01-15T08:00:00.000Z",
  lines: [
    { id: "bought", status: "bought", catalogueItemId: "101", itemName: "Item A", quantity: 2, actualQuantity: null, unitPriceRm: 10, actualPriceRm: null },
    { id: "manual", status: "bought", catalogueItemId: null, itemName: "Manual", quantity: 1, actualQuantity: null, unitPriceRm: 4, actualPriceRm: null },
    { id: "unpriced", status: "bought", catalogueItemId: "102", itemName: "Item B", quantity: 1, actualQuantity: null, unitPriceRm: null, actualPriceRm: null },
    { id: "not-bought", status: "not_bought", catalogueItemId: "103", itemName: "Item C", quantity: 1, actualQuantity: null, unitPriceRm: 3, actualPriceRm: null },
  ],
} as TripRecord;

describe("festival early-purchase savings", () => {
  it("builds requests only from bought, priced catalogue lines", () => {
    expect(buildEarlyPurchaseRequests([record])).toEqual([
      expect.objectContaining({ record_id: "trip-1", item_id: "101", quantity: 2, unit_price_rm: 10, purchased_on: "2026-01-15" }),
    ]);
  });

  it("keeps the recorded saving as a separate per-record value", () => {
    const response = {
      items: [
        { record_id: "trip-1", saving_rm: 4 },
        { record_id: "trip-1", saving_rm: 1.5 },
        { record_id: "trip-2", saving_rm: 3 },
      ],
    } as EarlyPurchaseSavingsResponse;
    expect(groupEarlySavingsByRecord(response).get("trip-1")).toBe(5.5);
    expect(groupEarlySavingsByRecord(response).get("trip-2")).toBe(3);
  });
});


describe("festival checkout preview", () => {
  it("uses only actual store prices, not median estimates", () => {
    const prices = [
      { itemId: "2", priceSource: "store", unitPriceRm: 8.99, quantity: 1 },
      { itemId: "3", priceSource: "median", unitPriceRm: 5.0, quantity: 2 },
      { itemId: "4", priceSource: "store", unitPriceRm: null, quantity: 1 },
    ] as BasketItemPrice[];
    expect(buildStorePreviewLines(prices)).toEqual([
      { item_id: "2", quantity: 1, actual_unit_price_rm: 8.99 },
    ]);
  });
});
