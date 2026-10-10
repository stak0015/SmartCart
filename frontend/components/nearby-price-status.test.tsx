import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NearbyPriceStatus, type CandidatePreparationState } from "./nearby-price-status";

function render(hasLocation: boolean, preparation: CandidatePreparationState, ready = false) {
  return renderToStaticMarkup(createElement(NearbyPriceStatus, {
    hasLocation, preparation, ready, storeCount: 12, locale: "en", onRetry: () => {},
  }));
}

describe("nearby price feedback", () => {
  it("only asks for a location when none was selected", () => {
    expect(render(false, { status: "idle" })).toContain("Set your location in Travel");
    const selected = render(true, { status: "idle" });
    expect(selected).not.toContain("Set your location in Travel");
    expect(selected).toContain("Retry nearby prices");
  });

  it("shows background loading instead of an unavailable warning", () => {
    const markup = render(true, { status: "loading" });
    expect(markup).toContain("Loading nearby store prices");
    expect(markup).not.toContain("could not be loaded");
    expect(markup).not.toContain("Retry nearby prices");
  });

  it("exposes a preparation failure while retaining the selected location", () => {
    const markup = render(true, { status: "failed", message: "Store locations need to be prepared." });
    expect(markup).toContain("Location selected");
    expect(markup).toContain("Store locations need to be prepared.");
    expect(markup).toContain("Retry nearby prices");
  });

  it("shows prices after the nearby store snapshot loads", () => {
    const markup = render(true, { status: "ready" }, true);
    expect(markup).toContain("Recorded prices across 12 nearby stores");
    expect(markup).not.toContain("Retry nearby prices");
  });
});
