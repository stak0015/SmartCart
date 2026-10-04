import type { ItemCategory, SourceCategory } from "./contracts";

export interface FestivalDatasetInfo {
  dataset_id: string;
  dataset_version: string;
  effective_date: string | null;
  method_versions: Record<string, string>;
  source_label: string;
  source_url: string;
}

export interface FestivalSummary {
  festival_id: string;
  name_en: string;
  name_zh: string;
  name_ms: string;
  scope: "national" | "state";
  significant: boolean;
  state_count: number;
  significant_state_count: number;
  states: string[];
  significant_states: string[];
  window_status_counts: Record<string, number>;
  sample_item_count: number;
  observation_days_min: number;
  observation_days_max: number;
  date_start: string;
  date_end: string;
  method_version: string;
  window_method_version: string;
}

export interface FestivalListResponse {
  count: number;
  dataset: FestivalDatasetInfo;
  festivals: FestivalSummary[];
}

export interface FestivalStateSummary {
  state: string;
  significant: boolean;
  window_status: string;
}

export interface FestivalDailyPoint {
  date: string;
  value: string;
}

export interface FestivalSelectedState {
  state: string;
  significant: boolean;
  window_status: string;
  start: string;
  end: string;
  observance_start: string;
  observance_end: string;
  rise_start: string | null;
  rise_end: string | null;
  recovery_start: string | null;
  recovery_end: string | null;
  baseline_value: string | null;
  peak_value: string | null;
  recovery_value: string | null;
  rise_pct: string | null;
  peak_rise_pct: string | null;
  observation_days: number;
  sample_items: number;
  insufficient_sample: boolean;
  sample_notice: { en: string; ms: string; zh: string } | null;
  daily_index: FestivalDailyPoint[];
  method_version: string;
  window_method_version: string;
  source_label: string;
  source_url: string;
}

export interface FestivalDetailResponse {
  festival_id: string;
  name_en: string;
  name_zh: string;
  name_ms: string;
  scope: "national" | "state";
  dataset: FestivalDatasetInfo;
  states: FestivalStateSummary[];
  selected_state: string;
  selected: FestivalSelectedState;
}


export interface FestivalAlertItem {
  item_code: string;
  item_name: string;
  unit: string;
  broad_category_id: string;
  broad_category_label_en: string;
  broad_category_label_ms: string;
  rise_pct: string;
}

export interface FestivalAlert {
  festival_id: string;
  name_en: string;
  name_zh: string;
  name_ms: string;
  scope: "national" | "state";
  state: string | null;
  rise_start: string;
  rise_end: string;
  affected_item_count: number;
  affected_items: FestivalAlertItem[];
  evidence_url: string;
  method_version: string;
  window_method_version: string;
  alert_rule_version: string;
}

export interface FestivalAlertResponse {
  on: string;
  state: string | null;
  alert_rule_version: string;
  dataset: FestivalDatasetInfo;
  count: number;
  alerts: FestivalAlert[];
}

export type FestivalItemDataQuality = "measured" | "derived" | "unavailable";

export interface FestivalItemPrice {
  item_code: string;
  item_name: string;
  unit: string;
  source_category: string;
  broad_category_id: string;
  broad_category_label_en: string;
  broad_category_label_ms: string;
  data_quality: FestivalItemDataQuality;
  quality_label: { en: string; ms: string; zh: string };
  rise_pct: string | null;
  baseline_price: string | null;
  peak_price: string | null;
  price_range: { min: string; max: string } | null;
  history_start: string | null;
  history_end: string | null;
  observation_count: number;
  observed_days: number;
  sample_status: string;
}

export interface FestivalItemsResponse {
  festival_id: string;
  state: string;
  dataset: FestivalDatasetInfo;
  average_rise_ratio: string | null;
  average_rise_ratio_method_version: string;
  estimated_price_method_version: string;
  item_count: number;
  items: FestivalItemPrice[];
}


export interface FestivalTopItem {
  item_id: string | null;
  item_code: string;
  item_name: string;
  item_name_en: string | null;
  item_name_ms: string | null;
  unit: string;
  package_size: string;
  category: ItemCategory | null;
  source_category: SourceCategory | null;
  image_url: string | null;
  sara_eligible: boolean | null;
  sara_category_candidate: boolean;
  current_price_rm: number | null;
  historical_rise_pct: string;
  historical_price_range: { min: string; max: string } | null;
  history_start: string | null;
  history_end: string | null;
  observation_count: number;
  observed_days: number;
  sample_status: string;
  is_specialty: boolean;
  specialty_id: string | null;
  specialty_name_en: string | null;
  specialty_name_zh: string | null;
}

export interface FestivalTopItemsResponse {
  festival_id: string;
  state: string;
  dataset: FestivalDatasetInfo;
  method_version: string;
  specialty_method_version: string;
  item_count: number;
  limit: number;
  items: FestivalTopItem[];
}

export interface EarlyPurchaseLineRequest {
  record_id: string;
  item_id: string;
  quantity: number;
  unit_price_rm: number;
  purchased_on: string;
}

export interface EarlyPurchaseSavingItem {
  record_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  festival_id: string;
  festival_name_en: string;
  festival_name_zh: string;
  purchased_on: string;
  quantity: number;
  paid_unit_price_rm: number;
  historical_avg_price_rm: number;
  saving_rm: number;
  baseline_quality: string;
  sample_status: string;
  history_window_start: string | null;
  history_window_end: string | null;
}

export interface EarlyPurchaseSavingsResponse {
  state: string;
  dataset: FestivalDatasetInfo;
  method_version: string;
  purchase_count: number;
  qualifying_count: number;
  excluded_count: number;
  total_early_purchase_savings_rm: number;
  items: EarlyPurchaseSavingItem[];
}


export interface FestivalItemForecast {
  festival_id: string;
  festival_name_en: string;
  festival_name_zh: string;
  festival_name_ms: string;
  state: string | null;
  rise_start: string;
  rise_end: string;
  item_code: string;
  item_name: string;
  unit: string;
  data_quality: FestivalItemDataQuality;
  rise_pct_min: string;
  rise_pct_max: string;
  price_range: { min: string; max: string };
  history_start: string | null;
  history_end: string | null;
  method_version: string;
}

export interface FestivalItemForecastResponse {
  state: string | null;
  on: string | null;
  method_version: string;
  forecast: FestivalItemForecast | null;
}

export interface EarlyPurchasePreviewLineRequest {
  item_id: string;
  quantity: number;
  actual_unit_price_rm: number;
}

export interface EarlyPurchasePreviewItem {
  item_id: string;
  item_code: string;
  item_name: string;
  festival_id: string;
  festival_name_en: string;
  festival_name_zh: string;
  actual_unit_price_rm: number;
  forecast_max_price_rm: number;
  quantity: number;
  estimated_saving_rm: number;
}

export interface EarlyPurchasePreviewResponse {
  state: string;
  on: string | null;
  method_version: string;
  line_count: number;
  qualifying_count: number;
  total_early_purchase_estimated_saving_rm: number;
  items: EarlyPurchasePreviewItem[];
}
