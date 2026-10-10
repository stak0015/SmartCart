import { describe, expect, it } from "vitest";

import type { SelectedLocation, StoreRecommendation } from "./contracts";
import { mapsPlanRouteUrl, mapsRouteUrl } from "./travel";

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

describe("mapsPlanRouteUrl", () => {
  const plan = {storePremiseIds: ["2", "1"], storeNames: ["Second", "First"]};
  const stores = [
    {...store, premiseId: "1", name: "First", googlePlaceId: "place-1"},
    {...store, premiseId: "2", name: "Second", googlePlaceId: "place-2"},
  ];
  it("preserves visit order and returns home using both waypoint place IDs", () => {
    const params = new URL(mapsPlanRouteUrl(origin, plan, stores, "motorcycle")).searchParams;
    expect(params.get("origin")).toBe(params.get("destination"));
    expect(params.get("waypoints")).toBe("Second, 10 Example Street, Melbourne|First, 10 Example Street, Melbourne");
    expect(params.get("waypoint_place_ids")).toBe("place-2|place-1");
    expect(params.get("travelmode")).toBe("two-wheeler");
  });
  it("uses store names when metadata is unavailable without partial place IDs", () => {
    const params = new URL(mapsPlanRouteUrl(origin, plan, stores.slice(0, 1), "car")).searchParams;
    expect(params.get("waypoints")).toBe("Second|First, 10 Example Street, Melbourne");
    expect(params.has("waypoint_place_ids")).toBe(false);
  });
});

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
