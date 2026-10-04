import { describe, expect, it } from "vitest";

import { inferStateFromLabel, isMalaysiaState } from "./festival-alert-state";

describe("festival alert state", () => {
  it("infers state names and aliases", () => {
    expect(inferStateFromLabel("Kota Bharu, Kelantan, Malaysia")).toBe("Kelantan");
    expect(inferStateFromLabel("George Town, Penang")).toBe("Pulau Pinang");
    expect(inferStateFromLabel("Kuala Lumpur, Malaysia")).toBe("W.P. Kuala Lumpur");
  });

  it("validates bounded state values", () => {
    expect(isMalaysiaState("Selangor")).toBe(true);
    expect(isMalaysiaState("Singapore")).toBe(false);
  });
});
