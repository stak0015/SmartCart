import {
  ALERT_DATE_STORAGE_KEY,
  ALERT_STATE_STORAGE_KEY,
  isMalaysiaState,
} from "./festival-alert-state";

export interface FestivalContext {
  state: string | null;
  on: string | null;
}

let cachedState: string | null = null;
let cachedDate: string | null = null;

export function rememberFestivalContext(state: string | null | undefined, on: string | null | undefined) {
  if (isMalaysiaState(state)) cachedState = state;
  if (on) cachedDate = on;
}

export function readFestivalContext(): FestivalContext {
  if (typeof window === "undefined") return { state: null, on: null };
  const params = new URLSearchParams(window.location.search);
  const queryState = params.get("alertState");
  const queryDate = params.get("alertDate");
  rememberFestivalContext(queryState, queryDate);
  if (isMalaysiaState(queryState)) {
    window.sessionStorage.setItem(ALERT_STATE_STORAGE_KEY, queryState);
  }
  if (queryDate) {
    window.sessionStorage.setItem(ALERT_DATE_STORAGE_KEY, queryDate);
  }
  const storedState = window.sessionStorage.getItem(ALERT_STATE_STORAGE_KEY);
  return {
    state: isMalaysiaState(queryState)
      ? queryState
      : isMalaysiaState(cachedState)
        ? cachedState
        : isMalaysiaState(storedState)
          ? storedState
          : null,
    on: queryDate ?? cachedDate ?? window.sessionStorage.getItem(ALERT_DATE_STORAGE_KEY),
  };
}
