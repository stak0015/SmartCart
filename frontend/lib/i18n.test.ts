import { describe, expect, it } from "vitest";

import { COPY, categoryLabel } from "./i18n";

describe("categoryLabel", () => {
  it("shows English category translations in English mode", () => {
    expect(categoryLabel("en", "BERAS")).toBe("Rice");
    expect(categoryLabel("en", "ALAT TULIS DAN BAHAN BACAAN")).toBe(
      "Stationery & Reading Materials",
    );
  });

  it("keeps the source Malay category in Malay mode", () => {
    expect(categoryLabel("ms", "SAYUR-SAYURAN")).toBe("SAYUR-SAYURAN");
  });

  it("falls back safely for missing or newly introduced categories", () => {
    expect(categoryLabel("en", null)).toBe("—");
    expect(categoryLabel("en", "KATEGORI BAHARU")).toBe("KATEGORI BAHARU");
  });
});

describe("pagination and SARA candidate copy", () => {
  it("keeps category candidates distinct from verified eligibility", () => {
    expect(COPY.en.saraCategoryCandidate).toContain("Potential");
    expect(COPY.en.saraCategoryCandidate).toContain("verify");
    expect(COPY.ms.saraCategoryCandidate).toContain("berpotensi");
    expect(COPY.ms.saraCategoryCandidate).toContain("sahkan");
  });

  it("localizes page position labels", () => {
    expect(COPY.en.pageOf(2, 31)).toBe("Page 2 of 31");
    expect(COPY.ms.pageOf(2, 31)).toBe("Halaman 2 daripada 31");
  });
});
