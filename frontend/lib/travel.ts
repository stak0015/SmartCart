import type { SelectedLocation, StoreRecommendation, TransportMode } from "./contracts";

const GOOGLE_MAPS_DIRECTIONS_URL = "https://www.google.com/maps/dir/";

const travelModeByTransportMode: Record<TransportMode, string> = {
  walk: "walking",
  public_transport: "transit",
  motorcycle: "two-wheeler",
  car: "driving",
};

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
