import { describe, expect, it } from "vitest";

import type { SelectedLocation, StoreRecommendation } from "./contracts";
import { mapsRouteUrl } from "./travel";

const origin: SelectedLocation = {
  label: "Current location",
  latitude: -37.8136,
  longitude: 144.9631,
  source: "device",
};

const store = {
  name: "Example Market",
  address: "10 Example Street, Melbourne",
} as StoreRecommendation;

describe("mapsRouteUrl", () => {
  it.each([
    ["walk", "walking"],
    ["public_transport", "transit"],
    ["motorcycle", "two-wheeler"],
    ["car", "driving"],
  ] as const)("maps %s mode uses Google's %s travel mode", (mode, expectedMode) => {
    const url = new URL(mapsRouteUrl(origin, store, mode));

    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("-37.8136,144.9631");
    expect(url.searchParams.get("destination")).toBe(
      "Example Market, 10 Example Street, Melbourne",
    );
    expect(url.searchParams.get("travelmode")).toBe(expectedMode);
    expect(url.searchParams.has("destination_place_id")).toBe(false);
  });

  it("includes a place ID when the recommendation has one", () => {
    const storeWithPlaceId = { ...store, googlePlaceId: "ChIJexample" } as StoreRecommendation;

    expect(new URL(mapsRouteUrl(origin, storeWithPlaceId, "car")).searchParams.get(
      "destination_place_id",
    )).toBe("ChIJexample");
  });

  it("falls back to the store name when its address is unavailable", () => {
    const storeWithoutAddress = { ...store, address: null } as StoreRecommendation;

    expect(new URL(mapsRouteUrl(origin, storeWithoutAddress, "car")).searchParams.get(
      "destination",
    )).toBe("Example Market");
  });
});
