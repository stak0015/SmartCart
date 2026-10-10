import type { PricedPlan, SelectedLocation, StoreRecommendation, TransportMode } from "./contracts";

const GOOGLE_MAPS_DIRECTIONS_URL = "https://www.google.com/maps/dir/";

const travelModeByTransportMode: Record<TransportMode, string> = {
  walk: "walking",
  public_transport: "transit",
  motorcycle: "two-wheeler",
  car: "driving",
};

/** Open the complete return journey, preserving the plan's store visit order. */
export function mapsPlanRouteUrl(
  origin: Pick<SelectedLocation, "latitude" | "longitude"> | null | undefined,
  plan: Pick<PricedPlan, "storePremiseIds" | "storeNames">,
  stores: Array<Pick<StoreRecommendation, "premiseId" | "name" | "address" | "googlePlaceId">>,
  mode: TransportMode,
): string {
  const stops = plan.storePremiseIds.map((id, index) => {
    const store = stores.find(store => store.premiseId === id);
    return {
      address: store?.address ? `${store.name}, ${store.address}` : plan.storeNames[index],
      placeId: store?.googlePlaceId,
    };
  });
  const home = origin ? `${origin.latitude},${origin.longitude}` : null;
  // Older saved checklists may lack an origin. Keep their map link useful by
  // routing between the first and last stores in that case.
  const waypoints = home ? stops : stops.slice(1, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: home ?? stops[0]?.address ?? plan.storeNames[0] ?? "",
    destination: home ?? stops[stops.length - 1]?.address ?? plan.storeNames[plan.storeNames.length - 1] ?? "",
    travelmode: travelModeByTransportMode[mode],
  });
  if (waypoints.length > 0 || home) {
    params.set("waypoints", waypoints.map(stop => stop.address).join("|"));
  }
  if (waypoints.length > 0 && waypoints.every(stop => stop.placeId)) {
    params.set("waypoint_place_ids", waypoints.map(stop => stop.placeId).join("|"));
  }
  return `${GOOGLE_MAPS_DIRECTIONS_URL}?${params.toString()}`;
}

export function mapsRouteUrl(
  origin: SelectedLocation,
  store: StoreRecommendation,
  mode: TransportMode,
): string {
  const destination = store.address ? `${store.name}, ${store.address}` : store.name;
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.latitude},${origin.longitude}`,
    destination,
    travelmode: travelModeByTransportMode[mode],
  });

  if (store.googlePlaceId) {
    params.set("destination_place_id", store.googlePlaceId);
  }

  return `${GOOGLE_MAPS_DIRECTIONS_URL}?${params.toString()}`;
}
