import { describe, expect, it } from "vitest";

import type { Item } from "./api";
import { DEFAULT_QTY, basketDetails, resultRowFields, stepQty } from "./result-row";

const baseItem: Item = {
  item_id: 1,
  item_code: "1",
  item_name: "BERAS CAP JATI (SST5%)",
  unit: "10 kg",
  item_group: "BARANGAN ASAS",
  item_category: "BERAS",
  brand: "JATI",
  package_size: "10 kg",
  price: 32.5,
  prices: [],
};

describe("resultRowFields", () => {
  it("shows name, brand and merged package size in AC order", () => {
    expect(resultRowFields(baseItem)).toEqual({
      name: "BERAS CAP JATI (SST5%)",
      brand: "JATI",
      packageSize: "10 kg",
    });
  });

  it("falls back to — only for values the backend could not fill", () => {
    const fields = resultRowFields({
      ...baseItem,
      item_name: "MYSTERY ITEM",
      brand: null,
      package_size: null,
    });
    expect(fields.brand).toBe("—");
    expect(fields.packageSize).toBe("—");
  });
});

describe("result-row quantity stepper", () => {
  it("defaults to 1", () => {
    expect(DEFAULT_QTY).toBe(1);
  });

  it("steps up and down but never below 1", () => {
    expect(stepQty(DEFAULT_QTY, 1)).toBe(2);
    expect(stepQty(DEFAULT_QTY, -1)).toBe(1);
    expect(stepQty(3, -1)).toBe(2);
  });
});

describe("basketDetails", () => {
  it("keeps basket rows identical to the result row", () => {
    const fields = resultRowFields(baseItem);
    expect(basketDetails(baseItem)).toEqual({
      name: fields.name,
      brand: fields.brand,
      size: fields.packageSize,
    });
  });

  it("uses the same — fallbacks as the result row", () => {
    const item: Item = { ...baseItem, brand: null, package_size: null };
    const details = basketDetails(item);
    expect(details.brand).toBe("—");
    expect(details.size).toBe("—");
  });
});
