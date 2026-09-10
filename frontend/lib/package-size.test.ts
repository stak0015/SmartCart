import { describe, expect, it } from "vitest";

import { localizedPackageSize } from "./package-size";

describe("localizedPackageSize", () => {
  it("translates Malay serving labels in English mode", () => {
    expect(localizedPackageSize("sepinggan", "en")).toBe("1 plate");
    expect(localizedPackageSize("semangkuk", "en")).toBe("1 bowl");
    expect(localizedPackageSize("gelas besar", "en")).toBe("Large glass");
    expect(localizedPackageSize("sebungkus", "en")).toBe("1 packet");
  });

  it("translates numbered Malay classifiers with singular and plural labels", () => {
    expect(localizedPackageSize("1 biji", "en")).toBe("1 piece");
    expect(localizedPackageSize("30 biji", "en")).toBe("30 pieces");
    expect(localizedPackageSize("1 batang", "en")).toBe("1 piece");
    expect(localizedPackageSize("100 beg", "en")).toBe("100 bags");
    expect(localizedPackageSize("1 ekor", "en")).toBe("1 whole item");
  });

  it("uses English litre spelling without changing metric quantities", () => {
    expect(localizedPackageSize("1.5 liter", "en")).toBe("1.5 litre");
    expect(localizedPackageSize("250 ml", "en")).toBe("250 ml");
  });

  it("preserves the source label in Malay mode", () => {
    expect(localizedPackageSize("sepinggan", "ms")).toBe("sepinggan");
    expect(localizedPackageSize("30 biji", "ms")).toBe("30 biji");
  });

  it("preserves missing package sizes", () => {
    expect(localizedPackageSize(null, "en")).toBeNull();
  });
});
