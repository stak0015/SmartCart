import { API_BASE_URL } from "./api-base";
import type {
  EarlyPurchaseLineRequest,
  EarlyPurchasePreviewLineRequest,
  EarlyPurchasePreviewResponse,
  EarlyPurchaseSavingsResponse,
  FestivalItemForecastResponse,
  FestivalAlertResponse,
  FestivalDetailResponse,
  FestivalItemsResponse,
  FestivalListResponse,
  FestivalTopItemsResponse,
} from "./festival-contracts";

interface ApiErrorBody {
  error?: { message?: string; code?: string };
}

async function request<T>(
  path: string,
  signal?: AbortSignal,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal });
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

export function getFestivalAlerts(
  state?: string | null,
  on?: string | null,
  signal?: AbortSignal,
): Promise<FestivalAlertResponse> {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (on) params.set("on", on);
  const query = params.toString();
  return request<FestivalAlertResponse>(
    `/festivals/alerts${query ? `?${query}` : ""}`,
    signal,
  );
}

export function getFestivalItems(
  festivalId: string,
  state?: string | null,
  signal?: AbortSignal,
): Promise<FestivalItemsResponse> {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  const query = params.toString();
  return request<FestivalItemsResponse>(
    `/festivals/${encodeURIComponent(festivalId)}/items${query ? `?${query}` : ""}`,
    signal,
  );
}


export function getFestivalTopItems(
  festivalId: string,
  state?: string | null,
  signal?: AbortSignal,
): Promise<FestivalTopItemsResponse> {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  const query = params.toString();
  return request<FestivalTopItemsResponse>(
    `/festivals/${encodeURIComponent(festivalId)}/top-items${query ? `?${query}` : ""}`,
    signal,
  );
}

export function getEarlyPurchaseSavings(
  state: string,
  purchases: EarlyPurchaseLineRequest[],
  signal?: AbortSignal,
): Promise<EarlyPurchaseSavingsResponse> {
  return request<EarlyPurchaseSavingsResponse>("/festivals/early-purchase-savings", signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, purchases }),
  });
}


export function getFestivalItemForecast(
  itemId: number,
  state?: string | null,
  on?: string | null,
  signal?: AbortSignal,
): Promise<FestivalItemForecastResponse> {
  const params = new URLSearchParams({ item_id: String(itemId) });
  if (state) params.set("state", state);
  if (on) params.set("on", on);
  return request<FestivalItemForecastResponse>(
    `/festivals/item-forecast?${params.toString()}`,
    signal,
  );
}

export function getEarlyPurchasePreview(
  state: string,
  lines: EarlyPurchasePreviewLineRequest[],
  on?: string | null,
  signal?: AbortSignal,
): Promise<EarlyPurchasePreviewResponse> {
  return request<EarlyPurchasePreviewResponse>("/festivals/early-purchase-preview", signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, on: on ?? null, lines }),
  });
}
