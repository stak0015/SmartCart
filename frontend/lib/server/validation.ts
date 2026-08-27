import type {
  RecommendationRequest,
  SaraFilter,
  TransportMode,
  TravelLimitType,
} from "@/lib/contracts";
import { AppError } from "./errors";

const TRANSPORT_MODES = new Set<TransportMode>(["walk", "public_transport", "motorcycle", "car"]);
const LIMIT_TYPES = new Set<TravelLimitType>(["distance", "time"]);
const SARA_FILTERS = new Set<SaraFilter>(["any", "candidate", "verified"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRecommendationRequest(value: unknown): RecommendationRequest {
  if (!isRecord(value) || !isRecord(value.travel)) {
    throw invalidRequest();
  }

  const { travel } = value;
  if (!isRecord(travel.origin) || !isRecord(travel.limit)) {
    throw invalidRequest();
  }
  const { origin, limit } = travel;
  const latitude = origin.latitude;
  const longitude = origin.longitude;
  const label = origin.label;
  const source = origin.source;
  const transportMode = travel.transportMode;
  const limitType = limit.type;
  const limitValue = limit.value;
  const saraFilter = travel.saraFilter;

  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    typeof label !== "string" || label.trim().length < 1 || label.length > 300 ||
    (source !== "device" && source !== "search") ||
    typeof transportMode !== "string" || !TRANSPORT_MODES.has(transportMode as TransportMode) ||
    typeof limitType !== "string" || !LIMIT_TYPES.has(limitType as TravelLimitType) ||
    typeof limitValue !== "number" || !Number.isFinite(limitValue) ||
    typeof saraFilter !== "string" || !SARA_FILTERS.has(saraFilter as SaraFilter)
  ) {
    throw invalidRequest();
  }

  if (
    (limitType === "distance" && (limitValue < 0.5 || limitValue > 100)) ||
    (limitType === "time" && (limitValue < 5 || limitValue > 180))
  ) {
    throw new AppError(
      "INVALID_TRAVEL_LIMIT",
      "Distance must be 0.5-100 km and time must be 5-180 minutes.",
      400,
    );
  }

  return {
    basket: Array.isArray(value.basket) ? value.basket as RecommendationRequest["basket"] : undefined,
    travel: {
      origin: {
        label: label.trim(),
        latitude,
        longitude,
        source,
        placeId: typeof origin.placeId === "string" ? origin.placeId : undefined,
      },
      transportMode: transportMode as TransportMode,
      limit: { type: limitType as TravelLimitType, value: limitValue },
      saraFilter: saraFilter as SaraFilter,
    },
  };
}

function invalidRequest(): AppError {
  return new AppError("INVALID_REQUEST", "The travel preferences are incomplete or invalid.", 400);
}
