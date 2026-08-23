import type {
  CatalogueItem,
  RecommendationRequest,
  RecommendationResponse,
} from "./contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`SmartCart API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function searchItems(query: string, category?: string): Promise<CatalogueItem[]> {
  const params = new URLSearchParams({ query });
  if (category) params.set("category", category);
  return request<CatalogueItem[]>(`/items?${params.toString()}`);
}

export function getRecommendations(payload: RecommendationRequest): Promise<RecommendationResponse> {
  return request<RecommendationResponse>("/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
