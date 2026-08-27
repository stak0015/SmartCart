import type {
  ApiErrorBody,
  LocationSearchResponse,
  RecommendationRequest,
  RecommendationResponse,
  ResolvedLocation,
} from "./contracts";
import { API_BASE_URL } from "./api-base";

export class SmartCartApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SmartCartApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null;
    throw new SmartCartApiError(
      body?.error.message ?? "SmartCart could not complete that request.",
      body?.error.code ?? "REQUEST_FAILED",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function getRecommendations(
  payload: RecommendationRequest,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  return request<RecommendationResponse>("/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function searchLocations(
  query: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<LocationSearchResponse> {
  const params = new URLSearchParams({ query, sessionToken });
  return request<LocationSearchResponse>(`/locations/autocomplete?${params.toString()}`, { signal });
}

export function resolveLocation(
  placeId: string,
  sessionToken: string,
): Promise<ResolvedLocation> {
  return request<ResolvedLocation>("/locations/resolve", {
    method: "POST",
    body: JSON.stringify({ placeId, sessionToken }),
  });
}
