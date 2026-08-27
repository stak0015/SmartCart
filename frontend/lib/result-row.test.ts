import { describe, expect, it } from "vitest";

import type { Item } from "./api";
import { DEFAULT_QTY, MAX_QTY, QTY_ERROR, basketDetails, parseQty, resultRowFields, stepQty } from "./result-row";

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
    expect(MAX_QTY).toBe(99);
  });

  it("steps up and down but never outside 1..99", () => {
    expect(stepQty(DEFAULT_QTY, 1)).toBe(2);
    expect(stepQty(DEFAULT_QTY, -1)).toBe(1);
    expect(stepQty(3, -1)).toBe(2);
    expect(stepQty(MAX_QTY, 1)).toBe(99);
    expect(stepQty(98, 1)).toBe(99);
    expect(stepQty(1, -5)).toBe(1);
    expect(stepQty(99, 5)).toBe(99);
  });
});

describe("parseQty (AC-1.4.1 typed input)", () => {
  it("accepts whole numbers from 1 to 99", () => {
    expect(parseQty("1")).toBe(1);
    expect(parseQty("9")).toBe(9);
    expect(parseQty("10")).toBe(10);
    expect(parseQty("99")).toBe(99);
  });

  it("rejects 0 and values above 99", () => {
    expect(parseQty("0")).toBeNull();
    expect(parseQty("00")).toBeNull();
    expect(parseQty("100")).toBeNull();
    expect(parseQty("150")).toBeNull();
  });

  it("rejects decimals, letters and empty input", () => {
    expect(parseQty("1.5")).toBeNull();
    expect(parseQty("abc")).toBeNull();
    expect(parseQty("2kg")).toBeNull();
    expect(parseQty("")).toBeNull();
    expect(parseQty(" ")).toBeNull();
    expect(parseQty("-1")).toBeNull();
  });
});

describe("QTY_ERROR wording (AC-1.4.1)", () => {
  it("matches the AC text verbatim", () => {
    expect(QTY_ERROR).toBe("Quantity must be a whole number between 1 and 99. Need to fill up.");
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
