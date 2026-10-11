import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogueItemDialog, cataloguePrice } from "./catalogue-item-dialog";

describe("combined catalogue item dialog", () => {
  it("retains alternative navigation, insights, quantity and lazy price trends", () => {
    const markup = renderToStaticMarkup(createElement(CatalogueItemDialog, {
      open: true, title: "Chicken", locale: "en", canAdd: true,
      onClose: () => {}, onAdd: () => {},
      details: (trigger) => createElement("div", { className: "product-visual" }, "Item details", trigger),
      back: createElement("button", null, "Back to original item"),
      alternatives: createElement("section", null, "Healthier alternatives"),
      quantity: createElement("input", { "aria-label": "Quantity", value: "2", readOnly: true }),
      trends: () => { throw new Error("History must stay lazy until the shopper opens trends"); },
    }));
    for (const text of ["Item details", "Back to original item", "Healthier alternatives", "See price trends", "Add to basket"]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls="catalogue-price-trends"');
    expect(markup).toContain('aria-label="See price trends"');
    expect(markup).not.toContain(">See price trends<");
  });

  it("preserves estimated median price labels after the merge", () => {
    expect(cataloguePrice({ price_range: {
      min_rm: 3.2, max_rm: 3.2, store_count: 0, oldest_observed_date: null, price_source: "median",
    } }, "en")).toBe("RM3.20 (estimated)");
  });
});


it("places complete nutrition immediately after alternatives and keeps it closed", () => {
  const markup = renderToStaticMarkup(createElement(CatalogueItemDialog, {
    open: true, title: "Chicken", locale: "en", canAdd: true, onClose: () => {}, onAdd: () => {},
    details: "Details", alternatives: "Alternative cards", quantity: "Quantity", nutrition: createElement("div", null, "All nutrition values"),
  }));
  expect(markup.indexOf("Alternative cards")).toBeLessThan(markup.indexOf("catalogue-nutrition-disclosure"));
  expect(markup.indexOf("catalogue-nutrition-disclosure")).toBeLessThan(markup.indexOf("catalogue-dialog-quantity"));
  expect(markup).toContain('<details class="catalogue-nutrition-disclosure">');
  expect(markup).toContain("All nutrition values");
  expect(markup).not.toContain("<details open");
});
