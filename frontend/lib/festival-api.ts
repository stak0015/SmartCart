import { API_BASE_URL } from "./api-base";
import type { FestivalDetailResponse, FestivalListResponse } from "./festival-contracts";

interface ApiErrorBody {
  error?: { message?: string; code?: string };
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null;
    throw new Error(
      body?.error?.message ?? `Festival data request failed: HTTP ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
}

export function listFestivals(signal?: AbortSignal): Promise<FestivalListResponse> {
  return request<FestivalListResponse>("/festivals", signal);
}

export function getFestivalDetail(
  festivalId: string,
  state?: string | null,
  signal?: AbortSignal,
): Promise<FestivalDetailResponse> {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  const query = params.toString();
  return request<FestivalDetailResponse>(
    `/festivals/${encodeURIComponent(festivalId)}${query ? `?${query}` : ""}`,
    signal,
  );
}
