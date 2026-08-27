import { describe, expect, it } from "vitest";

import type { Item } from "./api";
import { DEFAULT_QTY, resultRowFields, stepQty } from "./result-row";

const baseItem: Item = {
  item_id: 1,
  item_code: "1",
  item_name: "BERAS CAP JATI (SST5%)",
  unit: "10 kg",
  item_group: "BARANGAN ASAS",
  item_category: "BERAS",
  brand: "JATI",
  package_size: null,
  price: 32.5,
  prices: [],
};

describe("resultRowFields", () => {
  it("shows parsed brand, package size and unit in AC order", () => {
    expect(resultRowFields(baseItem)).toEqual({
      name: "BERAS CAP JATI (SST5%)",
      brand: "JATI",
      packageSize: "—",
      unit: "10 kg",
    });
  });

  it("falls back to — for unparsed brand/size and missing unit", () => {
    const fields = resultRowFields({
      ...baseItem,
      item_name: "AYAM BERSIH - STANDARD",
      unit: null,
      brand: null,
      package_size: null,
    });
    expect(fields.brand).toBe("—");
    expect(fields.packageSize).toBe("—");
    expect(fields.unit).toBe("—");
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
