import { describe, expect, it } from "vitest";
import { plan, stores } from "../tests/fixtures/store-plan";
import { rankedStorePlanOptions } from "./multi-store";
const comparison = { completePlans: [plan], incompletePlans: [], singleStoreBaselineRm: 67, singleStoreBaselineName: stores[0].name, priceBasisNote: "" };

describe("unified store options", () => {
  it("mixes single and two-store options in the same price ranking without duplicates", () => {
    const cheaperPlan = { ...plan, combinedTotalRm: 60 };
    const options = rankedStorePlanOptions(stores, { ...comparison, completePlans: [cheaperPlan, cheaperPlan] });
    expect(options.map(option => option.kind)).toEqual(["plan", "store", "store"]);
    expect(options).toHaveLength(3);
  });
  it("excludes a second stop with no assigned purchases, including old saved responses", () => {
    const redundant = { ...plan, assignments: plan.assignments.map(line => ({ ...line, storePremiseId: "1" })) };
    expect(rankedStorePlanOptions(stores, { ...comparison, completePlans: [redundant] }).every(option => option.kind === "store")).toBe(true);
  });
  it("sorts single stores by cost even without multi-store planning", () => {
    const options = rankedStorePlanOptions([{...stores[0], combinedTotalRm: 80}, {...stores[1], combinedTotalRm: 50}]);
    expect(options.map(option => option.kind === "store" && option.store.premiseId)).toEqual(["2", "1"]);
  });
  it("puts cheaper estimated options ahead of observed prices and unknown totals last", () => {
    const options = rankedStorePlanOptions([
      {...stores[0], combinedTotalRm: 80, storePriceCount: 2, medianPriceCount: 0},
      {...stores[1], combinedTotalRm: null},
    ], {...comparison, completePlans: [{...plan, combinedTotalRm: 50, pricedLineCount: 1}]});
    expect(options.map(option => option.kind === "plan" ? option.plan.planId : option.store.premiseId)).toEqual([plan.planId, "1", "2"]);
  });
});
