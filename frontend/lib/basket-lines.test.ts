import { describe, expect, it } from "vitest";

import { toBasketLineRequests } from "./basket-lines";

describe("toBasketLineRequests", () => {
  it("keeps real catalogue items and strips the db- prefix", () => {
    expect(
      toBasketLineRequests([
        { id: "db-12", qty: 2 },
        { id: "db-7", qty: 1 },
      ]),
    ).toEqual([
      { itemId: "12", quantity: 2 },
      { itemId: "7", quantity: 1 },
    ]);
  });

  it("filters out demo/mock rows so they cannot pollute basket totals", () => {
    expect(
      toBasketLineRequests([
        { id: "1", qty: 1 },
        { id: "2", qty: 3 },
        { id: "db-12", qty: 1 },
      ]),
    ).toEqual([{ itemId: "12", quantity: 1 }]);
  });

  it("returns an empty list when the basket has no real items", () => {
    expect(toBasketLineRequests([{ id: "1", qty: 1 }])).toEqual([]);
    expect(toBasketLineRequests([])).toEqual([]);
  });
});
