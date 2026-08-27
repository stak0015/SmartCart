import type { TransportMode } from "@/lib/contracts";

export interface AutocompleteSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface PlaceLocation {
  placeId: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface RouteDestination {
  placeId: string;
}

export interface RouteMatrixResult {
  destinationIndex: number;
  distanceMeters: number;
  durationSeconds: number;
}

export interface MapsProvider {
  autocomplete(input: string, sessionToken: string): Promise<AutocompleteSuggestion[]>;
  resolvePlace(placeId: string, sessionToken?: string): Promise<PlaceLocation>;
  computeRouteMatrix(
    origin: { latitude: number; longitude: number },
    destinations: RouteDestination[],
    mode: TransportMode,
  ): Promise<RouteMatrixResult[]>;
}
