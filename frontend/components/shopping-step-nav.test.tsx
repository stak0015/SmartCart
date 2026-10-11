import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShoppingStepNav } from "./shopping-step-nav";

describe("shopping step navigation", () => {
  it("marks recommendations current and enables returning to Shop while later steps are disabled", () => {
    const markup = renderToStaticMarkup(<ShoppingStepNav current="compare" locale="en"
      available={["location", "shop", "basket", "compare"]} onNavigate={() => {}}/>);
    expect(markup).toMatch(/<button[^>]*aria-current="step"[^>]*>.*?Recommendations<\/button>/);
    expect(markup).toMatch(/<button type="button"><span[^>]*>2<\/span>Shop<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*?Store details<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*?Checklist<\/button>/);
  });
  it("labels the journey in Malay", () => {
    const markup = renderToStaticMarkup(<ShoppingStepNav current="location" locale="ms"
      available={["location"]} onNavigate={() => {}}/>);
    expect(markup).toContain('aria-label="Langkah membeli-belah"');
    expect(markup).toContain("Beli-belah");
    expect(markup).toContain("Senarai semak");
  });
});
