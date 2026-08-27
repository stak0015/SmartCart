import "server-only";

import type { TransportMode } from "@/lib/contracts";
import { AppError } from "../errors";
import type {
  AutocompleteSuggestion,
  MapsProvider,
  PlaceLocation,
  RouteDestination,
  RouteMatrixResult,
} from "./types";

const PLACES_BASE_URL = "https://places.googleapis.com/v1";
const ROUTES_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

const TRAVEL_MODE: Record<TransportMode, string> = {
  walk: "WALK",
  public_transport: "TRANSIT",
  motorcycle: "TWO_WHEELER",
  car: "DRIVE",
};

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "MAPS_NOT_CONFIGURED",
      "Location and route services have not been configured yet.",
      503,
    );
  }
  return apiKey;
}

async function googleRequest<T>(
  url: string,
  fieldMask: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = getApiKey();
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
        ...init?.headers,
      },
    });
  } catch (error) {
    console.error("Google Maps request failed", error);
    throw new AppError(
      "MAPS_UNAVAILABLE",
      "The location service is temporarily unavailable. Please try again.",
      502,
    );
  }

  if (!response.ok) {
    const diagnostic = await response.text();
    console.error(`Google Maps returned ${response.status}: ${diagnostic.slice(0, 500)}`);
    throw new AppError(
      "MAPS_UNAVAILABLE",
      "The location service is temporarily unavailable. Please try again.",
      502,
    );
  }

  return response.json() as Promise<T>;
}

interface GoogleAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

interface GooglePlaceResponse {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

interface GoogleRouteMatrixElement {
  destinationIndex?: number;
  status?: { code?: number };
  condition?: string;
  distanceMeters?: number;
  duration?: string;
}

function parseDurationSeconds(duration: string | undefined): number | null {
  if (!duration?.endsWith("s")) return null;
  const value = Number(duration.slice(0, -1));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export class GoogleMapsProvider implements MapsProvider {
  async autocomplete(input: string, sessionToken: string): Promise<AutocompleteSuggestion[]> {
    const response = await googleRequest<GoogleAutocompleteResponse>(
      `${PLACES_BASE_URL}/places:autocomplete`,
      [
        "suggestions.placePrediction.placeId",
        "suggestions.placePrediction.text.text",
        "suggestions.placePrediction.structuredFormat.mainText.text",
        "suggestions.placePrediction.structuredFormat.secondaryText.text",
      ].join(","),
      {
        method: "POST",
        body: JSON.stringify({
          input,
          sessionToken,
          includedRegionCodes: ["my"],
          regionCode: "my",
          languageCode: "en",
          includeQueryPredictions: false,
        }),
      },
    );

    return (response.suggestions ?? []).flatMap(({ placePrediction }) => {
      if (!placePrediction?.placeId) return [];
      const fullText = placePrediction.text?.text?.trim() ?? "";
      const mainText = placePrediction.structuredFormat?.mainText?.text?.trim() || fullText;
      const secondaryText = placePrediction.structuredFormat?.secondaryText?.text?.trim() ?? "";
      if (!fullText && !mainText) return [];
      return [{ placeId: placePrediction.placeId, mainText, secondaryText, fullText: fullText || mainText }];
    });
  }

  async resolvePlace(placeId: string, sessionToken?: string): Promise<PlaceLocation> {
    const tokenQuery = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
    const response = await googleRequest<GooglePlaceResponse>(
      `${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}${tokenQuery}`,
      "id,formattedAddress,location",
    );

    const latitude = response.location?.latitude;
    const longitude = response.location?.longitude;
    if (
      !response.id ||
      !response.formattedAddress ||
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      throw new AppError(
        "LOCATION_NOT_RESOLVED",
        "That location could not be resolved. Please choose another suggestion.",
        422,
      );
    }

    return { placeId: response.id, label: response.formattedAddress, latitude, longitude };
  }

  async computeRouteMatrix(
    origin: { latitude: number; longitude: number },
    destinations: RouteDestination[],
    mode: TransportMode,
  ): Promise<RouteMatrixResult[]> {
    if (destinations.length === 0) return [];
    if (destinations.length > 49) {
      throw new AppError("TOO_MANY_ROUTE_CANDIDATES", "Too many route candidates were requested.", 500);
    }

    const response = await googleRequest<GoogleRouteMatrixElement[]>(
      ROUTES_MATRIX_URL,
      "originIndex,destinationIndex,status,condition,distanceMeters,duration",
      {
        method: "POST",
        body: JSON.stringify({
          origins: [{ waypoint: { location: { latLng: origin } } }],
          destinations: destinations.map(destination => ({
            waypoint: { placeId: destination.placeId },
          })),
          travelMode: TRAVEL_MODE[mode],
          languageCode: "en",
          regionCode: "my",
          units: "METRIC",
        }),
      },
    );

    return response.flatMap(element => {
      const durationSeconds = parseDurationSeconds(element.duration);
      if (
        element.condition !== "ROUTE_EXISTS" ||
        (element.status?.code ?? 0) !== 0 ||
        typeof element.destinationIndex !== "number" ||
        typeof element.distanceMeters !== "number" ||
        durationSeconds === null
      ) {
        return [];
      }
      return [{
        destinationIndex: element.destinationIndex,
        distanceMeters: element.distanceMeters,
        durationSeconds,
      }];
    });
  }
}

let provider: MapsProvider | undefined;

export function getMapsProvider(): MapsProvider {
  provider ??= new GoogleMapsProvider();
  return provider;
}
