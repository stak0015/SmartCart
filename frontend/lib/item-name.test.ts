import { describe, expect, it } from "vitest";

import { uppercaseItemName } from "./item-name";

describe("uppercaseItemName", () => {
  it("renders mixed-case item names in capital letters", () => {
    expect(uppercaseItemName("Minyak masak 1 litre")).toBe("MINYAK MASAK 1 LITRE");
  });

  it("preserves numbers and punctuation", () => {
    expect(uppercaseItemName("Susu 2-in-1 (500g)")).toBe("SUSU 2-IN-1 (500G)");
  });
});
