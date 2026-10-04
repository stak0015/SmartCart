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
